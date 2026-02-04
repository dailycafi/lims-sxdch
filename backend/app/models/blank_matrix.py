"""空白基质样本模型"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Numeric, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class BlankMatrixStatus(str, enum.Enum):
    """空白基质状态枚举"""
    PENDING = "pending"  # 待清点
    INVENTORIED = "inventoried"  # 已清点
    IN_STORAGE = "in_storage"  # 在库
    BORROWED = "borrowed"  # 已领用
    TRANSFERRED = "transferred"  # 已转移
    DESTROYED = "destroyed"  # 已销毁


class AnticoagulantType(str, enum.Enum):
    """抗凝剂类型枚举"""
    EDTA = "EDTA"
    HEPARIN_SODIUM = "heparin_sodium"  # 肝素钠
    SODIUM_CITRATE = "sodium_citrate"  # 枸橼酸钠


class MatrixType(str, enum.Enum):
    """基质类型枚举"""
    WHOLE_BLOOD = "whole_blood"  # 全血
    PLASMA = "plasma"  # 血浆
    SERUM = "serum"  # 血清
    URINE = "urine"  # 尿液
    FECES = "feces"  # 粪便
    CSF = "csf"  # 脑脊液
    OTHER = "other"  # 其它


class BlankMatrixReceiveRecord(Base):
    """空白基质接收记录"""
    __tablename__ = "blank_matrix_receive_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # 来源信息
    source_name = Column(String, nullable=False)  # 来源名称
    source_contact = Column(String, nullable=True)  # 联系人
    source_phone = Column(String, nullable=True)  # 联系电话

    # 文件上传路径（JSON数组存储多个文件路径）
    consent_files = Column(JSON, nullable=True)  # 知情同意书
    ethics_files = Column(JSON, nullable=True)  # 伦理批件
    medical_report_files = Column(JSON, nullable=True)  # 体检报告扫描件

    # 基质类型选择
    anticoagulants = Column(JSON, nullable=False)  # 抗凝剂类型（复选框）: ["EDTA", "heparin_sodium", "sodium_citrate"]
    matrix_type = Column(String, nullable=False)  # 基质类型（下拉菜单）
    matrix_type_other = Column(String, nullable=True)  # 其它类型说明

    # 接收信息
    received_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(String, default="pending")  # pending, in_progress, completed
    notes = Column(Text, nullable=True)  # 备注

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    project = relationship("Project")
    receiver = relationship("User")
    samples = relationship("BlankMatrixSample", back_populates="receive_record")


class BlankMatrixSample(Base):
    """空白基质样本"""
    __tablename__ = "blank_matrix_samples"

    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String, unique=True, nullable=False, index=True)  # 样本编号 (e.g., CRC-BP-26001-E-05)
    barcode = Column(String, unique=True, nullable=True)  # 条形码

    receive_record_id = Column(Integer, ForeignKey("blank_matrix_receive_records.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # 基质信息
    anticoagulant = Column(String, nullable=True)  # 抗凝剂类型（单个）
    matrix_type = Column(String, nullable=False)  # 基质类型

    # 容量信息
    edta_volume = Column(Numeric(10, 2), nullable=True)  # EDTA 容量(mL)
    heparin_volume = Column(Numeric(10, 2), nullable=True)  # 肝素钠容量(mL)
    citrate_volume = Column(Numeric(10, 2), nullable=True)  # 枸橼酸钠容量(mL)
    total_volume = Column(Numeric(10, 2), nullable=True)  # 总容量(mL)

    # 状态
    status = Column(String, default=BlankMatrixStatus.PENDING.value)
    special_notes = Column(Text, nullable=True)  # 特殊事项

    # 存储位置
    freezer_id = Column(String, nullable=True)
    shelf_level = Column(String, nullable=True)
    rack_position = Column(String, nullable=True)
    box_code = Column(String, nullable=True)
    box_id = Column(Integer, ForeignKey("storage_boxes.id"), nullable=True)
    position_in_box = Column(String, nullable=True)

    # 清点信息
    inventoried_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    inventoried_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    receive_record = relationship("BlankMatrixReceiveRecord", back_populates="samples")
    project = relationship("Project")
    inventorier = relationship("User", foreign_keys=[inventoried_by])
    box = relationship("app.models.storage.StorageBox")


class BlankMatrixBorrowRequest(Base):
    """空白基质领用申请"""
    __tablename__ = "blank_matrix_borrow_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_code = Column(String, unique=True, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    purpose = Column(String, nullable=False)  # 用途
    target_location = Column(String, nullable=False)
    target_date = Column(DateTime(timezone=True), nullable=False)
    notes = Column(Text, nullable=True)

    status = Column(String, default="pending")  # pending, approved, borrowed, returned
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    project = relationship("Project")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    items = relationship("BlankMatrixBorrowItem", back_populates="request")


class BlankMatrixBorrowItem(Base):
    """空白基质领用明细"""
    __tablename__ = "blank_matrix_borrow_items"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("blank_matrix_borrow_requests.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("blank_matrix_samples.id"), nullable=False)

    borrowed_at = Column(DateTime(timezone=True), nullable=True)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    return_status = Column(String, nullable=True)  # good, damaged, lost

    # 关系
    request = relationship("BlankMatrixBorrowRequest", back_populates="items")
    sample = relationship("BlankMatrixSample")
