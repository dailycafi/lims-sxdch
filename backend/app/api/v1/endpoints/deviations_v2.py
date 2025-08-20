from typing import Optional, Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.deviation import Deviation, DeviationSample, DeviationApproval
from app.models.sample import Sample
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# 定义8步审批流程
APPROVAL_STEPS = [
    {"step": 1, "name": "偏差报告", "role": ["ANALYST", "SAMPLE_ADMIN"], "next_role": ["PROJECT_LEAD"]},
    {"step": 2, "name": "项目负责人审核", "role": ["PROJECT_LEAD"], "next_role": ["QA"]},
    {"step": 3, "name": "QA初审", "role": ["QA"], "next_role": ["PROJECT_LEAD"]},
    {"step": 4, "name": "项目负责人指定执行人", "role": ["PROJECT_LEAD"], "next_role": ["ANALYST", "SAMPLE_ADMIN"]},
    {"step": 5, "name": "执行人填写执行情况", "role": ["ANALYST", "SAMPLE_ADMIN"], "next_role": ["PROJECT_LEAD"]},
    {"step": 6, "name": "项目负责人确认", "role": ["PROJECT_LEAD"], "next_role": ["TEST_MANAGER"]},
    {"step": 7, "name": "分析测试主管审核", "role": ["TEST_MANAGER"], "next_role": ["QA"]},
    {"step": 8, "name": "QA最终审核", "role": ["QA"], "next_role": ["LAB_DIRECTOR"]},
    {"step": 9, "name": "实验室主任批准", "role": ["LAB_DIRECTOR"], "next_role": []},
]


class DeviationCreate(BaseModel):
    title: str
    severity: str  # minor, major, critical
    category: str  # temperature, operation, equipment, sample, process, other
    description: str
    impact_assessment: str
    immediate_action: Optional[str] = None
    project_id: Optional[int] = None
    sample_ids: Optional[List[int]] = []


class DeviationApprovalAction(BaseModel):
    action: str  # approve, reject, execute
    comments: str
    designated_executor_id: Optional[int] = None  # 步骤4专用
    executed_actions: Optional[str] = None  # 步骤5专用
    root_cause: Optional[str] = None  # 步骤3专用
    corrective_action: Optional[str] = None  # 步骤3专用
    preventive_action: Optional[str] = None  # 步骤3专用


@router.post("/")
async def create_deviation(
    deviation_data: DeviationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建偏差报告（步骤1）"""
    # 检查权限
    if current_user.role not in [UserRole.ANALYST, UserRole.SAMPLE_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有分析测试员或样本管理员可以报告偏差"
        )
    
    # 生成偏差编号
    result = await db.execute(
        select(func.count()).select_from(Deviation)
    )
    count = result.scalar() or 0
    deviation_code = f"DEV-{datetime.now().strftime('%Y%m')}-{str(count + 1).zfill(4)}"
    
    # 创建偏差记录
    deviation = Deviation(
        deviation_code=deviation_code,
        title=deviation_data.title,
        severity=deviation_data.severity,
        category=deviation_data.category,
        description=deviation_data.description,
        impact_assessment=deviation_data.impact_assessment,
        immediate_action=deviation_data.immediate_action,
        project_id=deviation_data.project_id,
        reported_by=current_user.id,
        status="step_1_reported"
    )
    db.add(deviation)
    await db.flush()
    
    # 关联样本
    if deviation_data.sample_ids:
        for sample_id in deviation_data.sample_ids:
            result = await db.execute(
                select(Sample).where(Sample.id == sample_id)
            )
            sample = result.scalar_one_or_none()
            if sample:
                deviation_sample = DeviationSample(
                    deviation_id=deviation.id,
                    sample_id=sample.id
                )
                db.add(deviation_sample)
    
    # 创建第一步审批记录
    approval = DeviationApproval(
        deviation_id=deviation.id,
        step=1,
        step_name=APPROVAL_STEPS[0]["name"],
        role=current_user.role.value,
        user_id=current_user.id,
        action="submit",
        comments=f"报告偏差：{deviation_data.description}",
        processed_at=datetime.utcnow()
    )
    db.add(approval)
    
    # 创建第二步待审批记录
    next_approval = DeviationApproval(
        deviation_id=deviation.id,
        step=2,
        step_name=APPROVAL_STEPS[1]["name"],
        role="PROJECT_LEAD"
    )
    db.add(next_approval)
    
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
    my_pending: Optional[bool] = False,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取偏差列表"""
    query = select(Deviation).options(
        selectinload(Deviation.project),
        selectinload(Deviation.reporter),
        selectinload(Deviation.approvals)
    )
    
    if my_pending:
        # 获取当前用户待处理的偏差
        # 根据用户角色和当前步骤过滤
        role_steps = []
        for i, step in enumerate(APPROVAL_STEPS):
            if current_user.role.value in step["role"]:
                role_steps.append(i + 1)
        
        if role_steps:
            # 查找处于这些步骤且未处理的偏差
            query = query.join(DeviationApproval).where(
                DeviationApproval.step.in_(role_steps),
                DeviationApproval.user_id.is_(None)
            )
    
    if status:
        query = query.where(Deviation.status == status)
    
    query = query.order_by(Deviation.created_at.desc())
    
    result = await db.execute(query)
    deviations = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for deviation in deviations:
        current_step = None
        for approval in deviation.approvals:
            if approval.user_id is None:
                current_step = approval.step
                break
        
        response.append({
            "id": deviation.id,
            "deviation_code": deviation.deviation_code,
            "title": deviation.title,
            "severity": deviation.severity,
            "category": deviation.category,
            "project": {
                "id": deviation.project.id,
                "lab_project_code": deviation.project.lab_project_code
            } if deviation.project else None,
            "reporter": {
                "full_name": deviation.reporter.full_name
            } if deviation.reporter else None,
            "status": deviation.status,
            "current_step": current_step,
            "created_at": deviation.created_at.isoformat()
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
            selectinload(Deviation.approvals).selectinload(DeviationApproval.user),
            selectinload(Deviation.samples).selectinload(DeviationSample.sample)
        ).where(Deviation.id == deviation_id)
    )
    deviation = result.scalar_one_or_none()
    
    if not deviation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="偏差不存在"
        )
    
    # 获取当前步骤
    current_step = None
    for approval in deviation.approvals:
        if approval.user_id is None:
            current_step = {
                "step": approval.step,
                "name": approval.step_name,
                "role": approval.role
            }
            break
    
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
        "project": {
            "id": deviation.project.id,
            "lab_project_code": deviation.project.lab_project_code
        } if deviation.project else None,
        "reporter": {
            "id": deviation.reporter.id,
            "full_name": deviation.reporter.full_name
        } if deviation.reporter else None,
        "status": deviation.status,
        "current_step": current_step,
        "created_at": deviation.created_at.isoformat(),
        "samples": [
            {
                "id": ds.sample.id,
                "sample_code": ds.sample.sample_code
            } for ds in deviation.samples
        ],
        "approvals": [
            {
                "step": approval.step,
                "step_name": approval.step_name,
                "user": {
                    "full_name": approval.user.full_name
                } if approval.user else None,
                "action": approval.action,
                "comments": approval.comments,
                "executed_actions": approval.executed_actions,
                "processed_at": approval.processed_at.isoformat() if approval.processed_at else None
            } for approval in deviation.approvals
        ]
    }


@router.post("/{deviation_id}/approve")
async def process_deviation_approval(
    deviation_id: int,
    approval_data: DeviationApprovalAction,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """处理偏差审批"""
    # 获取偏差记录
    result = await db.execute(
        select(Deviation).options(
            selectinload(Deviation.approvals)
        ).where(Deviation.id == deviation_id)
    )
    deviation = result.scalar_one_or_none()
    
    if not deviation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="偏差不存在"
        )
    
    # 找到当前待处理的步骤
    current_approval = None
    for approval in deviation.approvals:
        if approval.user_id is None:
            current_approval = approval
            break
    
    if not current_approval:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该偏差没有待处理的审批"
        )
    
    # 检查权限
    step_config = APPROVAL_STEPS[current_approval.step - 1]
    if current_user.role.value not in step_config["role"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"您没有权限处理步骤{current_approval.step}: {current_approval.step_name}"
        )
    
    # 更新当前审批记录
    current_approval.user_id = current_user.id
    current_approval.action = approval_data.action
    current_approval.comments = approval_data.comments
    current_approval.processed_at = datetime.utcnow()
    
    # 根据不同步骤处理特殊逻辑
    if current_approval.step == 3 and approval_data.action == "approve":
        # QA初审时可以填写根本原因和措施
        if approval_data.root_cause:
            deviation.root_cause = approval_data.root_cause
        if approval_data.corrective_action:
            deviation.corrective_action = approval_data.corrective_action
        if approval_data.preventive_action:
            deviation.preventive_action = approval_data.preventive_action
    
    elif current_approval.step == 4 and approval_data.action == "approve":
        # 项目负责人指定执行人
        if not approval_data.designated_executor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请指定执行人"
            )
        current_approval.designated_executor_id = approval_data.designated_executor_id
    
    elif current_approval.step == 5:
        # 执行人填写执行情况
        if not approval_data.executed_actions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请填写实际执行情况"
            )
        current_approval.executed_actions = approval_data.executed_actions
    
    # 处理审批结果
    if approval_data.action == "reject":
        # 拒绝，返回到上一步
        deviation.status = f"step_{current_approval.step}_rejected"
        # TODO: 创建新的待处理记录返回给上一步
    else:
        # 批准，进入下一步
        if current_approval.step < len(APPROVAL_STEPS):
            next_step = APPROVAL_STEPS[current_approval.step]
            deviation.status = f"step_{current_approval.step + 1}_pending"
            
            # 创建下一步审批记录
            next_approval = DeviationApproval(
                deviation_id=deviation.id,
                step=current_approval.step + 1,
                step_name=next_step["name"],
                role=next_step["role"][0] if next_step["role"] else None
            )
            
            # 步骤5的执行人由步骤4指定
            if current_approval.step == 4:
                next_approval.role = "EXECUTOR"
                # 这里可以设置预期的执行人ID
            
            db.add(next_approval)
        else:
            # 所有步骤完成
            deviation.status = "closed"
            deviation.closed_by = current_user.id
            deviation.closed_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="deviation",
        entity_id=deviation.id,
        action=f"step_{current_approval.step}_{approval_data.action}",
        details={
            "step": current_approval.step,
            "step_name": current_approval.step_name,
            "action": approval_data.action,
            "comments": approval_data.comments
        },
        reason=approval_data.comments,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": f"步骤{current_approval.step}处理成功"}
