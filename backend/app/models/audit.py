from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AuditLog(Base):
    """审计日志模型"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    entity_type = Column(String, nullable=False)  # 实体类型：organization, sample_type, project等
    entity_id = Column(Integer, nullable=False)  # 实体ID
    action = Column(String, nullable=False)  # 操作类型：create, update, delete等
    details = Column(JSON, nullable=True)  # 详细信息（JSON格式）
    reason = Column(Text, nullable=True)  # 操作理由（主要用于更新操作）
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    user = relationship("User", back_populates="audit_logs")
