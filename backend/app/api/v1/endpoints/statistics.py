from typing import Optional, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta
from pydantic import BaseModel
import pandas as pd
from io import BytesIO

from app.core.database import get_db
from app.models.sample import (
    Sample, SampleStatus, SampleBorrowItem, SampleTransferItem,
    SampleBorrowRequest, SampleTransferRecord, SampleDestroyRequest
)
from app.models.audit import AuditLog
from app.models.user import User
from app.models.project import Project, ProjectArchiveRequest
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


@router.get("/sample-records")
async def get_sample_records(
    project_id: Optional[int] = None,
    sample_code: Optional[str] = None,
    operation_type: Optional[str] = None,
    purpose: Optional[str] = None,  # 新增：用途筛选
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    operator: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本存取记录"""
    # 查询审计日志
    query = select(AuditLog).options(
        selectinload(AuditLog.user)
    ).where(
        AuditLog.entity_type.in_([
            "sample", "sample_receive", "sample_inventory", 
            "sample_borrow", "sample_return", "sample_transfer", 
            "sample_destroy"
        ])
    )
    
    # 应用筛选条件
    if start_date:
        query = query.where(AuditLog.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(AuditLog.timestamp <= datetime.fromisoformat(end_date))
    if operator:
        query = query.join(User).where(User.full_name.contains(operator))
    
    query = query.order_by(AuditLog.timestamp.desc()).limit(500)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # 转换为响应格式
    records = []
    for log in logs:
        # 从详情中提取信息
        details = log.details or {}
        
        # 确定操作类型
        operation_type_map = {
            "sample_receive": "receive",
            "sample_inventory": "inventory",
            "sample_borrow": "checkout",
            "sample_return": "return",
            "sample_transfer": "transfer",
            "sample_destroy": "destroy"
        }
        op_type = operation_type_map.get(log.entity_type, log.action)
        
        # 如果有操作类型筛选，跳过不匹配的
        if operation_type and op_type != operation_type:
            continue
        
        # 提取样本编号
        sample_codes = details.get("sample_codes", [])
        if not sample_codes and "sample_code" in details:
            sample_codes = [details["sample_code"]]
        elif not sample_codes and "sample_count" in details:
            # 如果没有具体编号，创建占位符
            sample_codes = [f"批量操作({details['sample_count']}个)"]
        
        # 为每个样本创建一条记录
        # 用途筛选
        record_purpose = details.get("purpose", "")
        if purpose and purpose not in record_purpose:
            continue
        
        for sc in sample_codes[:10]:  # 限制每个操作最多显示10个样本
            # 如果有样本编号筛选，跳过不匹配的
            if sample_code and sc != sample_code:
                continue
            
            record = {
                "id": log.id,
                "sample_code": sc,
                "project": details.get("project", ""),
                "operation_type": op_type,
                "operation_detail": _get_operation_detail(log),
                "operator": log.user.full_name if log.user else "",
                "operation_time": log.timestamp.isoformat(),
                "location": details.get("location", ""),
                "temperature": details.get("temperature"),
                "purpose": record_purpose  # 新增：用途字段
            }
            records.append(record)
    
    return records


@router.get("/sample/{sample_code}/access-history")
async def get_sample_access_history(
    sample_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取单个样本的存取历史，包括存取次数和暴露时间计算"""
    # 查询样本
    sample_result = await db.execute(
        select(Sample).where(Sample.sample_code == sample_code)
    )
    sample = sample_result.scalar_one_or_none()
    
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="样本不存在"
        )
    
    # 查询该样本的所有领用记录
    borrow_result = await db.execute(
        select(SampleBorrowItem).options(
            selectinload(SampleBorrowItem.request)
        ).where(
            SampleBorrowItem.sample_id == sample.id
        ).order_by(SampleBorrowItem.borrowed_at)
    )
    borrow_items = borrow_result.scalars().all()
    
    # 计算存取次数和暴露时间
    access_records = []
    total_exposure_minutes = 0
    cumulative_exposure = 0
    
    for idx, item in enumerate(borrow_items):
        if not item.borrowed_at:
            continue
            
        # 计算单次暴露时间
        end_time = item.returned_at or datetime.utcnow()
        duration_minutes = int((end_time - item.borrowed_at).total_seconds() / 60)
        
        # 累计暴露时间
        total_exposure_minutes += duration_minutes
        cumulative_exposure = total_exposure_minutes
        
        # 获取用途
        purpose = item.request.purpose if item.request else "未知"
        
        access_records.append({
            "access_number": idx + 1,
            "borrowed_at": item.borrowed_at.isoformat(),
            "returned_at": item.returned_at.isoformat() if item.returned_at else None,
            "duration_minutes": duration_minutes,
            "cumulative_exposure_minutes": cumulative_exposure,
            "purpose": purpose,
            "status": "已归还" if item.returned_at else "未归还",
            "notes": item.notes or ""
        })
    
    # 计算统计信息
    return {
        "sample_code": sample_code,
        "project_id": sample.project_id,
        "current_status": sample.status.value if sample.status else "unknown",
        "total_access_count": len(access_records),
        "total_exposure_minutes": total_exposure_minutes,
        "total_exposure_hours": round(total_exposure_minutes / 60, 2),
        "access_records": access_records,
        "exposure_by_purpose": _calculate_exposure_by_purpose(access_records)
    }


def _calculate_exposure_by_purpose(access_records: list) -> dict:
    """按用途计算暴露时间"""
    purpose_exposure = {}
    for record in access_records:
        purpose = record.get("purpose", "未知")
        duration = record.get("duration_minutes", 0)
        if purpose not in purpose_exposure:
            purpose_exposure[purpose] = {"count": 0, "total_minutes": 0}
        purpose_exposure[purpose]["count"] += 1
        purpose_exposure[purpose]["total_minutes"] += duration
    return purpose_exposure


@router.get("/exposure-records")
async def get_exposure_records(
    project_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本暴露记录"""
    # 查询领用记录（样本离开冷库的主要原因）
    query = select(SampleBorrowItem).options(
        selectinload(SampleBorrowItem.request),
        selectinload(SampleBorrowItem.sample)
    ).where(
        SampleBorrowItem.borrowed_at.is_not(None)
    )
    
    if start_date:
        query = query.where(SampleBorrowItem.borrowed_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SampleBorrowItem.borrowed_at <= datetime.fromisoformat(end_date))
    
    result = await db.execute(query)
    borrow_items = result.scalars().all()
    
    # 计算暴露时间
    exposure_records = []
    for item in borrow_items:
        if not item.sample:
            continue
            
        # 计算暴露时长
        end_time = item.returned_at or datetime.utcnow()
        duration = int((end_time - item.borrowed_at).total_seconds() / 60)  # 分钟
        
        # 根据项目ID筛选
        if project_id and item.sample.project_id != project_id:
            continue
        
        record = {
            "id": item.id,
            "sample_code": item.sample.sample_code,
            "project": item.request.project.lab_project_code if item.request and item.request.project else "",
            "start_time": item.borrowed_at.isoformat(),
            "end_time": item.returned_at.isoformat() if item.returned_at else None,
            "duration": duration,
            "max_temperature": None,  # 待集成温度监控系统
            "reason": f"领用用途: {item.request.purpose if item.request else '未知'}"
        }
        exposure_records.append(record)
    
    return exposure_records


class AlertThresholds(BaseModel):
    max_temperature_c: Optional[float] = 8.0
    max_exposure_minutes: Optional[int] = 30


@router.post("/alerts/check")
async def check_alerts(
    project_id: Optional[int] = None,
    thresholds: AlertThresholds = AlertThresholds(),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """基于阈值检查暴露记录是否预警，返回命中列表。温度暂用占位字段。"""
    records = await get_exposure_records(project_id, None, None, current_user, db)
    alerts = []
    for r in records:
        temp = r.get('max_temperature', -20)
        duration = r.get('duration', 0)
        hit = False
        reasons = []
        if thresholds.max_temperature_c is not None and temp > thresholds.max_temperature_c:
            hit = True
            reasons.append(f"温度 {temp}°C 超过阈值 {thresholds.max_temperature_c}°C")
        if thresholds.max_exposure_minutes is not None and duration > thresholds.max_exposure_minutes:
            hit = True
            reasons.append(f"暴露 {duration} 分钟超过阈值 {thresholds.max_exposure_minutes} 分钟")
        if hit:
            alerts.append({**r, 'reasons': reasons})
    return {"alerts": alerts, "count": len(alerts)}


@router.get("/summary")
async def get_statistics_summary(
    project_id: Optional[int] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取统计汇总数据"""
    # 基础查询
    base_query = select(Sample)
    if project_id:
        base_query = base_query.where(Sample.project_id == project_id)
    
    # 样本总数
    total_result = await db.execute(
        select(func.count()).select_from(Sample).where(
            Sample.project_id == project_id if project_id else True
        )
    )
    total_samples = total_result.scalar() or 0
    
    # 各状态样本数
    status_counts = {}
    for status in [SampleStatus.IN_STORAGE, SampleStatus.CHECKED_OUT, 
                   SampleStatus.TRANSFERRED, SampleStatus.DESTROYED]:
        result = await db.execute(
            select(func.count()).select_from(Sample).where(
                and_(
                    Sample.status == status,
                    Sample.project_id == project_id if project_id else True
                )
            )
        )
        count = result.scalar() or 0
        status_counts[status.value] = count
    
    # 计算平均存储天数
    result = await db.execute(
        select(func.avg(
            func.extract('epoch', func.now() - Sample.created_at) / 86400
        )).select_from(Sample).where(
            and_(
                Sample.status == SampleStatus.IN_STORAGE,
                Sample.project_id == project_id if project_id else True
            )
        )
    )
    avg_storage_days = result.scalar() or 0
    
    # 计算总暴露时间和事件数
    exposure_query = select(SampleBorrowItem).where(
        SampleBorrowItem.borrowed_at.is_not(None)
    )
    if project_id:
        exposure_query = exposure_query.join(Sample).where(Sample.project_id == project_id)
    
    result = await db.execute(exposure_query)
    borrow_items = result.scalars().all()
    
    total_exposure_time = 0
    exposure_events = len(borrow_items)
    
    for item in borrow_items:
        if item.returned_at:
            duration = (item.returned_at - item.borrowed_at).total_seconds() / 60
            total_exposure_time += duration

    # 获取项目统计
    project_stats = {}
    if not project_id:
        # 项目总数
        total_projects_result = await db.execute(select(func.count()).select_from(Project))
        project_stats["total_projects"] = total_projects_result.scalar() or 0
        
        # 活跃项目数
        active_projects_result = await db.execute(
            select(func.count()).select_from(Project).where(
                and_(Project.is_active == True, Project.is_archived == False)
            )
        )
        project_stats["active_projects"] = active_projects_result.scalar() or 0
    else:
        # 如果指定了项目ID，则该项目本身是否活跃
        project_result = await db.execute(select(Project).where(Project.id == project_id))
        project = project_result.scalar_one_or_none()
        project_stats["total_projects"] = 1 if project else 0
        project_stats["active_projects"] = 1 if project and project.is_active and not project.is_archived else 0

    # 计算待审批任务数
    # 领用申请待审批
    borrow_pending = await db.execute(
        select(func.count()).select_from(SampleBorrowRequest).where(
            and_(
                SampleBorrowRequest.status == "pending",
                SampleBorrowRequest.project_id == project_id if project_id else True
            )
        )
    )
    # 转移申请待审批
    transfer_pending = await db.execute(
        select(func.count()).select_from(SampleTransferRecord).where(
            and_(
                SampleTransferRecord.status == "pending",
                SampleTransferRecord.project_id == project_id if project_id else True
            )
        )
    )
    # 销毁申请待审批
    destroy_pending = await db.execute(
        select(func.count()).select_from(SampleDestroyRequest).where(
            and_(
                SampleDestroyRequest.status.in_(["pending", "test_manager_approved", "director_approved"]),
                SampleDestroyRequest.project_id == project_id if project_id else True
            )
        )
    )
    # 项目归档申请待审批
    archive_pending = await db.execute(
        select(func.count()).select_from(ProjectArchiveRequest).where(
            and_(
                ProjectArchiveRequest.status.in_(["pending_manager", "pending_qa", "pending_admin"]),
                ProjectArchiveRequest.project_id == project_id if project_id else True
            )
        )
    )
    pending_approvals = (borrow_pending.scalar() or 0) + \
                        (transfer_pending.scalar() or 0) + \
                        (destroy_pending.scalar() or 0) + \
                        (archive_pending.scalar() or 0)

    # 今日处理样本数
    today_start = datetime.combine(datetime.utcnow().date(), datetime.min.time())
    processed_today_result = await db.execute(
        select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.timestamp >= today_start,
                AuditLog.entity_type.in_(["sample", "sample_receive", "sample_inventory", "sample_borrow", "sample_return", "sample_transfer", "sample_destroy"]),
                AuditLog.action.in_(["create", "update", "receive", "inventory", "checkout", "return", "transfer", "destroy"])
            )
        )
    )
    processed_today = processed_today_result.scalar() or 0

    # 今日审批任务数
    approved_today_result = await db.execute(
        select(func.count(AuditLog.id)).where(
            and_(
                AuditLog.timestamp >= today_start,
                AuditLog.action.in_(["approve", "test_manager_approved", "director_approved", "qa_approved"])
            )
        )
    )
    approved_today = approved_today_result.scalar() or 0

    return {
        "total_samples": total_samples,
        "in_storage": status_counts.get("in_storage", 0),
        "checked_out": status_counts.get("checked_out", 0),
        "transferred": status_counts.get("transferred", 0),
        "destroyed": status_counts.get("destroyed", 0),
        "avg_storage_days": float(avg_storage_days),
        "total_exposure_time": int(total_exposure_time),
        "exposure_events": exposure_events,
        "total_projects": project_stats.get("total_projects", 0),
        "active_projects": project_stats.get("active_projects", 0),
        "pending_approvals": pending_approvals,
        "processed_today": processed_today,
        "approved_today": approved_today,
    }


@router.get("/export")
async def export_statistics(
    type: str = Query(..., description="导出类型: records, exposure, summary"),
    project_id: Optional[int] = None,
    sample_code: Optional[str] = None,
    operation_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    operator: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导出统计数据为Excel"""
    # 根据类型获取数据
    if type == "records":
        data = await get_sample_records(
            project_id, sample_code, operation_type, 
            start_date, end_date, operator, current_user, db
        )
        df = pd.DataFrame(data)
        if not df.empty:
            df['operation_time'] = pd.to_datetime(df['operation_time'])
            df = df.sort_values('operation_time', ascending=False)
    
    elif type == "exposure":
        data = await get_exposure_records(project_id, start_date, end_date, current_user, db)
        df = pd.DataFrame(data)
        if not df.empty:
            df['start_time'] = pd.to_datetime(df['start_time'])
            df['duration_hours'] = df['duration'] / 60
    
    elif type == "summary":
        data = await get_statistics_summary(project_id, current_user, db)
        df = pd.DataFrame([data])
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的导出类型"
        )
    
    # 创建Excel文件
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='数据', index=False)
    
    output.seek(0)
    
    from fastapi.responses import StreamingResponse
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            f'Content-Disposition': f'attachment; filename=statistics_{type}_{datetime.now().strftime("%Y%m%d")}.xlsx'
        }
    )


def _get_operation_detail(log: AuditLog) -> str:
    """根据审计日志生成操作详情描述"""
    details = log.details or {}
    action_map = {
        "create": "创建",
        "update": "更新",
        "delete": "删除",
        "receive": "接收",
        "inventory": "入库",
        "checkout": "领用",
        "return": "归还",
        "transfer": "转移",
        "destroy": "销毁",
        "approve": "审批",
        "execute": "执行"
    }
    
    action_text = action_map.get(log.action, log.action)
    
    # 根据不同的实体类型生成详情
    if log.entity_type == "sample_receive":
        return f"{action_text}了 {details.get('sample_count', '')} 个样本"
    elif log.entity_type == "sample_inventory":
        return f"清点入库 {details.get('scanned_samples', '')} 个样本"
    elif log.entity_type == "sample_borrow":
        return f"{action_text}样本，用途: {details.get('purpose', '')}"
    elif log.entity_type == "sample_return":
        return f"归还了 {details.get('returned_count', '')} 个样本"
    elif log.entity_type == "sample_transfer":
        return f"{action_text}到 {details.get('to', details.get('target_org', ''))}"
    elif log.entity_type == "sample_destroy":
        return f"{action_text}了 {details.get('sample_count', '')} 个样本"
    else:
        return f"{action_text}{log.entity_type}"
