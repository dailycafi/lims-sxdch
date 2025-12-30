from typing import List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.project_member import ProjectMember


def is_project_admin(user: User) -> bool:
    """项目可见性/授权管理的超级权限（可看全部项目）。"""
    if user is None:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if getattr(user, "role", None) in {UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN}:
        return True
    role_codes = {getattr(r, "code", None) for r in (getattr(user, "roles", None) or [])}
    return bool(role_codes & {"super_admin", "system_admin", "sample_admin"})


async def get_accessible_project_ids(db: AsyncSession, user: User) -> List[int]:
    if is_project_admin(user):
        # 管理员可见全部：返回空列表由调用方自行决定是否需要 where in 过滤
        return []
    result = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user.id).distinct()
    )
    return list(result.scalars().all())


async def has_project_access(db: AsyncSession, user: User, project_id: int) -> bool:
    if is_project_admin(user):
        return True
    result = await db.execute(
        select(ProjectMember.id)
        .where(ProjectMember.user_id == user.id, ProjectMember.project_id == project_id)
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def assert_project_access(db: AsyncSession, user: User, project_id: int) -> None:
    ok = await has_project_access(db, user, project_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问该项目，请联系管理员为你授权项目",
        )


