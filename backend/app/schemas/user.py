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
    password: Optional[str] = None  # 可选，不提供则系统自动生成
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
    # 审计验证字段
    audit_reason: Optional[str] = None  # 修改理由
    audit_username: Optional[str] = None  # 验证用户名
    audit_password: Optional[str] = None  # 验证密码


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    must_change_password: bool = False  # 是否需要修改密码
    password_changed_at: Optional[datetime] = None  # 密码最后修改时间
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
    new_password: Optional[str] = None  # 可选，不提供则系统自动生成


class PasswordResetResponse(BaseModel):
    """重置密码响应"""
    message: str
    generated_password: Optional[str] = None  # 系统生成的密码（仅在自动生成时返回）


class UserDelete(BaseModel):
    """删除用户请求"""
    audit_reason: str  # 删除理由
    audit_username: str  # 验证用户名
    audit_password: str  # 验证密码

