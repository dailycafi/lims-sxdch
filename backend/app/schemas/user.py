from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole


class RoleSimple(BaseModel):
    """简单的角色信息"""
    id: int
    code: str
    name: str
    
    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: Optional[UserRole] = None  # 保留用于向后兼容


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role_ids: List[int] = []  # 新增：角色ID列表
    role: Optional[UserRole] = None  # 保留用于向后兼容
    
    @field_validator('role_ids')
    @classmethod
    def validate_role_ids(cls, v):
        if not v or len(v) == 0:
            raise ValueError('用户至少需要分配一个角色')
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    role_ids: Optional[List[int]] = None  # 新增：角色ID列表
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    roles: List[RoleSimple] = []  # 新增：用户的角色列表

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class PasswordChange(BaseModel):
    """修改密码"""
    old_password: str
    new_password: str


class PasswordReset(BaseModel):
    """重置密码（管理员操作）"""
    new_password: str

