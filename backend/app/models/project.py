from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Project(Base):
    """项目模型"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    sponsor_project_code = Column(String, nullable=False)  # 申办方项目编号
    lab_project_code = Column(String, unique=True, nullable=False)  # 临床试验研究室项目编号
    sponsor_id = Column(Integer, ForeignKey("organizations.id"))  # 申办方ID
    clinical_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)  # 临床机构ID (单个，兼容旧版)
    
    # 样本编号规则配置
    sample_code_rule = Column(JSON, nullable=True)  # 存储样本编号规则
    
    # 样本元数据配置 (周期、检测类型等选项字典)
    sample_meta_config = Column(JSON, nullable=True)
    
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

    # 关联的所有组织（包含临床机构等）
    associated_organizations = relationship("ProjectOrganization", back_populates="project", viewonly=True)
    
    # 试验组
    test_groups = relationship("TestGroup", back_populates="project", order_by="TestGroup.display_order")


class ProjectArchiveRequest(Base):
    """项目归档申请"""
    __tablename__ = "project_archive_requests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    reason = Column(Text, nullable=False)  # 归档原因
    completion_summary = Column(Text, nullable=True)  # 项目完成总结
    final_report_path = Column(String, nullable=True)  # 最终报告路径
    
    # 4步审批信息
    # 步骤1: 项目负责人申请（已由requested_by体现）
    
    # 步骤2: 分析测试主管审批
    test_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    test_manager_approved_at = Column(DateTime(timezone=True), nullable=True)
    test_manager_comments = Column(Text, nullable=True)
    test_manager_action = Column(String, nullable=True)  # approve, reject
    
    # 步骤3: QA审批
    qa_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    qa_approved_at = Column(DateTime(timezone=True), nullable=True)
    qa_comments = Column(Text, nullable=True)
    qa_action = Column(String, nullable=True)  # approve, reject
    
    # 步骤4: 计算机管理员执行归档
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_executed_at = Column(DateTime(timezone=True), nullable=True)
    admin_comments = Column(Text, nullable=True)
    
    # 状态
    status = Column(String, default="pending_manager")  # pending_manager, pending_qa, pending_admin, archived, rejected
    current_step = Column(Integer, default=2)  # 2-4的步骤（1是申请）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    project = relationship("Project")
    requester = relationship("User", foreign_keys=[requested_by])
    test_manager = relationship("User", foreign_keys=[test_manager_id])
    qa_user = relationship("User", foreign_keys=[qa_id])
    admin_user = relationship("User", foreign_keys=[admin_id])
