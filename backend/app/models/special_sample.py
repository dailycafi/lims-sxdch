from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class SpecialSampleStatus(str, enum.Enum):
    """Special sample status enum"""
    PENDING = "pending"  # Pending approval
    APPROVED = "approved"  # Approved
    REJECTED = "rejected"  # Rejected
    RECEIVED = "received"  # Received
    IN_STORAGE = "in_storage"  # In storage
    CHECKED_OUT = "checked_out"  # Checked out
    TRANSFERRED = "transferred"  # Transferred
    DESTROYED = "destroyed"  # Destroyed


class SpecialSampleType(str, enum.Enum):
    """Special sample type enum"""
    SC = "SC"  # Standard Control
    QC = "QC"  # Quality Control
    BLANK = "BLANK"  # Blank Matrix
    OTHER = "OTHER"  # Other


class SpecialSampleApplication(Base):
    """Special sample application model"""
    __tablename__ = "special_sample_applications"

    id = Column(Integer, primary_key=True, index=True)
    application_code = Column(String, unique=True, nullable=False, index=True)

    # Project code configuration
    project_code_prefix = Column(String, nullable=False)  # e.g., "SC", "QC"
    project_code_separator = Column(String, default="-")  # Separator, default "-"
    project_code_suffix = Column(String, nullable=True)  # Optional suffix, e.g., "L"

    # Sample type and info
    sample_type = Column(Enum(SpecialSampleType), nullable=False)
    sample_name = Column(String, nullable=False)  # Sample name/description
    sample_source = Column(String, nullable=True)  # Sample source
    sample_count = Column(Integer, nullable=False, default=1)
    unit = Column(String, default="tube")  # Unit

    # Storage requirements
    storage_temperature = Column(String, nullable=True)  # e.g., "-20C", "-80C"
    storage_conditions = Column(Text, nullable=True)

    # Purpose and notes
    purpose = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Status tracking
    status = Column(Enum(SpecialSampleStatus), default=SpecialSampleStatus.PENDING)

    # Approval workflow
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    samples = relationship("SpecialSample", back_populates="application")


class SpecialSample(Base):
    """Special sample record model"""
    __tablename__ = "special_samples"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("special_sample_applications.id"), nullable=False)

    # Sample code (generated from application config)
    sample_code = Column(String, unique=True, nullable=False, index=True)
    barcode = Column(String, unique=True, nullable=True, index=True)

    # Sample type inherited from application
    sample_type = Column(Enum(SpecialSampleType), nullable=False)
    sample_name = Column(String, nullable=False)

    # Sequence number within the application batch
    sequence_number = Column(Integer, nullable=False)

    # Status
    status = Column(Enum(SpecialSampleStatus), default=SpecialSampleStatus.PENDING)

    # Storage location
    freezer_id = Column(String, nullable=True)
    shelf_level = Column(String, nullable=True)
    rack_position = Column(String, nullable=True)
    box_code = Column(String, nullable=True)
    box_id = Column(Integer, ForeignKey("storage_boxes.id"), nullable=True)
    position_in_box = Column(String, nullable=True)

    # Receipt information
    received_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)

    # Label printing status
    label_printed = Column(Boolean, default=False)
    label_printed_at = Column(DateTime(timezone=True), nullable=True)
    label_printed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    print_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    application = relationship("SpecialSampleApplication", back_populates="samples")
    receiver = relationship("User", foreign_keys=[received_by])
    printer = relationship("User", foreign_keys=[label_printed_by])
    box = relationship("app.models.storage.StorageBox", backref="special_samples")


class SpecialSampleConfig(Base):
    """Special sample code configuration per type"""
    __tablename__ = "special_sample_configs"

    id = Column(Integer, primary_key=True, index=True)
    sample_type = Column(Enum(SpecialSampleType), nullable=False, unique=True)

    # Code format configuration
    prefix = Column(String, nullable=False)  # e.g., "SC", "QC"
    default_separator = Column(String, default="-")  # Default separator
    allow_custom_separator = Column(Boolean, default=True)  # Allow custom separator
    code_optional = Column(Boolean, default=True)  # Whether suffix code is optional

    # Label print configuration
    label_width = Column(Integer, default=50)
    label_height = Column(Integer, default=30)
    font_size = Column(Integer, default=10)
    barcode_enabled = Column(Boolean, default=True)
    barcode_format = Column(String, default="CODE128")  # Barcode format

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
