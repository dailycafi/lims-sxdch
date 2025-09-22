from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, func, select

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.user_access import UserAccessLog

router = APIRouter()


@router.post("/track")
async def track_user_access(
    path: str,
    title: str,
    icon: str = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """记录用户访问"""
    # 检查是否已存在相同路径的记录
    result = await db.execute(
        select(UserAccessLog).where(
            UserAccessLog.user_id == current_user.id,
            UserAccessLog.path == path
        )
    )
    existing_log = result.scalar_one_or_none()
    
    if existing_log:
        # 更新访问次数和最后访问时间
        existing_log.access_count += 1
        existing_log.last_accessed_at = func.now()
        existing_log.title = title  # 更新标题以防有变化
        existing_log.icon = icon  # 更新图标
    else:
        # 创建新记录
        new_log = UserAccessLog(
            user_id=current_user.id,
            path=path,
            title=title,
            icon=icon,
            access_count=1
        )
        db.add(new_log)
    
    await db.commit()
    return {"status": "success"}


@router.get("/frequent")
async def get_frequent_access(
    limit: int = 6,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[dict]:
    """获取用户最常访问的页面"""
    result = await db.execute(
        select(UserAccessLog)
        .where(UserAccessLog.user_id == current_user.id)
        .order_by(
            desc(UserAccessLog.access_count),
            desc(UserAccessLog.last_accessed_at)
        )
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "path": log.path,
            "title": log.title,
            "icon": log.icon,
            "access_count": log.access_count,
            "last_accessed_at": log.last_accessed_at.isoformat() if log.last_accessed_at else None
        }
        for log in logs
    ]


@router.get("/recent")
async def get_recent_access(
    limit: int = 6,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> List[dict]:
    """获取用户最近访问的页面"""
    result = await db.execute(
        select(UserAccessLog)
        .where(UserAccessLog.user_id == current_user.id)
        .order_by(desc(UserAccessLog.last_accessed_at))
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "path": log.path,
            "title": log.title,
            "icon": log.icon,
            "access_count": log.access_count,
            "last_accessed_at": log.last_accessed_at.isoformat() if log.last_accessed_at else None
        }
        for log in logs
    ]
