from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON, Text
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
    archived_at = Column(DateTime(timezone=True), nullable=True)  # 归档时间
    status = Column(String, default="active")  # active, pending_archive, archived
    
    # 关系
    sponsor = relationship("Organization", foreign_keys=[sponsor_id])
    clinical_org = relationship("Organization", foreign_keys=[clinical_org_id])
    creator = relationship("User", foreign_keys=[created_by])


class ProjectArchiveRequest(Base):
    """项目归档申请"""
    __tablename__ = "project_archive_requests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    reason = Column(Text, nullable=False)  # 归档原因
    completion_summary = Column(Text, nullable=True)  # 项目完成总结
    final_report_path = Column(String, nullable=True)  # 最终报告路径
    
    # 审批信息
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approval_comments = Column(Text, nullable=True)
    
    # 状态
    status = Column(String, default="pending")  # pending, approved, rejected, executed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    project = relationship("Project")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
