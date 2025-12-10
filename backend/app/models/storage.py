from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, Float, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class StorageFreezer(Base):
    """冰箱/存储设备模型"""
    __tablename__ = "storage_freezers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # 设备名称/编号
    barcode = Column(String, unique=True, nullable=True)  # 设备条码
    location = Column(String, nullable=True)  # 物理位置 (e.g. 房间号)
    temperature = Column(Float, nullable=True)  # 设定温度
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # 结构配置
    total_shelves = Column(Integer, default=0)  # 层数
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    shelves = relationship("StorageShelf", back_populates="freezer", cascade="all, delete-orphan")


class StorageShelf(Base):
    """冰箱层级模型"""
    __tablename__ = "storage_shelves"

    id = Column(Integer, primary_key=True, index=True)
    freezer_id = Column(Integer, ForeignKey("storage_freezers.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g., "Layer 1", "Top Shelf"
    barcode = Column(String, unique=True, nullable=True)  # 层条码
    level_order = Column(Integer, nullable=False)  # 排序顺序
    
    # 关系
    freezer = relationship("StorageFreezer", back_populates="shelves")
    racks = relationship("StorageRack", back_populates="shelf", cascade="all, delete-orphan")


class StorageRack(Base):
    """架子模型"""
    __tablename__ = "storage_racks"

    id = Column(Integer, primary_key=True, index=True)
    shelf_id = Column(Integer, ForeignKey("storage_shelves.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g., "Rack A"
    barcode = Column(String, unique=True, nullable=True) # 架子条码
    
    # 容量配置 (可选)
    row_capacity = Column(Integer, nullable=True)
    col_capacity = Column(Integer, nullable=True)
    
    # 关系
    shelf = relationship("StorageShelf", back_populates="racks")
    boxes = relationship("StorageBox", back_populates="rack")


class StorageBox(Base):
    """样本盒模型"""
    __tablename__ = "storage_boxes"

    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("storage_racks.id"), nullable=True) # 可以暂时不在架子上
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True) # 绑定项目
    
    name = Column(String, nullable=False) # 盒子名称
    barcode = Column(String, unique=True, nullable=False) # 盒子条码
    box_type = Column(String, nullable=True) # e.g. "9x9", "10x10"
    
    # 规格
    rows = Column(Integer, default=9)
    cols = Column(Integer, default=9)
    
    # 状态
    status = Column(String, default="active") # active, archived, destroyed
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # 关系
    rack = relationship("StorageRack", back_populates="boxes")
    project = relationship("Project")
    # samples 关系通常在 Sample 模型中定义 backref 或者这里定义 relationship
    # samples = relationship("Sample", back_populates="box")

