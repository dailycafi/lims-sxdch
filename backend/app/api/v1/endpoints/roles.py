"""角色管理API接口"""
from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
import uuid
import re

from app.core.database import get_db
from app.models.user import User
from app.models.role import Role, Permission
from app.schemas.role import (
    RoleCreate,
    RoleUpdate,
    RoleResponse,
    RoleListResponse,
    PermissionCreate,
    PermissionResponse
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


def generate_role_code(name: str) -> str:
    """
    根据角色名称生成角色代码
    1. 移除特殊字符
    2. 转换为小写
    3. 添加短UUID后缀确保唯一性
    """
    # 移除所有非字母数字字符，转为小写
    clean_name = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fa5]', '', name).lower()
    
    # 如果清理后的名称为空，使用默认前缀
    if not clean_name:
        clean_name = 'role'
    
    # 生成短UUID（取前8位）
    short_uuid = str(uuid.uuid4())[:8]
    
    # 组合成角色代码
    return f"custom_{clean_name}_{short_uuid}"


def check_admin_permission(current_user: User) -> bool:
    """检查是否为系统管理员"""
    return current_user.is_superuser or any(
        role.code == 'system_admin' for role in current_user.roles
    )


# ==================== 权限管理 ====================

@router.get("/permissions", response_model=List[PermissionResponse])
async def list_permissions(
    module: str = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取权限列表"""
    query = select(Permission)
    if module:
        query = query.where(Permission.module == module)
    
    result = await db.execute(query.order_by(Permission.module, Permission.code))
    permissions = result.scalars().all()
    return permissions


@router.post("/permissions", response_model=PermissionResponse)
async def create_permission(
    permission_data: PermissionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建权限（仅系统管理员）"""
    if not check_admin_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅系统管理员可以创建权限"
        )
    
    # 检查权限代码是否已存在
    result = await db.execute(
        select(Permission).where(Permission.code == permission_data.code)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="权限代码已存在"
        )
    
    permission = Permission(**permission_data.model_dump())
    db.add(permission)
    
    try:
        await db.commit()
        await db.refresh(permission)
        return permission
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建权限失败"
        )


@router.get("/permissions/modules")
async def list_permission_modules(
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取所有权限模块列表"""
    result = await db.execute(
        select(Permission.module).distinct().order_by(Permission.module)
    )
    modules = result.scalars().all()
    return {"modules": modules}


# ==================== 角色管理 ====================

@router.get("/roles", response_model=List[RoleListResponse])
async def list_roles(
    include_inactive: bool = False,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取角色列表"""
    query = select(
        Role,
        func.count(Permission.id).label('permission_count')
    ).outerjoin(
        Role.permissions
    ).group_by(Role.id)
    
    if not include_inactive:
        query = query.where(Role.is_active == True)
    
    result = await db.execute(query.order_by(Role.created_at.desc()))
    roles_with_count = result.all()
    
    return [
        RoleListResponse(
            id=role.id,
            code=role.code,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            is_active=role.is_active,
            created_at=role.created_at,
            permission_count=permission_count
        )
        for role, permission_count in roles_with_count
    ]


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取角色详情"""
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    return role


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    role_data: RoleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建角色（仅系统管理员）"""
    if not check_admin_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅系统管理员可以创建角色"
        )
    
    # 如果没有提供角色代码，则自动生成
    role_code = role_data.code
    if not role_code:
        role_code = generate_role_code(role_data.name)
        
        # 确保生成的代码唯一（理论上UUID已经保证了唯一性，但做个检查）
        max_attempts = 10
        for attempt in range(max_attempts):
            result = await db.execute(
                select(Role).where(Role.code == role_code)
            )
            if not result.scalar_one_or_none():
                break
            # 如果代码已存在，重新生成
            role_code = generate_role_code(role_data.name)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="生成唯一角色代码失败，请重试"
            )
    else:
        # 如果用户提供了代码，检查是否已存在
        result = await db.execute(
            select(Role).where(Role.code == role_code)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="角色代码已存在"
            )
    
    # 创建角色
    role_dict = role_data.model_dump(exclude={'permission_ids', 'code'})
    role_dict['code'] = role_code
    role = Role(**role_dict)
    
    # 添加权限
    if role_data.permission_ids:
        result = await db.execute(
            select(Permission).where(Permission.id.in_(role_data.permission_ids))
        )
        permissions = result.scalars().all()
        role.permissions = permissions
    
    db.add(role)
    
    try:
        await db.commit()
        await db.refresh(role)
        
        # 重新加载以包含权限
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role.id)
        )
        role = result.scalar_one()
        
        return role
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建角色失败"
        )


@router.patch("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_update: RoleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新角色（仅系统管理员）"""
    if not check_admin_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅系统管理员可以更新角色"
        )
    
    # 获取角色
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统内置角色不允许修改"
        )
    
    # 更新基本信息
    update_data = role_update.model_dump(exclude_unset=True, exclude={'permission_ids'})
    for field, value in update_data.items():
        setattr(role, field, value)
    
    # 更新权限
    if role_update.permission_ids is not None:
        result = await db.execute(
            select(Permission).where(Permission.id.in_(role_update.permission_ids))
        )
        permissions = result.scalars().all()
        role.permissions = permissions
    
    try:
        await db.commit()
        await db.refresh(role)
        
        # 重新加载以包含权限
        result = await db.execute(
            select(Role)
            .options(selectinload(Role.permissions))
            .where(Role.id == role.id)
        )
        role = result.scalar_one()
        
        return role
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="更新角色失败"
        )


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除角色（仅系统管理员）"""
    if not check_admin_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅系统管理员可以删除角色"
        )
    
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="角色不存在"
        )
    
    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统内置角色不允许删除"
        )
    
    # 检查是否有用户使用此角色
    result = await db.execute(
        select(func.count()).select_from(User).join(User.roles).where(Role.id == role_id)
    )
    user_count = result.scalar()
    
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"有 {user_count} 个用户正在使用此角色，无法删除"
        )
    
    await db.delete(role)
    await db.commit()
    
    return {"message": "角色已删除"}

