from datetime import datetime, timedelta
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
    print(f"[DEBUG] get_current_user called")
    print(f"[DEBUG] Received token: {token[:50] if token else 'None'}...")
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    print(f"[DEBUG] Decoded payload: {payload}")
    
    if payload is None:
        print("[DEBUG] Token decode failed")
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

ACCESS_TOKEN_EXPIRE_DELTA = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
ACCESS_TOKEN_EXPIRE_SECONDS = int(ACCESS_TOKEN_EXPIRE_DELTA.total_seconds())
REFRESH_TOKEN_EXPIRE_SECONDS = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60


async def _issue_token_pair(
    db: AsyncSession,
    user: User,
    parent_token: Optional[RefreshToken] = None,
) -> tuple[str, str]:
    """Create a new access/refresh token pair and persist refresh token state."""

    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": user.role.value},
        expires_delta=ACCESS_TOKEN_EXPIRE_DELTA,
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
        parent_token.revoked_at = datetime.utcnow()

    db.add(refresh_token_record)
    await db.flush()

    return access_token, refresh_token_plain


@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: AsyncSession = Depends(get_db)
):
    """用户登录"""
    # 查找用户
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
    
    # 废弃当前用户已有的 refresh token，避免旧会话继续使用
    existing_tokens_result = await db.execute(
        select(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False))
    )
    for token_record in existing_tokens_result.scalars().all():
        token_record.revoked = True
        token_record.revoked_at = datetime.utcnow()

    access_token, refresh_token = await _issue_token_pair(db, user)

    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_SECONDS,
        "refresh_expires_in": REFRESH_TOKEN_EXPIRE_SECONDS,
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

    if not stored_refresh or stored_refresh.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token 无效"
        )

    if stored_refresh.expires_at <= datetime.utcnow():
        stored_refresh.revoked = True
        stored_refresh.revoked_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token 已过期"
        )

    user = await db.get(User, stored_refresh.user_id)
    if not user or not user.is_active:
        stored_refresh.revoked = True
        stored_refresh.revoked_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户已被禁用"
        )

    access_token, refresh_token = await _issue_token_pair(db, user, parent_token=stored_refresh)

    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_SECONDS,
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
        stored_refresh.revoked_at = datetime.utcnow()
        await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
