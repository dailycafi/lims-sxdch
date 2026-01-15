"""角色和权限相关的Pydantic模型"""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class PermissionBase(BaseModel):
    """权限基础模型"""
    code: str
    name: str
    description: Optional[str] = None
    module: str


class PermissionCreate(PermissionBase):
    """创建权限"""
    pass


class PermissionResponse(PermissionBase):
    """权限响应模型"""
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    """角色基础模型"""
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool = True


class RoleCreate(BaseModel):
    """创建角色"""
    code: Optional[str] = None  # 可选，如果不提供则自动生成
    name: str
    description: Optional[str] = None
    is_active: bool = True
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    """更新角色"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    permission_ids: Optional[List[int]] = None
    # 电子签名验证字段
    audit_reason: str  # 操作原因（必填）
    username: str  # 用户名（必填）
    password: str  # 密码（必填）


class RoleDeleteRequest(BaseModel):
    """删除角色请求"""
    audit_reason: str  # 操作原因（必填）
    username: str  # 用户名（必填）
    password: str  # 密码（必填）


class RoleResponse(RoleBase):
    """角色响应模型"""
    id: int
    is_system: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    permissions: List[PermissionResponse] = []
    
    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    """角色列表响应（不包含权限详情）"""
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_system: bool
    is_active: bool
    created_at: datetime
    permission_count: int = 0
    
    class Config:
        from_attributes = True

