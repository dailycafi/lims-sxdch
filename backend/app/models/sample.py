from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SampleStatus(str, enum.Enum):
    """样本状态枚举"""
    PENDING = "pending"  # 待接收
    RECEIVED = "received"  # 已接收
    IN_STORAGE = "in_storage"  # 在库
    CHECKED_OUT = "checked_out"  # 已领用
    TRANSFERRED = "transferred"  # 已转移
    DESTROYED = "destroyed"  # 已销毁
    RETURNED = "returned"  # 已归还


class SamplePurpose(str, enum.Enum):
    """样本用途枚举"""
    FIRST_TEST = "first_test"  # 首次检测
    RETEST = "retest"  # 重测
    ISR = "isr"  # ISR测试
    STABILITY = "stability"  # 稳定性测试
    QC = "qc"  # 质控


class Sample(Base):
    """样本模型"""
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String, unique=True, nullable=False, index=True)  # 样本编号
    barcode = Column(String, unique=True, nullable=True)  # 条形码
    
    project_id = Column(Integer, ForeignKey("projects.id"))
    subject_code = Column(String, nullable=True)  # 受试者编号
    test_type = Column(String, nullable=True)  # 检测类型
    collection_time = Column(String, nullable=True)  # 采血时间
    collection_seq = Column(String, nullable=True)  # 采血序号
    cycle_group = Column(String, nullable=True)  # 周期/组别
    is_primary = Column(Boolean, default=True)  # 是否正份（False为备份）
    
    status = Column(Enum(SampleStatus), default=SampleStatus.PENDING)
    purpose = Column(Enum(SamplePurpose), nullable=True)
    
    # 存储位置信息
    freezer_id = Column(String, nullable=True)  # 冰箱编号
    shelf_level = Column(String, nullable=True)  # 层
    rack_position = Column(String, nullable=True)  # 架子位置
    box_code = Column(String, nullable=True)  # 样本盒编号
    position_in_box = Column(String, nullable=True)  # 盒内位置
    
    # 其他信息
    transport_condition = Column(String, nullable=True)  # 运输条件
    special_notes = Column(Text, nullable=True)  # 特殊事项
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    project = relationship("Project")
