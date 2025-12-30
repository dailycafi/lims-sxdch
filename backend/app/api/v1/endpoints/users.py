from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.core.password_validator import PasswordValidator
from app.models.user import User, UserRole
from app.models.global_params import SystemSetting
from app.models.role import Role
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PasswordChange, PasswordReset
from app.api.v1.endpoints.auth import get_current_user, get_current_active_superuser

router = APIRouter()


def check_user_permission(current_user: User, target_role: UserRole = None) -> bool:
    """检查用户权限"""
    # 系统管理员有所有权限
    if current_user.is_superuser:
        return True
    
    # 检查是否有system_admin角色
    if any(role.code == 'system_admin' for role in current_user.roles):
        return True
    
    # 兼容旧的role字段
    if current_user.role == UserRole.SYSTEM_ADMIN:
        return True
    
    # 样本管理员可以管理部分用户
    if current_user.role == UserRole.SAMPLE_ADMIN and target_role:
        allowed_roles = [UserRole.PROJECT_LEAD, UserRole.ANALYST]
        return target_role in allowed_roles
    
    return False


async def validate_password_complexity(password: str, username: str, db: AsyncSession):
    """根据系统设置验证密码复杂度"""
    # 获取设置
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "password_complexity_enabled"))
    setting = result.scalar_one_or_none()
    
    # 如果未设置或显式开启，则验证
    if setting is None or setting.value is True:
        is_valid, errors = PasswordValidator.validate(password, username)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码不符合要求: " + "; ".join(errors)
            )
    else:
        # 如果关闭了复杂度要求，仅检查最小长度
        if len(password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="密码长度至少为6个字符"
            )


@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建新用户"""
    # 检查权限
    if not check_user_permission(current_user, user_data.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限创建该角色的用户"
        )
    
    # 验证密码强度
    await validate_password_complexity(user_data.password, user_data.username, db)
    
    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被使用"
        )
    
    # 获取角色
    result = await db.execute(
        select(Role).where(Role.id.in_(user_data.role_ids))
    )
    roles = result.scalars().all()
    
    if len(roles) != len(user_data.role_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="部分角色不存在"
        )
    
    # 创建用户
    try:
        db_user = User(
            username=user_data.username,
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            role=user_data.role,  # 保留用于向后兼容
            is_superuser=any(r.code == 'system_admin' for r in roles)
        )
        db_user.roles = roles
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        
        # 重新加载以包含角色信息
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == db_user.id)
        )
        db_user = result.scalar_one()
        
        return db_user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建用户失败"
        )


@router.get("/", response_model=List[UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取用户列表"""
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .offset(skip)
        .limit(limit)
    )
    users = result.scalars().all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def read_user(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取指定用户信息"""
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新用户信息"""
    # 获取要更新的用户
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 检查权限
    if user_id != current_user.id and not check_user_permission(current_user, user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此用户"
        )
    
    # 更新基本信息
    update_data = user_update.model_dump(exclude_unset=True, exclude={'role_ids'})
    for field, value in update_data.items():
        setattr(user, field, value)
    
    # 更新角色
    if user_update.role_ids is not None:
        if len(user_update.role_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户至少需要分配一个角色"
            )
        
        result = await db.execute(
            select(Role).where(Role.id.in_(user_update.role_ids))
        )
        roles = result.scalars().all()
        
        if len(roles) != len(user_update.role_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="部分角色不存在"
            )
        
        user.roles = roles
        # 更新is_superuser标志
        user.is_superuser = any(r.code == 'system_admin' for r in roles)
    
    try:
        await db.commit()
        await db.refresh(user)
        
        # 重新加载以包含角色信息
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == user.id)
        )
        user = result.scalar_one()
        
        return user
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被使用"
        )


@router.post("/{user_id}/change-password")
async def change_password(
    user_id: int,
    password_data: PasswordChange,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """修改密码（用户自己操作）"""
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能修改自己的密码"
        )
    
    # 验证旧密码
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="原密码不正确"
        )
    
    # 验证新密码强度
    await validate_password_complexity(
        password_data.new_password,
        current_user.username,
        db
    )
    
    # 更新密码
    current_user.hashed_password = get_password_hash(password_data.new_password)
    await db.commit()
    
    return {"message": "密码修改成功"}


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    password_data: PasswordReset,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """重置密码（管理员操作）"""
    if not check_user_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限重置密码"
        )
    
    # 获取目标用户
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 验证新密码强度
    await validate_password_complexity(
        password_data.new_password,
        user.username,
        db
    )
    
    # 更新密码
    user.hashed_password = get_password_hash(password_data.new_password)
    await db.commit()
    
    return {"message": "密码重置成功"}


@router.get("/password-requirements/info")
async def get_password_requirements(db: AsyncSession = Depends(get_db)):
    """获取密码要求说明"""
    # 获取设置
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "password_complexity_enabled"))
    setting = result.scalar_one_or_none()
    
    # 如果开启了复杂度要求
    if setting is None or setting.value is True:
        return {
            "requirements": PasswordValidator.get_requirements()
        }
    else:
        # 如果关闭了复杂度要求，仅返回长度要求
        return {
            "requirements": ["至少6个字符"]
        }


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除用户（系统管理员）"""
    # 检查权限 - 只有系统管理员可以删除用户
    if not check_user_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除用户"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "用户已删除"}
