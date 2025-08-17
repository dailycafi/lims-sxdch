from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    """项目模型"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    sponsor_project_code = Column(String, nullable=False)  # 申办者项目编号
    lab_project_code = Column(String, unique=True, nullable=False)  # 临床试验研究室项目编号
    sponsor_id = Column(Integer, ForeignKey("organizations.id"))  # 申办者ID
    clinical_org_id = Column(Integer, ForeignKey("organizations.id"))  # 临床机构ID
    
    # 样本编号规则配置
    sample_code_rule = Column(JSON, nullable=True)  # 存储样本编号规则
    
    is_active = Column(Boolean, default=True)
    is_archived = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    sponsor = relationship("Organization", foreign_keys=[sponsor_id])
    clinical_org = relationship("Organization", foreign_keys=[clinical_org_id])
    creator = relationship("User", foreign_keys=[created_by])
