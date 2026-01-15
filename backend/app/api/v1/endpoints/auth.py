from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_token,
    generate_refresh_token,
    get_refresh_token_expiry,
    hash_refresh_token,
    pwd_context,
    verify_password,
)
from app.models.user import User
from app.models.global_params import SystemSetting
from app.models.audit import AuditLog
from app.models.auth import RefreshToken
from app.schemas.token import LogoutRequest, RefreshTokenRequest, Token
from app.schemas.user import UserResponse

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db)
) -> User:
    """获取当前用户"""
    import logging
    logger = logging.getLogger(__name__)
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    
    if payload is None:
        logger.warning(f"[Auth] Token validation failed - payload is None")
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被禁用"
        )
    
    return user


async def get_current_active_superuser(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """获取当前超级用户"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="权限不足"
        )
    return current_user


# Helpers

REFRESH_TOKEN_EXPIRE_SECONDS = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


async def get_token_expiration(db: AsyncSession) -> tuple[timedelta, int]:
    """从数据库获取访问令牌过期时间，默认为配置文件的设置"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "session_timeout"))
    setting = result.scalar_one_or_none()
    
    # setting.value 是 JSON 字段，可能是 int、float 或其他类型
    minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # 默认值
    if setting and setting.value is not None:
        try:
            # 尝试转换为整数
            minutes = int(setting.value)
            if minutes <= 0:
                minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        except (ValueError, TypeError):
            pass
    
    delta = timedelta(minutes=minutes)
    return delta, int(delta.total_seconds())


async def _issue_token_pair(
    db: AsyncSession,
    user: User,
    parent_token: Optional[RefreshToken] = None,
) -> tuple[str, str, int]:
    """Create a new access/refresh token pair and persist refresh token state."""
    
    expire_delta, expires_in = await get_token_expiration(db)

    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role.value},
        expires_delta=expire_delta,
    )

    refresh_token_plain = generate_refresh_token()
    refresh_token_record = RefreshToken(
        token_hash=hash_refresh_token(refresh_token_plain),
        user_id=user.id,
        expires_at=get_refresh_token_expiry(),
        parent=parent_token,
    )

    if parent_token:
        parent_token.revoked = True
        parent_token.revoked_at = datetime.now(timezone.utc)

    db.add(refresh_token_record)
    await db.flush()

    return access_token, refresh_token_plain, expires_in


PASSWORD_EXPIRE_DAYS = 90  # 密码过期天数


def check_password_expired(user: User) -> bool:
    """检查密码是否过期（超过90天）"""
    if user.password_changed_at is None:
        # 如果没有密码修改记录，检查创建时间
        # 但如果 must_change_password 为 True，则不算过期（等待首次登录修改）
        if user.must_change_password:
            return False
        # 使用创建时间判断
        created_at = user.created_at
        if created_at and created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at and (datetime.now(timezone.utc) - created_at).days >= PASSWORD_EXPIRE_DAYS:
            return True
        return False
    
    password_changed_at = user.password_changed_at
    if password_changed_at.tzinfo is None:
        password_changed_at = password_changed_at.replace(tzinfo=timezone.utc)
    
    return (datetime.now(timezone.utc) - password_changed_at).days >= PASSWORD_EXPIRE_DAYS


class LoginToken(Token):
    """登录响应，包含密码状态信息"""
    must_change_password: bool = False  # 是否需要修改密码（首次登录或密码过期）
    password_expired: bool = False  # 密码是否过期


@router.post("/login", response_model=LoginToken)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    """用户登录
    
    返回中包含 must_change_password 字段：
    - 如果为 True，前端需要强制用户修改密码
    - password_expired 表示密码是否因为超过90天而过期
    """
    # ... existing user lookup code ...
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户已被禁用"
        )
    
    # 检查密码是否过期
    password_expired = check_password_expired(user)
    must_change_password = user.must_change_password or password_expired
    
    # 废弃当前用户已有的 refresh token，避免旧会话继续使用
    existing_tokens_result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
    )
    for token_record in existing_tokens_result.scalars().all():
        token_record.revoked = True
        token_record.revoked_at = datetime.now(timezone.utc)

    access_token, refresh_token, expires_in = await _issue_token_pair(db, user)

    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "refresh_expires_in": REFRESH_TOKEN_EXPIRE_SECONDS,
        "must_change_password": must_change_password,
        "password_expired": password_expired,
    }


@router.post("/verify-signature")
async def verify_signature(
    signature_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """验证电子签名（密码验证）"""
    password = signature_data.get("password")
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码不能为空"
        )
    
    # 验证用户密码
    if not pwd_context.verify(password, current_user.hashed_password):
        # 记录失败的签名尝试
        audit_log = AuditLog(
            user_id=current_user.id,
            entity_type="e_signature",
            entity_id=current_user.id,
            action="verify_failed",
            details={
                "timestamp": datetime.utcnow().isoformat(),
                "ip_address": signature_data.get("ip_address", "unknown")
            },
            timestamp=datetime.utcnow()
        )
        db.add(audit_log)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="密码验证失败"
        )
    
    # 记录成功的签名验证
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="e_signature",
        entity_id=current_user.id,
        action="verify_success",
        details={
            "timestamp": datetime.utcnow().isoformat(),
            "purpose": signature_data.get("purpose", "general")
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "verified": True,
        "user_id": current_user.id,
        "username": current_user.username,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)]
):
    """获取当前用户信息"""
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    payload: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """使用 refresh token 换取新的访问令牌"""

    hashed_token = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hashed_token)
    )
    stored_refresh = result.scalar_one_or_none()

    if not stored_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token 不存在"
        )

    # 检查是否已被撤销
    if stored_refresh.revoked:
        # 宽限期处理：如果是最近30秒内被撤销的，允许再次刷新（解决并发刷新导致的掉线问题）
        grace_period = timedelta(seconds=30)
        now = datetime.now(timezone.utc)
        
        # 确保时间比较是时区一致的
        revoked_at = stored_refresh.revoked_at
        if revoked_at and revoked_at.tzinfo is None:
            revoked_at = revoked_at.replace(tzinfo=timezone.utc)
            
        if not revoked_at or (now - revoked_at) > grace_period:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token 已被撤销"
            )

    # 检查是否过期
    expires_at = stored_refresh.expires_at
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if expires_at <= datetime.now(timezone.utc):
        stored_refresh.revoked = True
        stored_refresh.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token 已过期"
        )

    user = await db.get(User, stored_refresh.user_id)
    if not user or not user.is_active:
        stored_refresh.revoked = True
        stored_refresh.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户已被禁用"
        )

    access_token, refresh_token, expires_in = await _issue_token_pair(db, user, parent_token=stored_refresh)

    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in,
        "refresh_expires_in": REFRESH_TOKEN_EXPIRE_SECONDS,
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: LogoutRequest,
    db: AsyncSession = Depends(get_db)
):
    """显式注销：撤销当前 refresh token"""

    hashed_token = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hashed_token)
    )
    stored_refresh = result.scalar_one_or_none()

    if stored_refresh and not stored_refresh.revoked:
        stored_refresh.revoked = True
        stored_refresh.revoked_at = datetime.now(timezone.utc)
        await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
