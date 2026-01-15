from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    """用户角色枚举（保留用于向后兼容）"""
    SUPER_ADMIN = "super_admin"  # 超级管理员（调试用，可删除任何记录）
    SYSTEM_ADMIN = "system_admin"  # 系统管理员
    LAB_DIRECTOR = "lab_director"  # 研究室主任
    TEST_MANAGER = "test_manager"  # 分析测试主管
    SAMPLE_ADMIN = "sample_admin"  # 样本管理员
    PROJECT_LEAD = "project_lead"  # 项目负责人
    ANALYST = "analyst"  # 分析测试员
    QA = "qa"  # QA


class User(Base):
    """用户模型"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=True)  # 保留用于向后兼容，可为空
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=False)  # 首次登录需修改密码
    password_changed_at = Column(DateTime(timezone=True), nullable=True)  # 密码最后修改时间
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    audit_logs = relationship("AuditLog", back_populates="user")
    refresh_tokens = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    roles = relationship("Role", secondary="user_roles", back_populates="users", lazy="selectin")
