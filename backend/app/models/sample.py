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


class SampleReceiveRecord(Base):
    """样本接收记录"""
    __tablename__ = "sample_receive_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    clinical_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    transport_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    transport_method = Column(String, nullable=False)
    temperature_monitor_id = Column(String, nullable=False)
    temperature_file_path = Column(String, nullable=True)  # 温度数据文件路径
    sample_count = Column(Integer, nullable=False)
    sample_status = Column(String, nullable=False)  # 样本状态：完好、破损等
    storage_location = Column(String, nullable=True)  # 暂存位置
    express_photos = Column(Text, nullable=True)  # 快递单照片路径（JSON数组）
    
    received_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default="pending")  # pending, in_progress, completed
    
    # 关系
    project = relationship("Project")
    clinical_org = relationship("Organization", foreign_keys=[clinical_org_id])
    transport_org = relationship("Organization", foreign_keys=[transport_org_id])
    receiver = relationship("User")


class SampleBorrowRequest(Base):
    """样本领用申请"""
    __tablename__ = "sample_borrow_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String, unique=True, nullable=False)  # 申请编号
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    purpose = Column(String, nullable=False)  # 用途：first_test, retest, isr
    target_location = Column(String, nullable=False)  # 目标位置
    target_date = Column(DateTime(timezone=True), nullable=False)  # 目标时间
    notes = Column(Text, nullable=True)  # 备注
    
    status = Column(String, default="pending")  # pending, approved, borrowed, returned, partial_returned
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    project = relationship("Project")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    samples = relationship("SampleBorrowItem", back_populates="request")


class SampleBorrowItem(Base):
    """样本领用明细"""
    __tablename__ = "sample_borrow_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("sample_borrow_requests.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    
    borrowed_at = Column(DateTime(timezone=True), nullable=True)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    return_status = Column(String, nullable=True)  # good, damaged, lost
    
    # 关系
    request = relationship("SampleBorrowRequest", back_populates="samples")
    sample = relationship("Sample")


class SampleTransferRecord(Base):
    """样本转移记录"""
    __tablename__ = "sample_transfer_records"

    id = Column(Integer, primary_key=True, index=True)
    transfer_code = Column(String, unique=True, nullable=False)  # 转移编号
    transfer_type = Column(String, nullable=False)  # internal, external
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # 转移信息
    from_location = Column(String, nullable=False)
    to_location = Column(String, nullable=False)
    target_org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)  # 外部转移时的目标组织
    
    transport_method = Column(String, nullable=False)
    temperature_monitor_id = Column(String, nullable=True)
    sample_status = Column(String, nullable=True)
    
    # 审批文件（外部转移）
    approval_file_path = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # 状态和时间
    status = Column(String, default="pending")  # pending, approved, in_transit, completed
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    project = relationship("Project")
    target_org = relationship("Organization")
    requester = relationship("User")
    samples = relationship("SampleTransferItem", back_populates="transfer")


class SampleTransferItem(Base):
    """样本转移明细"""
    __tablename__ = "sample_transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("sample_transfer_records.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    
    transferred_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    transfer = relationship("SampleTransferRecord", back_populates="samples")
    sample = relationship("Sample")


class SampleDestroyRequest(Base):
    """样本销毁申请"""
    __tablename__ = "sample_destroy_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String, unique=True, nullable=False)  # 申请编号
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    reason = Column(Text, nullable=False)  # 销毁原因
    approval_file_path = Column(String, nullable=True)  # 申办方批准文件
    notes = Column(Text, nullable=True)  # 备注
    
    # 审批状态
    status = Column(String, default="pending")  # pending, test_manager_approved, director_approved, ready, completed, rejected
    
    # 审批记录
    test_manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    test_manager_approved_at = Column(DateTime(timezone=True), nullable=True)
    test_manager_comments = Column(Text, nullable=True)
    
    director_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    director_approved_at = Column(DateTime(timezone=True), nullable=True)
    director_comments = Column(Text, nullable=True)
    
    # 执行记录
    executed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    project = relationship("Project")
    requester = relationship("User", foreign_keys=[requested_by])
    test_manager = relationship("User", foreign_keys=[test_manager_id])
    director = relationship("User", foreign_keys=[director_id])
    executor = relationship("User", foreign_keys=[executed_by])
    samples = relationship("SampleDestroyItem", back_populates="request")


class SampleDestroyItem(Base):
    """样本销毁明细"""
    __tablename__ = "sample_destroy_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("sample_destroy_requests.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    
    destroyed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    request = relationship("SampleDestroyRequest", back_populates="samples")
    sample = relationship("Sample")
