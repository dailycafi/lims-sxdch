from typing import Optional, Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, distinct, case
from sqlalchemy.orm import selectinload, joinedload
from datetime import datetime, timedelta
from pydantic import BaseModel
import pandas as pd
from io import BytesIO

from app.core.database import get_db
from app.core.datetime_utils import datetime_to_utc_iso
from app.models.sample import (
    Sample, SampleStatus, SampleBorrowItem, SampleTransferItem,
    SampleBorrowRequest, SampleTransferRecord, SampleDestroyRequest,
    SampleReceiveRecord
)
from app.models.audit import AuditLog
from app.models.user import User
from app.models.project import Project, ProjectArchiveRequest
from app.models.storage import StorageFreezer, StorageShelf, StorageRack, StorageBox
from app.models.global_params import Organization
from app.api.v1.endpoints.auth import get_current_user
from app.api.v1.deps import assert_project_access, get_accessible_project_ids, is_project_admin

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
    # 非管理员必须明确选择项目，避免跨项目暴露审计数据
    if current_user and not is_project_admin(current_user) and project_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先选择项目")
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)
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
                "operation_time": datetime_to_utc_iso(log.timestamp),
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

    await assert_project_access(db, current_user, sample.project_id)
    
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
            "borrowed_at": datetime_to_utc_iso(item.borrowed_at),
            "returned_at": datetime_to_utc_iso(item.returned_at) if item.returned_at else None,
            "duration_minutes": duration_minutes,
            "cumulative_exposure_minutes": cumulative_exposure,
            "purpose": purpose,
            "status": "已归还" if item.returned_at else "未归还",
            "notes": item.request.notes if item.request else ""
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
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)
    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = set(ids)
        if not ids:
            return []
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
        if accessible_ids is not None and item.sample.project_id not in accessible_ids:
            continue
        
        record = {
            "id": item.id,
            "sample_code": item.sample.sample_code,
            "project": item.request.project.lab_project_code if item.request and item.request.project else "",
            "start_time": datetime_to_utc_iso(item.borrowed_at),
            "end_time": datetime_to_utc_iso(item.returned_at) if item.returned_at else None,
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
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)
    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            # 没有任何授权项目时，汇总全部为 0
            return {
                "total_samples": 0,
                "in_storage": 0,
                "checked_out": 0,
                "transferred": 0,
                "destroyed": 0,
                "avg_storage_days": 0.0,
                "total_exposure_time": 0,
                "exposure_events": 0,
                "total_projects": 0,
                "active_projects": 0,
                "pending_approvals": 0,
                "processed_today": 0,
                "approved_today": 0,
            }
    # 基础查询
    base_query = select(Sample)
    if project_id:
        base_query = base_query.where(Sample.project_id == project_id)
    elif accessible_ids is not None:
        base_query = base_query.where(Sample.project_id.in_(accessible_ids))
    
    # 样本总数
    total_result = await db.execute(
        select(func.count()).select_from(Sample).where(
            Sample.project_id == project_id if project_id else (Sample.project_id.in_(accessible_ids) if accessible_ids is not None else True)
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
                    Sample.project_id == project_id if project_id else (Sample.project_id.in_(accessible_ids) if accessible_ids is not None else True)
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
                Sample.project_id == project_id if project_id else (Sample.project_id.in_(accessible_ids) if accessible_ids is not None else True)
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
    elif accessible_ids is not None:
        exposure_query = exposure_query.join(Sample).where(Sample.project_id.in_(accessible_ids))
    
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
        if accessible_ids is not None:
            total_projects_result = await db.execute(select(func.count()).select_from(Project).where(Project.id.in_(accessible_ids)))
        else:
            total_projects_result = await db.execute(select(func.count()).select_from(Project))
        project_stats["total_projects"] = total_projects_result.scalar() or 0
        
        # 活跃项目数
        if accessible_ids is not None:
            active_projects_result = await db.execute(
                select(func.count()).select_from(Project).where(
                    and_(Project.is_active == True, Project.is_archived == False, Project.id.in_(accessible_ids))
                )
            )
        else:
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
                SampleBorrowRequest.project_id == project_id if project_id else (SampleBorrowRequest.project_id.in_(accessible_ids) if accessible_ids is not None else True)
            )
        )
    )
    # 转移申请待审批
    transfer_pending = await db.execute(
        select(func.count()).select_from(SampleTransferRecord).where(
            and_(
                SampleTransferRecord.status == "pending",
                SampleTransferRecord.project_id == project_id if project_id else (SampleTransferRecord.project_id.in_(accessible_ids) if accessible_ids is not None else True)
            )
        )
    )
    # 销毁申请待审批
    destroy_pending = await db.execute(
        select(func.count()).select_from(SampleDestroyRequest).where(
            and_(
                SampleDestroyRequest.status.in_(["pending", "test_manager_approved", "director_approved"]),
                SampleDestroyRequest.project_id == project_id if project_id else (SampleDestroyRequest.project_id.in_(accessible_ids) if accessible_ids is not None else True)
            )
        )
    )
    # 项目归档申请待审批
    archive_pending = await db.execute(
        select(func.count()).select_from(ProjectArchiveRequest).where(
            and_(
                ProjectArchiveRequest.status.in_(["pending_manager", "pending_qa", "pending_admin"]),
                ProjectArchiveRequest.project_id == project_id if project_id else (ProjectArchiveRequest.project_id.in_(accessible_ids) if accessible_ids is not None else True)
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
    type: str = Query(..., description="导出类型"),
    format: str = Query("excel", description="导出格式: excel, pdf"),
    project_id: Optional[int] = None,
    sponsor_id: Optional[int] = None,
    sample_code: Optional[str] = None,
    operation_type: Optional[str] = None,
    keyword: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    operator: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导出统计数据为Excel或PDF"""
    # 根据类型获取数据
    df = pd.DataFrame()
    sheet_name = "数据"

    if type == "records":
        data = await get_sample_records(
            project_id, sample_code, operation_type,
            None, start_date, end_date, operator, current_user, db
        )
        df = pd.DataFrame(data)
        if not df.empty:
            df['operation_time'] = pd.to_datetime(df['operation_time'])
            df = df.sort_values('operation_time', ascending=False)
        sheet_name = "操作记录"

    elif type == "exposure":
        data = await get_exposure_records(project_id, start_date, end_date, current_user, db)
        df = pd.DataFrame(data)
        if not df.empty:
            df['start_time'] = pd.to_datetime(df['start_time'])
            df['duration_hours'] = df['duration'] / 60
        sheet_name = "暴露记录"

    elif type == "summary":
        data = await get_statistics_summary(project_id, current_user, db)
        df = pd.DataFrame([data])
        sheet_name = "统计汇总"

    elif type == "center":
        data = await get_center_sample_statistics(project_id, start_date, end_date, current_user, db)
        df = pd.DataFrame(data)
        sheet_name = "中心统计"

    elif type == "receive":
        data = await get_receive_statistics(project_id, start_date, end_date, current_user, db)
        df = pd.DataFrame(data)
        sheet_name = "接收统计"

    elif type == "transfer":
        data = await get_transfer_summary(project_id, start_date, end_date, current_user, db)
        df = pd.DataFrame(data)
        sheet_name = "转移汇总"

    elif type == "search" and keyword:
        data = await search_samples(keyword, project_id, start_date, end_date, current_user, db)
        df = pd.DataFrame(data)
        sheet_name = "搜索结果"

    elif type == "project":
        data = await get_project_summary(project_id, sponsor_id, current_user, db)
        # Flatten the data for Excel
        flat_data = []
        for item in data:
            flat_data.append({
                "项目编号": item["project_code"],
                "申办方": item["sponsor_name"],
                "在库样本数": item["in_storage_count"],
                "最早入库时间": item["earliest_storage_date"],
                "已保存天数": item["storage_duration_days"],
                "存储位置": ", ".join(item["storage_locations"])
            })
        df = pd.DataFrame(flat_data)
        sheet_name = "项目汇总"

    elif type == "freezer":
        data = await get_freezer_summary(project_id, current_user, db)
        # Flatten the data for Excel
        flat_data = []
        for item in data:
            projects_str = "; ".join([f"{p['project_code']}({p['sample_count']})" for p in item["projects"]])
            flat_data.append({
                "冰箱名称": item["freezer_name"],
                "位置": item["location"],
                "温度": item["temperature"],
                "总样本数": item["total_samples"],
                "项目分布": projects_str
            })
        df = pd.DataFrame(flat_data)
        sheet_name = "冰箱汇总"

    elif type == "sponsor":
        data = await get_sponsor_statistics(sponsor_id, current_user, db)
        # Flatten the data for Excel
        flat_data = []
        for item in data:
            projects_str = "; ".join([f"{p['project_code']}({p['sample_count']})" for p in item["projects"]])
            flat_data.append({
                "申办方": item["sponsor_name"],
                "项目数": item["project_count"],
                "总样本数": item["total_samples"],
                "在库样本数": item["in_storage_samples"],
                "项目列表": projects_str
            })
        df = pd.DataFrame(flat_data)
        sheet_name = "申办方统计"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的导出类型"
        )

    # Create file based on format
    output = BytesIO()

    if format == "pdf":
        # For PDF, we'll create a simple HTML-based PDF
        # Note: This requires reportlab or weasyprint to be installed
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.platypus import SimpleDocTemplate, Table as PDFTable, TableStyle, Paragraph
            from reportlab.lib.styles import getSampleStyleSheet

            doc = SimpleDocTemplate(output, pagesize=landscape(A4))
            elements = []

            # Add title
            styles = getSampleStyleSheet()
            elements.append(Paragraph(f"统计报告 - {sheet_name}", styles['Heading1']))
            elements.append(Paragraph(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))

            if not df.empty:
                # Convert DataFrame to list for PDF table
                data_list = [df.columns.tolist()] + df.values.tolist()
                table = PDFTable(data_list)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                elements.append(table)

            doc.build(elements)
            output.seek(0)

            return StreamingResponse(
                output,
                media_type='application/pdf',
                headers={
                    'Content-Disposition': f'attachment; filename=statistics_{type}_{datetime.now().strftime("%Y%m%d")}.pdf'
                }
            )
        except ImportError:
            # Fall back to Excel if reportlab is not installed
            format = "excel"

    # Default: Excel format
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name=sheet_name, index=False)

    output.seek(0)

    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename=statistics_{type}_{datetime.now().strftime("%Y%m%d")}.xlsx'
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


# ========== New Statistics Endpoints ==========

@router.get("/center-samples")
async def get_center_sample_statistics(
    project_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """中心样本统计 - 多少个中心送来了样本，分别多少个，支持筛选时间段"""
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)

    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    # Query receive records grouped by clinical org
    query = select(
        SampleReceiveRecord.clinical_org_id,
        Organization.name.label('center_name'),
        func.count(SampleReceiveRecord.id).label('receive_count'),
        func.sum(SampleReceiveRecord.sample_count).label('sample_count'),
        func.min(SampleReceiveRecord.received_at).label('first_receive_date'),
        func.max(SampleReceiveRecord.received_at).label('last_receive_date')
    ).join(
        Organization, SampleReceiveRecord.clinical_org_id == Organization.id
    ).group_by(
        SampleReceiveRecord.clinical_org_id, Organization.name
    )

    if project_id:
        query = query.where(SampleReceiveRecord.project_id == project_id)
    elif accessible_ids is not None:
        query = query.where(SampleReceiveRecord.project_id.in_(accessible_ids))

    if start_date:
        query = query.where(SampleReceiveRecord.received_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SampleReceiveRecord.received_at <= datetime.fromisoformat(end_date))

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "center_id": row.clinical_org_id,
            "center_name": row.center_name,
            "sample_count": row.sample_count or 0,
            "first_receive_date": datetime_to_utc_iso(row.first_receive_date) if row.first_receive_date else None,
            "last_receive_date": datetime_to_utc_iso(row.last_receive_date) if row.last_receive_date else None
        }
        for row in rows
    ]


@router.get("/receive-records")
async def get_receive_statistics(
    project_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """样本接收统计 - 接收次数、每次数量、时间、入库位置"""
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)

    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    query = select(SampleReceiveRecord).options(
        selectinload(SampleReceiveRecord.project),
        selectinload(SampleReceiveRecord.clinical_org),
        selectinload(SampleReceiveRecord.receiver)
    )

    if project_id:
        query = query.where(SampleReceiveRecord.project_id == project_id)
    elif accessible_ids is not None:
        query = query.where(SampleReceiveRecord.project_id.in_(accessible_ids))

    if start_date:
        query = query.where(SampleReceiveRecord.received_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SampleReceiveRecord.received_at <= datetime.fromisoformat(end_date))

    query = query.order_by(SampleReceiveRecord.received_at.desc()).limit(500)

    result = await db.execute(query)
    records = result.scalars().all()

    return [
        {
            "id": record.id,
            "receive_code": f"RCV-{record.id:06d}",
            "project_name": record.project.lab_project_code if record.project else "",
            "center_name": record.clinical_org.name if record.clinical_org else "",
            "sample_count": record.sample_count,
            "received_at": datetime_to_utc_iso(record.received_at),
            "received_by": record.receiver.full_name if record.receiver else "",
            "storage_location": record.storage_location or "",
            "status": record.status
        }
        for record in records
    ]


@router.get("/transfer-summary")
async def get_transfer_summary(
    project_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """样本转移汇总 - 样本编号、转移日期时间、位置变更"""
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)

    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    # Query transfer items with their records
    query = select(SampleTransferItem).options(
        selectinload(SampleTransferItem.transfer).selectinload(SampleTransferRecord.requester),
        selectinload(SampleTransferItem.sample)
    ).join(SampleTransferRecord)

    if project_id:
        query = query.where(SampleTransferRecord.project_id == project_id)
    elif accessible_ids is not None:
        query = query.where(SampleTransferRecord.project_id.in_(accessible_ids))

    if start_date:
        query = query.where(SampleTransferItem.transferred_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(SampleTransferItem.transferred_at <= datetime.fromisoformat(end_date))

    query = query.order_by(SampleTransferItem.transferred_at.desc()).limit(500)

    result = await db.execute(query)
    items = result.scalars().all()

    return [
        {
            "id": item.id,
            "sample_code": item.sample.sample_code if item.sample else "",
            "transfer_date": datetime_to_utc_iso(item.transferred_at) if item.transferred_at else datetime_to_utc_iso(item.transfer.created_at),
            "from_location": item.transfer.from_location if item.transfer else "",
            "to_location": item.transfer.to_location if item.transfer else "",
            "transfer_type": item.transfer.transfer_type if item.transfer else "",
            "operator": item.transfer.requester.full_name if item.transfer and item.transfer.requester else ""
        }
        for item in items
    ]


@router.get("/sample/{sample_code}/lifecycle")
async def get_sample_lifecycle(
    sample_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """单个样本查询 - 以 Timeline 方式展示生命周期"""
    # Query sample
    sample_result = await db.execute(
        select(Sample).options(
            selectinload(Sample.project)
        ).where(Sample.sample_code == sample_code)
    )
    sample = sample_result.scalar_one_or_none()

    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="样本不存在"
        )

    await assert_project_access(db, current_user, sample.project_id)

    # Query audit logs for this sample
    audit_query = select(AuditLog).options(
        selectinload(AuditLog.user)
    ).where(
        or_(
            AuditLog.details.contains({"sample_code": sample_code}),
            AuditLog.details.contains({"sample_codes": [sample_code]}),
            and_(
                AuditLog.entity_type == "sample",
                AuditLog.entity_id == sample.id
            )
        )
    ).order_by(AuditLog.timestamp.desc())

    result = await db.execute(audit_query)
    logs = result.scalars().all()

    # Build timeline events
    events = []
    event_type_map = {
        "sample_receive": "receive",
        "sample_inventory": "inventory",
        "sample_borrow": "checkout",
        "sample_return": "return",
        "sample_transfer": "transfer",
        "sample_destroy": "destroy",
        "sample_archive": "archive"
    }

    for log in logs:
        event_type = event_type_map.get(log.entity_type, log.action)
        details = log.details or {}

        # Build location from details
        location = details.get("location", "")
        if not location and details.get("freezer_id"):
            location = f"冰箱: {details.get('freezer_id')}"

        events.append({
            "id": log.id,
            "event_type": event_type,
            "event_detail": _get_operation_detail(log),
            "operator": log.user.full_name if log.user else "",
            "timestamp": datetime_to_utc_iso(log.timestamp),
            "location": location,
            "notes": details.get("notes", "")
        })

    return {
        "sample_code": sample.sample_code,
        "project_name": sample.project.lab_project_code if sample.project else "",
        "current_status": sample.status.value if sample.status else "unknown",
        "events": events
    }


@router.get("/search")
async def search_samples(
    keyword: str = Query(..., min_length=1),
    project_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """按日期/关键词/任务搜索"""
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)

    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    # Build search query
    query = select(Sample).options(
        selectinload(Sample.project),
        selectinload(Sample.box)
    ).where(
        or_(
            Sample.sample_code.ilike(f"%{keyword}%"),
            Sample.barcode.ilike(f"%{keyword}%"),
            Sample.subject_code.ilike(f"%{keyword}%"),
            Sample.special_notes.ilike(f"%{keyword}%")
        )
    )

    if project_id:
        query = query.where(Sample.project_id == project_id)
    elif accessible_ids is not None:
        query = query.where(Sample.project_id.in_(accessible_ids))

    if start_date:
        query = query.where(Sample.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(Sample.created_at <= datetime.fromisoformat(end_date))

    query = query.order_by(Sample.created_at.desc()).limit(100)

    result = await db.execute(query)
    samples = result.scalars().all()

    # Get last operation for each sample
    sample_results = []
    for sample in samples:
        # Get last audit log for this sample
        last_log_query = select(AuditLog).options(
            selectinload(AuditLog.user)
        ).where(
            or_(
                AuditLog.entity_id == sample.id,
                AuditLog.details.contains({"sample_code": sample.sample_code})
            )
        ).order_by(AuditLog.timestamp.desc()).limit(1)

        last_log_result = await db.execute(last_log_query)
        last_log = last_log_result.scalar_one_or_none()

        # Build storage location string
        storage_location = ""
        if sample.box:
            storage_location = f"{sample.box.name}"
            if sample.position_in_box:
                storage_location += f" - {sample.position_in_box}"
        elif sample.freezer_id:
            storage_location = f"冰箱: {sample.freezer_id}"

        sample_results.append({
            "id": sample.id,
            "sample_code": sample.sample_code,
            "project_name": sample.project.lab_project_code if sample.project else "",
            "status": sample.status.value if sample.status else "unknown",
            "storage_location": storage_location,
            "created_at": datetime_to_utc_iso(sample.created_at),
            "last_operation": _get_operation_detail(last_log) if last_log else "-",
            "last_operation_time": datetime_to_utc_iso(last_log.timestamp) if last_log else None
        })

    return sample_results


@router.get("/project-summary")
async def get_project_summary(
    project_id: Optional[int] = None,
    sponsor_id: Optional[int] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """按项目汇总 - 在库样本数量、编号、入库时间、已保存时长、保存位置"""
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)

    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    # Query projects with their samples
    query = select(Project).options(
        selectinload(Project.sponsor)
    )

    if project_id:
        query = query.where(Project.id == project_id)
    elif accessible_ids is not None:
        query = query.where(Project.id.in_(accessible_ids))

    if sponsor_id:
        query = query.where(Project.sponsor_id == sponsor_id)

    query = query.where(Project.is_active == True)

    result = await db.execute(query)
    projects = result.scalars().all()

    summaries = []
    for project in projects:
        # Get in-storage samples for this project
        samples_query = select(Sample).options(
            selectinload(Sample.box)
        ).where(
            and_(
                Sample.project_id == project.id,
                Sample.status == SampleStatus.IN_STORAGE
            )
        )
        samples_result = await db.execute(samples_query)
        samples = samples_result.scalars().all()

        if not samples:
            continue

        # Calculate statistics
        sample_codes = [s.sample_code for s in samples]
        storage_locations = set()
        earliest_date = None

        for s in samples:
            if s.box:
                storage_locations.add(s.box.name)
            elif s.freezer_id:
                storage_locations.add(f"冰箱: {s.freezer_id}")

            if s.created_at:
                if earliest_date is None or s.created_at < earliest_date:
                    earliest_date = s.created_at

        storage_duration_days = 0
        if earliest_date:
            storage_duration_days = (datetime.utcnow() - earliest_date).days

        summaries.append({
            "project_id": project.id,
            "project_code": project.lab_project_code,
            "sponsor_name": project.sponsor.name if project.sponsor else "",
            "in_storage_count": len(samples),
            "sample_codes": sample_codes[:100],  # Limit to 100 codes
            "earliest_storage_date": datetime_to_utc_iso(earliest_date) if earliest_date else None,
            "storage_duration_days": storage_duration_days,
            "storage_locations": list(storage_locations)
        })

    return summaries


@router.get("/freezer-summary")
async def get_freezer_summary(
    project_id: Optional[int] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """按冰箱汇总 - 冰箱中样本项目名称及数量"""
    if project_id is not None:
        await assert_project_access(db, current_user, project_id)

    accessible_ids = None
    if current_user and not is_project_admin(current_user) and project_id is None:
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    # Query all freezers
    freezers_query = select(StorageFreezer).where(StorageFreezer.is_active == True)
    freezers_result = await db.execute(freezers_query)
    freezers = freezers_result.scalars().all()

    summaries = []
    for freezer in freezers:
        # Get all boxes in this freezer
        boxes_query = select(StorageBox).join(
            StorageRack
        ).join(
            StorageShelf
        ).where(
            StorageShelf.freezer_id == freezer.id
        )
        boxes_result = await db.execute(boxes_query)
        boxes = boxes_result.scalars().all()
        box_ids = [b.id for b in boxes]

        if not box_ids:
            summaries.append({
                "freezer_id": freezer.id,
                "freezer_name": freezer.name,
                "location": freezer.location or "",
                "temperature": freezer.temperature or -80,
                "total_samples": 0,
                "projects": []
            })
            continue

        # Get samples in these boxes
        samples_query = select(
            Sample.project_id,
            Project.lab_project_code,
            func.count(Sample.id).label('sample_count')
        ).join(
            Project
        ).where(
            and_(
                Sample.box_id.in_(box_ids),
                Sample.status == SampleStatus.IN_STORAGE
            )
        )

        if project_id:
            samples_query = samples_query.where(Sample.project_id == project_id)
        elif accessible_ids is not None:
            samples_query = samples_query.where(Sample.project_id.in_(accessible_ids))

        samples_query = samples_query.group_by(Sample.project_id, Project.lab_project_code)

        samples_result = await db.execute(samples_query)
        project_samples = samples_result.all()

        total_samples = sum(ps.sample_count for ps in project_samples)

        summaries.append({
            "freezer_id": freezer.id,
            "freezer_name": freezer.name,
            "location": freezer.location or "",
            "temperature": freezer.temperature or -80,
            "total_samples": total_samples,
            "projects": [
                {
                    "project_code": ps.lab_project_code,
                    "sample_count": ps.sample_count
                }
                for ps in project_samples
            ]
        })

    return summaries


@router.get("/sponsor-stats")
async def get_sponsor_statistics(
    sponsor_id: Optional[int] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """按申办方查询 - 各申办方的项目和样本统计"""
    accessible_ids = None
    if current_user and not is_project_admin(current_user):
        ids = await get_accessible_project_ids(db, current_user)
        accessible_ids = ids
        if not ids:
            return []

    # Query sponsors
    sponsors_query = select(Organization).where(
        Organization.org_type == "sponsor"
    )
    if sponsor_id:
        sponsors_query = sponsors_query.where(Organization.id == sponsor_id)

    sponsors_result = await db.execute(sponsors_query)
    sponsors = sponsors_result.scalars().all()

    stats = []
    for sponsor in sponsors:
        # Get projects for this sponsor
        projects_query = select(Project).where(
            and_(
                Project.sponsor_id == sponsor.id,
                Project.is_active == True
            )
        )
        if accessible_ids is not None:
            projects_query = projects_query.where(Project.id.in_(accessible_ids))

        projects_result = await db.execute(projects_query)
        projects = projects_result.scalars().all()

        if not projects:
            continue

        project_ids = [p.id for p in projects]

        # Get sample counts
        total_samples_result = await db.execute(
            select(func.count(Sample.id)).where(Sample.project_id.in_(project_ids))
        )
        total_samples = total_samples_result.scalar() or 0

        in_storage_result = await db.execute(
            select(func.count(Sample.id)).where(
                and_(
                    Sample.project_id.in_(project_ids),
                    Sample.status == SampleStatus.IN_STORAGE
                )
            )
        )
        in_storage_samples = in_storage_result.scalar() or 0

        # Get per-project counts
        project_counts = []
        for project in projects:
            count_result = await db.execute(
                select(func.count(Sample.id)).where(Sample.project_id == project.id)
            )
            count = count_result.scalar() or 0
            project_counts.append({
                "project_code": project.lab_project_code,
                "sample_count": count
            })

        stats.append({
            "sponsor_id": sponsor.id,
            "sponsor_name": sponsor.name,
            "project_count": len(projects),
            "total_samples": total_samples,
            "in_storage_samples": in_storage_samples,
            "projects": project_counts
        })

    return stats
