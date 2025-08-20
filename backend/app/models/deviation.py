from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Deviation(Base):
    """偏差记录"""
    __tablename__ = "deviations"

    id = Column(Integer, primary_key=True, index=True)
    deviation_code = Column(String, unique=True, nullable=False)  # 偏差编号
    title = Column(String, nullable=False)  # 偏差标题
    severity = Column(String, nullable=False)  # 严重程度: minor, major, critical
    category = Column(String, nullable=False)  # 类别: temperature, operation, equipment, sample, process, other
    
    # 偏差内容
    description = Column(Text, nullable=False)  # 偏差描述
    impact_assessment = Column(Text, nullable=False)  # 影响评估
    immediate_action = Column(Text, nullable=True)  # 立即采取的措施
    
    # 处理方案
    root_cause = Column(Text, nullable=True)  # 根本原因
    corrective_action = Column(Text, nullable=True)  # 纠正措施
    preventive_action = Column(Text, nullable=True)  # 预防措施
    
    # 关联信息
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 状态和时间
    status = Column(String, default="reported")  # reported, approved, in_progress, closed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    project = relationship("Project")
    reporter = relationship("User", foreign_keys=[reported_by])
    approver = relationship("User", foreign_keys=[approved_by])
    closer = relationship("User", foreign_keys=[closed_by])
    samples = relationship("DeviationSample", back_populates="deviation")
    attachments = relationship("DeviationAttachment", back_populates="deviation")
    tracking_items = relationship("DeviationTracking", back_populates="deviation")


class DeviationSample(Base):
    """偏差涉及的样本"""
    __tablename__ = "deviation_samples"

    id = Column(Integer, primary_key=True, index=True)
    deviation_id = Column(Integer, ForeignKey("deviations.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    
    # 关系
    deviation = relationship("Deviation", back_populates="samples")
    sample = relationship("Sample")


class DeviationAttachment(Base):
    """偏差相关附件"""
    __tablename__ = "deviation_attachments"

    id = Column(Integer, primary_key=True, index=True)
    deviation_id = Column(Integer, ForeignKey("deviations.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    deviation = relationship("Deviation", back_populates="attachments")
    uploader = relationship("User")


class DeviationTracking(Base):
    """偏差处理跟踪"""
    __tablename__ = "deviation_tracking"

    id = Column(Integer, primary_key=True, index=True)
    deviation_id = Column(Integer, ForeignKey("deviations.id"), nullable=False)
    action = Column(Text, nullable=False)  # 需要执行的动作
    assignee = Column(String, nullable=False)  # 负责人
    due_date = Column(DateTime(timezone=True), nullable=False)  # 完成期限
    completed = Column(Boolean, default=False)  # 是否完成
    completed_at = Column(DateTime(timezone=True), nullable=True)
    comments = Column(Text, nullable=True)  # 完成说明
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 关系
    deviation = relationship("Deviation", back_populates="tracking_items")


class DeviationApproval(Base):
    """偏差审批流程记录"""
    __tablename__ = "deviation_approvals"

    id = Column(Integer, primary_key=True, index=True)
    deviation_id = Column(Integer, ForeignKey("deviations.id"), nullable=False)
    
    # 审批步骤
    step = Column(Integer, nullable=False)  # 1-8的步骤
    step_name = Column(String, nullable=False)  # 步骤名称
    role = Column(String, nullable=False)  # 需要的角色
    
    # 审批信息
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=True)  # approve, reject, execute
    comments = Column(Text, nullable=True)
    executed_actions = Column(Text, nullable=True)  # 步骤5专用：实际执行情况
    designated_executor_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 步骤4专用：指定的执行人
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    deviation = relationship("Deviation", back_populates="approvals")
    user = relationship("User", foreign_keys=[user_id])
    designated_executor = relationship("User", foreign_keys=[designated_executor_id])


# 在Deviation类中添加关系
Deviation.approvals = relationship("DeviationApproval", back_populates="deviation", order_by="DeviationApproval.step")
