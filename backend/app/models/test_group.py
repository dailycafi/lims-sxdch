from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class TestGroup(Base):
    """试验组模型 - 一个项目可以有多个试验组"""
    __tablename__ = "test_groups"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    
    # 基本信息
    name = Column(String, nullable=True)  # 试验组名称（可选）
    cycle = Column(String, nullable=True)  # 周期（从全局参数选择）
    dosage = Column(String, nullable=True)  # 剂量（手动输入）
    
    # 受试者编号配置
    planned_count = Column(Integer, default=0)  # 计划例数
    subject_prefix = Column(String, nullable=True)  # 受试者编号前缀（如 R）
    subject_start_number = Column(Integer, default=1)  # 起始编号（如 1 表示 001）

    # 备用人员编号配置（与受试者编号规则相同结构）
    backup_subject_prefix = Column(String, nullable=True)  # 备用人员编号前缀（如 B）
    backup_subject_start_number = Column(Integer, default=1)  # 备用人员起始编号
    backup_subject_count = Column(Integer, default=0)  # 备用人员数量
    
    # 检测配置（支持多个检测类型）
    # 格式: [{"test_type": "PK", "sample_type": "血浆", "primary_sets": 4, "backup_sets": 2}, ...]
    detection_configs = Column(JSON, nullable=True)  # 检测配置列表
    
    # 采集点配置（JSON 存储）
    # 格式: [{"code": "C1", "name": "D1-0h"}, {"code": "C2", "name": "D1-1h"}, ...]
    collection_points = Column(JSON, nullable=True)
    
    # 状态
    is_confirmed = Column(Boolean, default=False)  # 是否已确认（确认后锁定）
    confirmed_at = Column(DateTime(timezone=True), nullable=True)  # 确认时间
    confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # 确认人
    
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)  # 显示排序
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 关系
    project = relationship("Project", back_populates="test_groups")
    creator = relationship("User", foreign_keys=[created_by])
    confirmer = relationship("User", foreign_keys=[confirmed_by])


class CollectionPoint(Base):
    """采集点/采血点模型 - 全局采集点配置"""
    __tablename__ = "collection_points"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)  # 关联项目，空则为全局
    
    code = Column(String, nullable=False)  # 采集点代码（如 01, 02）
    name = Column(String, nullable=False)  # 采集点名称（如 给药前, 给药后0.5h）
    time_description = Column(String, nullable=True)  # 时间描述（如 D1 给药前 30min）
    description = Column(Text, nullable=True)  # 描述（保留兼容）
    
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
