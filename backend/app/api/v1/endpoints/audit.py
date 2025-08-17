from typing import List, Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, date

from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


@router.get("/")
async def read_audit_logs(
    skip: int = 0,
    limit: int = 100,
    user_id: int = None,
    module: str = None,
    action: str = None,
    start_date: date = None,
    end_date: date = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取审计日志"""
    query = select(AuditLog)
    
    # 构建过滤条件
    filters = []
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if module:
        filters.append(AuditLog.module == module)
    if action:
        filters.append(AuditLog.action == action)
    if start_date:
        filters.append(AuditLog.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        filters.append(AuditLog.created_at <= datetime.combine(end_date, datetime.max.time()))
    
    if filters:
        query = query.where(and_(*filters))
    
    # 按时间倒序排列
    query = query.order_by(AuditLog.created_at.desc())
    
    # 分页
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "items": logs,
        "total": len(logs),
        "skip": skip,
        "limit": limit
    }


@router.get("/search")
async def search_audit_logs(
    keyword: str = Query(..., description="搜索关键词"),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """搜索审计日志"""
    query = select(AuditLog).where(
        AuditLog.action.contains(keyword) |
        AuditLog.module.contains(keyword) |
        AuditLog.reason.contains(keyword)
    ).order_by(AuditLog.created_at.desc()).limit(100)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return logs
