import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from app.core.config import settings

_BCRYPT_MAX_PASSWORD_BYTES = 72
_BCRYPT_ROUNDS = 12


def _bcrypt_password_bytes(password: str) -> bytes:
    """
    bcrypt 仅使用前 72 bytes；bcrypt 4.x 对更长输入会抛 ValueError。
    为兼容并避免运行时崩溃，这里统一截断到 72 bytes。
    """
    if password is None:
        return b""
    pw = password.encode("utf-8")
    return pw[:_BCRYPT_MAX_PASSWORD_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            _bcrypt_password_bytes(plain_password),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """获取密码哈希值"""
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(_bcrypt_password_bytes(password), salt)
    return hashed.decode("utf-8")


class _PwdContextCompat:
    """
    向后兼容：历史代码通过 `pwd_context.hash()` / `pwd_context.verify()` 调用。
    这里提供同名接口，内部委托给当前模块的 bcrypt 实现。
    """

    def hash(self, secret: str, **kwargs) -> str:  # noqa: ARG002
        return get_password_hash(secret)

    def verify(self, secret: str, hash: str, **kwargs) -> bool:  # noqa: A002,ARG002
        return verify_password(secret, hash)


# 兼容旧代码导入：from app.core.security import pwd_context
pwd_context = _PwdContextCompat()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """解码令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"[Security] Token decode failed: {type(e).__name__}: {e}")
        return None


def generate_refresh_token() -> str:
    """生成随机 refresh token 字符串"""
    return secrets.token_urlsafe(48)


def get_refresh_token_expiry() -> datetime:
    """计算 refresh token 过期时间（使用 timezone-aware datetime）"""
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


def hash_refresh_token(token: str) -> str:
    """使用 SHA-256 对 refresh token 进行哈希，避免明文存储"""
    return hashlib.sha256(token.encode()).hexdigest()
