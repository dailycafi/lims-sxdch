from typing import Optional, Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.deviation import Deviation, DeviationSample, DeviationTracking
from app.models.sample import Sample
from app.models.user import User
from app.models.audit import AuditLog
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# Pydantic schemas
class DeviationCreate(BaseModel):
    title: str
    severity: str
    category: str
    project_id: Optional[int] = None
    description: str
    impact_assessment: str
    immediate_action: Optional[str] = None
    sample_codes: Optional[List[str]] = []


class DeviationApprove(BaseModel):
    root_cause: str
    corrective_action: str
    preventive_action: str
    tracking_items: Optional[List[dict]] = []


@router.post("/")
async def create_deviation(
    deviation_data: DeviationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """报告偏差"""
    # 生成偏差编号
    count = await db.execute(
        select(func.count()).select_from(Deviation)
    )
    count_value = count.scalar() or 0
    deviation_code = f"DEV-{datetime.now().strftime('%Y%m%d')}-{count_value + 1:04d}"
    
    # 创建偏差记录
    deviation = Deviation(
        deviation_code=deviation_code,
        title=deviation_data.title,
        severity=deviation_data.severity,
        category=deviation_data.category,
        project_id=deviation_data.project_id,
        description=deviation_data.description,
        impact_assessment=deviation_data.impact_assessment,
        immediate_action=deviation_data.immediate_action,
        reported_by=current_user.id,
        status="reported"
    )
    
    db.add(deviation)
    await db.commit()
    await db.refresh(deviation)
    
    # 关联涉及的样本
    for sample_code in deviation_data.sample_codes:
        result = await db.execute(
            select(Sample).where(Sample.sample_code == sample_code)
        )
        sample = result.scalar_one_or_none()
        
        if sample:
            deviation_sample = DeviationSample(
                deviation_id=deviation.id,
                sample_id=sample.id
            )
            db.add(deviation_sample)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="deviation",
        entity_id=deviation.id,
        action="report",
        details={
            "deviation_code": deviation_code,
            "title": deviation_data.title,
            "severity": deviation_data.severity,
            "category": deviation_data.category
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "偏差报告创建成功", "deviation_code": deviation_code}


@router.get("/")
async def get_deviations(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取偏差列表"""
    query = select(Deviation).options(
        selectinload(Deviation.project),
        selectinload(Deviation.reporter)
    )
    
    if status == "pending":
        query = query.where(Deviation.status.in_(["reported", "approved"]))
    elif status == "in_progress":
        query = query.where(Deviation.status == "in_progress")
    elif status == "closed":
        query = query.where(Deviation.status == "closed")
    
    query = query.order_by(Deviation.created_at.desc())
    
    result = await db.execute(query)
    deviations = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for dev in deviations:
        response.append({
            "id": dev.id,
            "deviation_code": dev.deviation_code,
            "title": dev.title,
            "severity": dev.severity,
            "category": dev.category,
            "project": {
                "lab_project_code": dev.project.lab_project_code if dev.project else None
            },
            "reported_by": {
                "full_name": dev.reporter.full_name if dev.reporter else ""
            },
            "status": dev.status,
            "created_at": dev.created_at.isoformat()
        })
    
    return response


@router.get("/{deviation_id}")
async def get_deviation_detail(
    deviation_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取偏差详情"""
    result = await db.execute(
        select(Deviation).options(
            selectinload(Deviation.project),
            selectinload(Deviation.reporter),
            selectinload(Deviation.approver),
            selectinload(Deviation.closer),
            selectinload(Deviation.samples).selectinload(DeviationSample.sample),
            selectinload(Deviation.attachments),
            selectinload(Deviation.tracking_items)
        ).where(Deviation.id == deviation_id)
    )
    deviation = result.scalar_one_or_none()
    
    if not deviation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="偏差记录不存在"
        )
    
    # 构造响应
    return {
        "id": deviation.id,
        "deviation_code": deviation.deviation_code,
        "title": deviation.title,
        "severity": deviation.severity,
        "category": deviation.category,
        "description": deviation.description,
        "impact_assessment": deviation.impact_assessment,
        "immediate_action": deviation.immediate_action,
        "root_cause": deviation.root_cause,
        "corrective_action": deviation.corrective_action,
        "preventive_action": deviation.preventive_action,
        "status": deviation.status,
        "reported_by": {
            "full_name": deviation.reporter.full_name if deviation.reporter else ""
        },
        "approved_by": {
            "full_name": deviation.approver.full_name if deviation.approver else None
        },
        "closed_by": {
            "full_name": deviation.closer.full_name if deviation.closer else None
        },
        "created_at": deviation.created_at.isoformat(),
        "approved_at": deviation.approved_at.isoformat() if deviation.approved_at else None,
        "closed_at": deviation.closed_at.isoformat() if deviation.closed_at else None,
        "samples": [
            {
                "id": ds.sample.id,
                "sample_code": ds.sample.sample_code
            } for ds in deviation.samples
        ],
        "attachments": [
            {
                "id": att.id,
                "file_name": att.file_name
            } for att in deviation.attachments
        ],
        "tracking_items": [
            {
                "id": item.id,
                "action": item.action,
                "assignee": item.assignee,
                "due_date": item.due_date.isoformat(),
                "completed": item.completed
            } for item in deviation.tracking_items
        ]
    }


@router.post("/{deviation_id}/approve")
async def approve_deviation(
    deviation_id: int,
    approval_data: DeviationApprove,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """批准偏差处理方案"""
    result = await db.execute(
        select(Deviation).where(Deviation.id == deviation_id)
    )
    deviation = result.scalar_one_or_none()
    
    if not deviation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="偏差记录不存在"
        )
    
    if deviation.status != "reported":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只能批准已报告的偏差"
        )
    
    # 更新偏差信息
    deviation.root_cause = approval_data.root_cause
    deviation.corrective_action = approval_data.corrective_action
    deviation.preventive_action = approval_data.preventive_action
    deviation.approved_by = current_user.id
    deviation.approved_at = datetime.utcnow()
    deviation.status = "in_progress"
    
    # 创建跟踪项
    for item_data in approval_data.tracking_items:
        tracking_item = DeviationTracking(
            deviation_id=deviation.id,
            action=item_data["action"],
            assignee=item_data["assignee"],
            due_date=datetime.fromisoformat(item_data["due_date"])
        )
        db.add(tracking_item)
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="deviation",
        entity_id=deviation_id,
        action="approve",
        details={
            "root_cause": approval_data.root_cause,
            "tracking_items": len(approval_data.tracking_items)
        },
        reason="批准偏差处理方案",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "偏差处理方案已批准"}


@router.post("/{deviation_id}/tracking/{tracking_id}/complete")
async def complete_tracking_item(
    deviation_id: int,
    tracking_id: int,
    completion_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """完成跟踪项"""
    result = await db.execute(
        select(DeviationTracking).where(
            DeviationTracking.id == tracking_id,
            DeviationTracking.deviation_id == deviation_id
        )
    )
    tracking_item = result.scalar_one_or_none()
    
    if not tracking_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="跟踪项不存在"
        )
    
    tracking_item.completed = True
    tracking_item.completed_at = datetime.utcnow()
    tracking_item.comments = completion_data.get("comments", "")
    
    await db.commit()
    
    # 检查是否所有跟踪项都已完成
    result = await db.execute(
        select(func.count()).select_from(DeviationTracking).where(
            DeviationTracking.deviation_id == deviation_id,
            DeviationTracking.completed == False
        )
    )
    uncompleted_count = result.scalar() or 0
    
    # 如果所有跟踪项都完成了，可以关闭偏差
    if uncompleted_count == 0:
        result = await db.execute(
            select(Deviation).where(Deviation.id == deviation_id)
        )
        deviation = result.scalar_one_or_none()
        if deviation:
            deviation.status = "ready_to_close"
    
    await db.commit()
    
    return {"message": "跟踪项已完成"}


@router.post("/{deviation_id}/close")
async def close_deviation(
    deviation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """关闭偏差"""
    result = await db.execute(
        select(Deviation).where(Deviation.id == deviation_id)
    )
    deviation = result.scalar_one_or_none()
    
    if not deviation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="偏差记录不存在"
        )
    
    # 检查所有跟踪项是否完成
    result = await db.execute(
        select(func.count()).select_from(DeviationTracking).where(
            DeviationTracking.deviation_id == deviation_id,
            DeviationTracking.completed == False
        )
    )
    uncompleted_count = result.scalar() or 0
    
    if uncompleted_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"还有 {uncompleted_count} 个跟踪项未完成"
        )
    
    deviation.status = "closed"
    deviation.closed_by = current_user.id
    deviation.closed_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="deviation",
        entity_id=deviation_id,
        action="close",
        reason="所有纠正和预防措施已完成",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "偏差已关闭"}
