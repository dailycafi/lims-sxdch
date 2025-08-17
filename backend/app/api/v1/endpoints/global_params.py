from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.global_params import Organization, SampleType
from app.models.user import User, UserRole
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


def check_global_params_permission(user: User) -> bool:
    """检查全局参数管理权限"""
    allowed_roles = [UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    return user.role in allowed_roles


@router.post("/organizations")
async def create_organization(
    org_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建组织/机构"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    try:
        db_org = Organization(**org_data)
        db.add(db_org)
        await db.commit()
        await db.refresh(db_org)
        return db_org
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="组织名称已存在"
        )


@router.get("/organizations")
async def read_organizations(
    org_type: str = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取组织列表"""
    query = select(Organization).where(Organization.is_active == True)
    
    if org_type:
        query = query.where(Organization.org_type == org_type)
    
    result = await db.execute(query)
    orgs = result.scalars().all()
    return orgs


@router.post("/sample-types")
async def create_sample_type(
    sample_type_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建样本类型配置"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    db_sample_type = SampleType(**sample_type_data)
    db.add(db_sample_type)
    await db.commit()
    await db.refresh(db_sample_type)
    return db_sample_type


@router.get("/sample-types")
async def read_sample_types(
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本类型配置列表"""
    result = await db.execute(
        select(SampleType).where(SampleType.is_active == True)
    )
    sample_types = result.scalars().all()
    return sample_types
