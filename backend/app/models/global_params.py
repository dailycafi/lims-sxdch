from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Organization(Base):
    """组织/机构模型"""
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    org_type = Column(String, nullable=False)  # sponsor, clinical, testing, transport
    address = Column(Text, nullable=True)
    contact_person = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class SampleType(Base):
    """样本类型配置模型"""
    __tablename__ = "sample_types"

    id = Column(Integer, primary_key=True, index=True)
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
