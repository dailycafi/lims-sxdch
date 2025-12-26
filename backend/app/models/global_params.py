from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Organization(Base):
    """组织/机构模型"""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # 关联项目，空则为全局
    name = Column(String, nullable=False)
    org_type = Column(String, nullable=False)  # sponsor, clinical, testing, transport
    address = Column(Text, nullable=True)
    contact_person = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    project = relationship("Project", backref="organizations", foreign_keys=[project_id])

    __table_args__ = (
        UniqueConstraint('name', 'project_id', name='uq_org_name_project'),
    )


class SampleType(Base):
    """样本类型配置模型"""
    __tablename__ = "sample_types"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # 关联项目
    category = Column(String, default="clinical")  # clinical, stability, qc
    cycle_group = Column(String, nullable=True)  # 周期/组别 (临床用)
    test_type = Column(String, nullable=True)  # 检测类型 (通用)
    code = Column(String, nullable=True)  # 代码 (STB/QC用)
    primary_count = Column(Integer, default=1)  # 正份数量 (临床用)
    backup_count = Column(Integer, default=1)  # 备份数量 (临床用)
    purpose = Column(String, nullable=True)  # 用途 (临床用)
    transport_method = Column(String, nullable=True)  # 运输方式 (临床用)
    status = Column(String, nullable=True)  # 状态 (临床用)
    special_notes = Column(Text, nullable=True)  # 特殊事项 (通用)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class GlobalConfiguration(Base):
    """全局配置模型 - 供项目选择的配置集"""
    __tablename__ = "global_configurations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False) # 配置名称，如 "默认临床试验配置"
    category = Column(String, nullable=False) # e.g. "sample_meta", "workflow", "label_template"
    
    # 配置内容
    config_data = Column(JSON, nullable=False)
    
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SystemSetting(Base):
    """系统设置模型"""
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
