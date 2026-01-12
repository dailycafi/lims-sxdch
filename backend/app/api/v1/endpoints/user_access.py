from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, func, select, update
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone

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
    user_id = current_user.id  # 先获取 user_id，避免后续 session 问题
    
    # 先尝试更新现有记录
    update_result = await db.execute(
        update(UserAccessLog)
        .where(
            UserAccessLog.user_id == user_id,
            UserAccessLog.path == path
        )
        .values(
            access_count=UserAccessLog.access_count + 1,
            last_accessed_at=datetime.now(timezone.utc),
            title=title,
            icon=icon
        )
    )
    
    # 如果没有更新任何记录，说明不存在，需要创建
    if update_result.rowcount == 0:
        try:
            new_log = UserAccessLog(
                user_id=user_id,
                path=path,
                title=title,
                icon=icon,
                access_count=1
            )
            db.add(new_log)
            await db.commit()
        except IntegrityError:
            # 并发情况下可能刚好被其他请求创建了，回滚后再更新
            await db.rollback()
            await db.execute(
                update(UserAccessLog)
                .where(
                    UserAccessLog.user_id == user_id,
                    UserAccessLog.path == path
                )
                .values(
                    access_count=UserAccessLog.access_count + 1,
                    last_accessed_at=datetime.now(timezone.utc),
                    title=title,
                    icon=icon
                )
            )
            await db.commit()
    else:
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
