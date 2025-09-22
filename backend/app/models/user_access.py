from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserAccessLog(Base):
    """用户访问记录模型"""
    __tablename__ = "user_access_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    path = Column(String, nullable=False)  # 访问的路径，如 /samples, /projects
    title = Column(String, nullable=False)  # 页面标题，如 "样本管理", "项目管理"
    icon = Column(String, nullable=True)  # 图标名称
    method = Column(String, default="GET")  # HTTP方法
    user_agent = Column(Text, nullable=True)  # 用户代理
    ip_address = Column(String, nullable=True)  # IP地址
    access_count = Column(Integer, default=1)  # 访问次数
    last_accessed_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    user = relationship("User", backref="access_logs")
