from typing import Optional, Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from datetime import datetime
import pandas as pd
from io import BytesIO

from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取审计日志列表（分页）"""
    query = select(AuditLog).options(selectinload(AuditLog.user))
    count_query = select(func.count()).select_from(AuditLog)
    
    # 应用筛选条件
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
        count_query = count_query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
        count_query = count_query.where(AuditLog.entity_id == entity_id)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.where(AuditLog.timestamp >= start_dt)
        count_query = count_query.where(AuditLog.timestamp >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.where(AuditLog.timestamp <= end_dt)
        count_query = count_query.where(AuditLog.timestamp <= end_dt)
    
    # 获取总数
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 按时间倒序
    query = query.order_by(AuditLog.timestamp.desc())
    
    # 分页
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # 转换为响应格式
    items = []
    for log in logs:
        items.append({
            "id": log.id,
            "user": {
                "id": log.user.id if log.user else None,
                "username": log.user.username if log.user else "系统",
                "full_name": log.user.full_name if log.user else "系统",
                "role": log.user.role.value if log.user else "SYSTEM"
            },
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "action": log.action,
            "details": log.details,
            "reason": log.reason,
            "timestamp": log.timestamp.replace(tzinfo=None).isoformat() + "Z" if log.timestamp.tzinfo is None else log.timestamp.isoformat()
        })
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/export")
async def export_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导出审计日志为Excel"""
    query = select(AuditLog).options(selectinload(AuditLog.user))
    
    # 应用筛选条件
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.where(AuditLog.entity_id == entity_id)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.where(AuditLog.timestamp >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.where(AuditLog.timestamp <= end_dt)
    
    # 限制导出数量
    query = query.order_by(AuditLog.timestamp.desc()).limit(10000)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # 转换为DataFrame
    data = []
    for log in logs:
        data.append({
            "日志ID": log.id,
            "时间": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "操作人": log.user.full_name if log.user else "系统",
            "用户名": log.user.username if log.user else "system",
            "角色": log.user.role.value if log.user else "SYSTEM",
            "实体类型": log.entity_type,
            "实体ID": log.entity_id,
            "操作": log.action,
            "操作原因": log.reason or "",
            "详情": str(log.details) if log.details else ""
        })
    
    df = pd.DataFrame(data)
    
    # 创建Excel文件
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='审计日志', index=False)
    
    output.seek(0)
    
    from fastapi.responses import StreamingResponse
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            f'Content-Disposition': f'attachment; filename=audit_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        }
    )


@router.get("/summary")
async def get_audit_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取审计日志统计摘要"""
    # 基础查询
    base_conditions = []
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        base_conditions.append(AuditLog.timestamp >= start_dt)
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        base_conditions.append(AuditLog.timestamp <= end_dt)
    
    # 总记录数
    total_query = select(func.count()).select_from(AuditLog)
    if base_conditions:
        total_query = total_query.where(*base_conditions)
    total_result = await db.execute(total_query)
    total_logs = total_result.scalar() or 0
    
    # 按实体类型统计
    entity_stats_query = select(
        AuditLog.entity_type,
        func.count().label('count')
    ).group_by(AuditLog.entity_type)
    if base_conditions:
        entity_stats_query = entity_stats_query.where(*base_conditions)
    
    entity_result = await db.execute(entity_stats_query)
    entity_stats = {row.entity_type: row.count for row in entity_result}
    
    # 按操作类型统计
    action_stats_query = select(
        AuditLog.action,
        func.count().label('count')
    ).group_by(AuditLog.action)
    if base_conditions:
        action_stats_query = action_stats_query.where(*base_conditions)
    
    action_result = await db.execute(action_stats_query)
    action_stats = {row.action: row.count for row in action_result}
    
    # 最活跃用户
    user_stats_query = select(
        AuditLog.user_id,
        func.count().label('count')
    ).group_by(AuditLog.user_id).order_by(func.count().desc()).limit(10)
    if base_conditions:
        user_stats_query = user_stats_query.where(*base_conditions)
    
    user_result = await db.execute(user_stats_query)
    top_users = []
    for row in user_result:
        if row.user_id:
            user_query = select(User).where(User.id == row.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()
            if user:
                top_users.append({
                    "user": user.full_name,
                    "count": row.count
                })
    
    return {
        "total_logs": total_logs,
        "entity_stats": entity_stats,
        "action_stats": action_stats,
        "top_users": top_users
    }