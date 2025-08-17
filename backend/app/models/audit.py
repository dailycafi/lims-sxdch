from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    """审计日志模型"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String, nullable=False)  # 冗余存储用户名
    action = Column(String, nullable=False)  # 操作类型
    module = Column(String, nullable=False)  # 模块名称
    record_type = Column(String, nullable=True)  # 记录类型
    record_id = Column(String, nullable=True)  # 记录ID
    old_value = Column(Text, nullable=True)  # 旧值（JSON格式）
    new_value = Column(Text, nullable=True)  # 新值（JSON格式）
    reason = Column(Text, nullable=True)  # 操作理由
    ip_address = Column(String, nullable=True)  # IP地址
    user_agent = Column(String, nullable=True)  # 用户代理
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    user = relationship("User")
