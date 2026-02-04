import secrets
import string
from datetime import datetime, timezone
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
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PasswordChange, PasswordReset, UserDelete
from app.api.v1.endpoints.auth import get_current_user, get_current_active_superuser

router = APIRouter()


def generate_random_password(length: int = 12) -> str:
    """生成随机密码，包含大小写字母、数字和特殊字符"""
    # 确保包含每种字符类型
    lowercase = secrets.choice(string.ascii_lowercase)
    uppercase = secrets.choice(string.ascii_uppercase)
    digit = secrets.choice(string.digits)
    special = secrets.choice("!@#$%^&*()_+-=")
    
    # 剩余字符随机选择
    all_chars = string.ascii_letters + string.digits + "!@#$%^&*()_+-="
    remaining = ''.join(secrets.choice(all_chars) for _ in range(length - 4))
    
    # 组合并打乱顺序
    password_chars = list(lowercase + uppercase + digit + special + remaining)
    secrets.SystemRandom().shuffle(password_chars)
    
    return ''.join(password_chars)


async def verify_audit_credentials(
    db: AsyncSession,
    current_user: User,
    audit_username: str,
    audit_password: str
) -> bool:
    """验证审计操作时的用户名密码"""
    if not audit_username or not audit_password:
        return False
    
    # 必须是当前登录用户的用户名
    if audit_username != current_user.username:
        return False
    
    # 验证密码
    return verify_password(audit_password, current_user.hashed_password)


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


class CreateUserResponse(UserResponse):
    """创建用户响应，包含初始密码"""
    initial_password: str = None  # 仅在创建时返回


@router.post("/", response_model=CreateUserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建新用户
    
    密码由系统自动生成，用户首次登录时需要强制修改密码。
    """
    # 检查权限
    if not check_user_permission(current_user, user_data.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限创建该角色的用户"
        )
    
    # 系统生成随机密码
    initial_password = generate_random_password(12)
    
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
            hashed_password=get_password_hash(initial_password),
            role=user_data.role,  # 保留用于向后兼容
            is_superuser=any(r.code == 'system_admin' for r in roles),
            must_change_password=True,  # 首次登录需要修改密码
            password_changed_at=None  # 密码未被用户修改过
        )
        db_user.roles = roles
        db.add(db_user)
        
        # 记录审计日志
        audit_log = AuditLog(
            user_id=current_user.id,
            entity_type="user",
            entity_id=0,  # 新用户ID待定
            action="create",
            details={
                "username": user_data.username,
                "full_name": user_data.full_name,
                "email": user_data.email,
                "role_ids": user_data.role_ids
            },
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit_log)
        
        await db.commit()
        await db.refresh(db_user)
        
        # 更新审计日志的entity_id
        audit_log.entity_id = db_user.id
        await db.commit()
        
        # 重新加载以包含角色信息
        result = await db.execute(
            select(User)
            .options(selectinload(User.roles))
            .where(User.id == db_user.id)
        )
        db_user = result.scalar_one()
        
        # 返回包含初始密码的响应
        response_data = {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email,
            "full_name": db_user.full_name,
            "role": db_user.role,
            "is_active": db_user.is_active,
            "is_superuser": db_user.is_superuser,
            "must_change_password": db_user.must_change_password,
            "password_changed_at": db_user.password_changed_at,
            "created_at": db_user.created_at,
            "updated_at": db_user.updated_at,
            "roles": db_user.roles,
            "initial_password": initial_password
        }
        return response_data
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
    """更新用户信息
    
    编辑用户时需要填写理由，并输入当前登录用户的用户名密码验证。
    """
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
    
    # 检查是否尝试禁用自己
    if user_update.is_active is False and user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用自己的账户"
        )
    
    # 验证审计信息（管理员编辑他人时需要）
    if user_id != current_user.id:
        if not user_update.audit_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请填写修改理由"
            )
        
        if not await verify_audit_credentials(
            db, current_user,
            user_update.audit_username,
            user_update.audit_password
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码验证失败"
            )
    
    # 记录修改前的状态
    old_data = {
        "email": user.email,
        "full_name": user.full_name,
        "role_ids": [r.id for r in user.roles] if user.roles else [],
        "is_active": user.is_active
    }
    
    # 更新基本信息（排除审计字段和角色ID）
    exclude_fields = {'role_ids', 'audit_reason', 'audit_username', 'audit_password'}
    update_data = user_update.model_dump(exclude_unset=True, exclude=exclude_fields)
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
        # 记录审计日志
        if user_id != current_user.id:
            new_data = {
                "email": user.email,
                "full_name": user.full_name,
                "role_ids": [r.id for r in user.roles] if user.roles else [],
                "is_active": user.is_active
            }
            audit_log = AuditLog(
                user_id=current_user.id,
                entity_type="user",
                entity_id=user_id,
                action="update",
                details={
                    "reason": user_update.audit_reason,
                    "old_data": old_data,
                    "new_data": new_data,
                    "target_username": user.username
                },
                timestamp=datetime.now(timezone.utc)
            )
            db.add(audit_log)
        
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
    current_user.password_changed_at = datetime.now(timezone.utc)  # 记录密码修改时间
    current_user.must_change_password = False  # 清除首次登录标记
    
    # 记录审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="user",
        entity_id=current_user.id,
        action="change_password",
        details={
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_log)
    
    await db.commit()
    
    return {"message": "密码修改成功"}


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    password_data: PasswordReset = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """重置密码（管理员操作）

    如果不提供 new_password，系统将自动生成一个随机复杂密码。
    管理员重置密码后，用户需要在下次登录时强制修改密码。
    """
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

    # 确定使用的密码：系统生成或用户提供
    generated_password = None
    if password_data is None or password_data.new_password is None:
        # 系统自动生成随机复杂密码
        new_password = generate_random_password(12)
        generated_password = new_password
    else:
        new_password = password_data.new_password
        # 验证用户提供的密码强度
        await validate_password_complexity(new_password, user.username, db)

    # 更新密码
    user.hashed_password = get_password_hash(new_password)
    user.must_change_password = True  # 设置首次登录修改密码标记
    # 注意：不更新 password_changed_at，因为这是管理员操作，不是用户自己修改

    # 记录审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="user",
        entity_id=user_id,
        action="reset_password",
        details={
            "target_username": user.username,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "auto_generated": generated_password is not None
        },
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_log)

    await db.commit()

    # 返回结果，如果是系统生成的密码则返回给管理员
    return {
        "message": "密码重置成功，用户下次登录需要修改密码",
        "generated_password": generated_password
    }


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
    delete_data: UserDelete,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除用户（系统管理员）
    
    删除用户时需要填写理由，并输入当前登录用户的用户名密码验证。
    """
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
    
    # 验证审计信息
    if not delete_data.audit_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请填写删除理由"
        )
    
    if not await verify_audit_credentials(
        db, current_user,
        delete_data.audit_username,
        delete_data.audit_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码验证失败"
        )
    
    # 记录审计日志（在删除前记录）
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="user",
        entity_id=user_id,
        action="delete",
        details={
            "reason": delete_data.audit_reason,
            "deleted_username": user.username,
            "deleted_full_name": user.full_name,
            "deleted_email": user.email,
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit_log)
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "用户已删除"}
