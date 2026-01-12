from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class LabelConfig(Base):
    """标签配置模型"""
    __tablename__ = "label_configs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    label_type = Column(String, nullable=False)  # sampling_tube: 采样管, cryo_tube: 冻存管
    name = Column(String, nullable=False)  # 配置名称
    
    # 编号规则配置 - 存储选项数组
    config = Column(JSON, nullable=True)  # 存储各个选项的配置
    separator = Column(String, default="-")  # 选项之间的分隔符，默认为"-"，空字符串表示无分隔符
    
    # 标签打印设置
    label_width = Column(Integer, default=50)  # 标签宽度 mm
    label_height = Column(Integer, default=30)  # 标签高度 mm
    font_size = Column(Integer, default=12)  # 字体大小
    barcode_enabled = Column(Boolean, default=True)  # 是否显示条形码
    qrcode_enabled = Column(Boolean, default=False)  # 是否显示二维码
    
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 关系
    project = relationship("Project")
    creator = relationship("User", foreign_keys=[created_by])


class LabelBatch(Base):
    """标签批次记录 - 记录每次生成的标签批次"""
    __tablename__ = "label_batches"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    config_id = Column(Integer, ForeignKey("label_configs.id"), nullable=True)
    batch_code = Column(String, unique=True, nullable=False)  # 批次编号
    label_type = Column(String, nullable=False)  # sampling_tube, cryo_tube
    
    # 生成参数
    generation_params = Column(JSON, nullable=True)  # 存储生成时选择的参数
    
    # 统计信息
    total_count = Column(Integer, default=0)  # 生成的标签总数
    printed_count = Column(Integer, default=0)  # 已打印数量
    
    status = Column(String, default="generated")  # generated, printed, partial_printed
    
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    project = relationship("Project")
    config = relationship("LabelConfig")
    generator = relationship("User", foreign_keys=[generated_by])
    labels = relationship("Label", back_populates="batch")


class Label(Base):
    """标签记录"""
    __tablename__ = "labels"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("label_batches.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    label_code = Column(String, nullable=False, index=True)  # 标签编号（用于显示）
    internal_code = Column(String, nullable=True, index=True)  # 系统内部编号（当显示编号有空值时使用）
    label_type = Column(String, nullable=False)  # sampling_tube, cryo_tube
    
    # 标签内容组成部分
    components = Column(JSON, nullable=True)  # 存储编号各部分的值
    display_components = Column(JSON, nullable=True)  # 存储用于显示的值（空值显示为下划线）
    
    # 打印状态
    is_printed = Column(Boolean, default=False)
    printed_at = Column(DateTime(timezone=True), nullable=True)
    printed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    print_count = Column(Integer, default=0)  # 打印次数
    
    # 关联样本（如果已使用）
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    batch = relationship("LabelBatch", back_populates="labels")
    project = relationship("Project")
    printer = relationship("User", foreign_keys=[printed_by])
    sample = relationship("Sample")
