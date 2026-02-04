from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Annotated
from datetime import datetime
from pydantic import BaseModel, Field
import uuid

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models import User
from app.models.special_sample import (
    SpecialSampleApplication,
    SpecialSample,
    SpecialSampleConfig,
    SpecialSampleStatus,
    SpecialSampleType
)
from app.models.audit import AuditLog

router = APIRouter()


# ============ Pydantic Schemas ============

class SpecialSampleApplicationCreate(BaseModel):
    project_code_prefix: str = Field(..., min_length=1, max_length=20)
    project_code_separator: str = Field(default="-", max_length=5)
    project_code_suffix: Optional[str] = Field(default=None, max_length=20)
    sample_type: SpecialSampleType
    sample_name: str = Field(..., min_length=1, max_length=200)
    sample_source: Optional[str] = None
    sample_count: int = Field(..., ge=1, le=1000)
    unit: str = Field(default="tube")
    storage_temperature: Optional[str] = None
    storage_conditions: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None


class SpecialSampleApplicationResponse(BaseModel):
    id: int
    application_code: str
    project_code_prefix: str
    project_code_separator: str
    project_code_suffix: Optional[str]
    sample_type: SpecialSampleType
    sample_name: str
    sample_source: Optional[str]
    sample_count: int
    unit: str
    storage_temperature: Optional[str]
    storage_conditions: Optional[str]
    purpose: Optional[str]
    notes: Optional[str]
    status: SpecialSampleStatus
    requested_by: int
    requester_name: Optional[str] = None
    approved_by: Optional[int]
    approver_name: Optional[str] = None
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SpecialSampleResponse(BaseModel):
    id: int
    application_id: int
    sample_code: str
    barcode: Optional[str]
    sample_type: SpecialSampleType
    sample_name: str
    sequence_number: int
    status: SpecialSampleStatus
    freezer_id: Optional[str]
    shelf_level: Optional[str]
    rack_position: Optional[str]
    box_code: Optional[str]
    position_in_box: Optional[str]
    received_by: Optional[int]
    received_at: Optional[datetime]
    label_printed: bool
    label_printed_at: Optional[datetime]
    print_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalRequest(BaseModel):
    approved: bool
    rejection_reason: Optional[str] = None


class ReceiveSamplesRequest(BaseModel):
    sample_ids: List[int]
    storage_location: Optional[str] = None
    notes: Optional[str] = None


class PrintLabelsRequest(BaseModel):
    sample_ids: List[int]


class SpecialSampleConfigCreate(BaseModel):
    sample_type: SpecialSampleType
    prefix: str = Field(..., min_length=1, max_length=20)
    default_separator: str = Field(default="-", max_length=5)
    allow_custom_separator: bool = True
    code_optional: bool = True
    label_width: int = Field(default=50, ge=10, le=200)
    label_height: int = Field(default=30, ge=10, le=200)
    font_size: int = Field(default=10, ge=6, le=24)
    barcode_enabled: bool = True
    barcode_format: str = Field(default="CODE128")


class SpecialSampleConfigResponse(BaseModel):
    id: int
    sample_type: SpecialSampleType
    prefix: str
    default_separator: str
    allow_custom_separator: bool
    code_optional: bool
    label_width: int
    label_height: int
    font_size: int
    barcode_enabled: bool
    barcode_format: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============ Helper Functions ============

def generate_application_code() -> str:
    """Generate unique application code"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random_suffix = uuid.uuid4().hex[:6].upper()
    return f"SSA-{timestamp}-{random_suffix}"


def generate_sample_code(
    prefix: str,
    separator: str,
    suffix: Optional[str],
    sequence: int
) -> str:
    """Generate sample code based on configuration"""
    parts = [prefix]
    if suffix:
        parts.append(suffix)
    parts.append(str(sequence))
    return separator.join(parts)


def generate_barcode(sample_code: str) -> str:
    """Generate unique barcode for sample"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f"{sample_code}-{timestamp[-6:]}"


# ============ Application Endpoints ============

@router.get("/applications", response_model=List[SpecialSampleApplicationResponse])
async def get_applications(
    status: Optional[SpecialSampleStatus] = None,
    sample_type: Optional[SpecialSampleType] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get special sample applications list"""
    query = select(SpecialSampleApplication).options(
        selectinload(SpecialSampleApplication.requester),
        selectinload(SpecialSampleApplication.approver)
    )

    if status:
        query = query.where(SpecialSampleApplication.status == status)
    if sample_type:
        query = query.where(SpecialSampleApplication.sample_type == sample_type)

    query = query.order_by(SpecialSampleApplication.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    applications = result.scalars().all()

    response_list = []
    for app in applications:
        app_dict = {
            "id": app.id,
            "application_code": app.application_code,
            "project_code_prefix": app.project_code_prefix,
            "project_code_separator": app.project_code_separator,
            "project_code_suffix": app.project_code_suffix,
            "sample_type": app.sample_type,
            "sample_name": app.sample_name,
            "sample_source": app.sample_source,
            "sample_count": app.sample_count,
            "unit": app.unit,
            "storage_temperature": app.storage_temperature,
            "storage_conditions": app.storage_conditions,
            "purpose": app.purpose,
            "notes": app.notes,
            "status": app.status,
            "requested_by": app.requested_by,
            "requester_name": app.requester.full_name if app.requester else None,
            "approved_by": app.approved_by,
            "approver_name": app.approver.full_name if app.approver else None,
            "approved_at": app.approved_at,
            "rejection_reason": app.rejection_reason,
            "created_at": app.created_at,
            "updated_at": app.updated_at,
        }
        response_list.append(SpecialSampleApplicationResponse(**app_dict))

    return response_list


@router.post("/applications", response_model=SpecialSampleApplicationResponse)
async def create_application(
    data: SpecialSampleApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Create a new special sample application"""
    application = SpecialSampleApplication(
        application_code=generate_application_code(),
        project_code_prefix=data.project_code_prefix,
        project_code_separator=data.project_code_separator,
        project_code_suffix=data.project_code_suffix,
        sample_type=data.sample_type,
        sample_name=data.sample_name,
        sample_source=data.sample_source,
        sample_count=data.sample_count,
        unit=data.unit,
        storage_temperature=data.storage_temperature,
        storage_conditions=data.storage_conditions,
        purpose=data.purpose,
        notes=data.notes,
        status=SpecialSampleStatus.PENDING,
        requested_by=current_user.id
    )

    db.add(application)
    await db.commit()
    await db.refresh(application)

    # Load relationships
    result = await db.execute(
        select(SpecialSampleApplication)
        .options(
            selectinload(SpecialSampleApplication.requester),
            selectinload(SpecialSampleApplication.approver)
        )
        .where(SpecialSampleApplication.id == application.id)
    )
    application = result.scalar_one()

    return SpecialSampleApplicationResponse(
        id=application.id,
        application_code=application.application_code,
        project_code_prefix=application.project_code_prefix,
        project_code_separator=application.project_code_separator,
        project_code_suffix=application.project_code_suffix,
        sample_type=application.sample_type,
        sample_name=application.sample_name,
        sample_source=application.sample_source,
        sample_count=application.sample_count,
        unit=application.unit,
        storage_temperature=application.storage_temperature,
        storage_conditions=application.storage_conditions,
        purpose=application.purpose,
        notes=application.notes,
        status=application.status,
        requested_by=application.requested_by,
        requester_name=application.requester.full_name if application.requester else None,
        approved_by=application.approved_by,
        approver_name=application.approver.full_name if application.approver else None,
        approved_at=application.approved_at,
        rejection_reason=application.rejection_reason,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.get("/applications/{application_id}", response_model=SpecialSampleApplicationResponse)
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get a specific application"""
    result = await db.execute(
        select(SpecialSampleApplication)
        .options(
            selectinload(SpecialSampleApplication.requester),
            selectinload(SpecialSampleApplication.approver)
        )
        .where(SpecialSampleApplication.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return SpecialSampleApplicationResponse(
        id=application.id,
        application_code=application.application_code,
        project_code_prefix=application.project_code_prefix,
        project_code_separator=application.project_code_separator,
        project_code_suffix=application.project_code_suffix,
        sample_type=application.sample_type,
        sample_name=application.sample_name,
        sample_source=application.sample_source,
        sample_count=application.sample_count,
        unit=application.unit,
        storage_temperature=application.storage_temperature,
        storage_conditions=application.storage_conditions,
        purpose=application.purpose,
        notes=application.notes,
        status=application.status,
        requested_by=application.requested_by,
        requester_name=application.requester.full_name if application.requester else None,
        approved_by=application.approved_by,
        approver_name=application.approver.full_name if application.approver else None,
        approved_at=application.approved_at,
        rejection_reason=application.rejection_reason,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


@router.post("/applications/{application_id}/approve")
async def approve_application(
    application_id: int,
    data: ApprovalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Approve or reject an application"""
    result = await db.execute(
        select(SpecialSampleApplication).where(SpecialSampleApplication.id == application_id)
    )
    application = result.scalar_one_or_none()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status != SpecialSampleStatus.PENDING:
        raise HTTPException(status_code=400, detail="Application is not in pending status")

    if data.approved:
        application.status = SpecialSampleStatus.APPROVED
        application.approved_by = current_user.id
        application.approved_at = datetime.now()

        # Generate sample records
        for i in range(1, application.sample_count + 1):
            sample_code = generate_sample_code(
                application.project_code_prefix,
                application.project_code_separator,
                application.project_code_suffix,
                i
            )
            barcode = generate_barcode(sample_code)

            sample = SpecialSample(
                application_id=application.id,
                sample_code=sample_code,
                barcode=barcode,
                sample_type=application.sample_type,
                sample_name=application.sample_name,
                sequence_number=i,
                status=SpecialSampleStatus.APPROVED
            )
            db.add(sample)
    else:
        application.status = SpecialSampleStatus.REJECTED
        application.approved_by = current_user.id
        application.approved_at = datetime.now()
        application.rejection_reason = data.rejection_reason

    # Create audit log
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="special_sample_application",
        entity_id=application_id,
        action="approve" if data.approved else "reject",
        details={
            "approved": data.approved,
            "rejection_reason": data.rejection_reason
        }
    )
    db.add(audit_log)

    await db.commit()

    return {
        "message": "Application approved" if data.approved else "Application rejected",
        "status": application.status.value
    }


# ============ Sample Endpoints ============

@router.get("/samples", response_model=List[SpecialSampleResponse])
async def get_samples(
    application_id: Optional[int] = None,
    status: Optional[SpecialSampleStatus] = None,
    sample_type: Optional[SpecialSampleType] = None,
    keyword: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get special samples list"""
    query = select(SpecialSample)

    if application_id:
        query = query.where(SpecialSample.application_id == application_id)
    if status:
        query = query.where(SpecialSample.status == status)
    if sample_type:
        query = query.where(SpecialSample.sample_type == sample_type)
    if keyword:
        query = query.where(
            SpecialSample.sample_code.ilike(f"%{keyword}%") |
            SpecialSample.sample_name.ilike(f"%{keyword}%") |
            SpecialSample.barcode.ilike(f"%{keyword}%")
        )

    query = query.order_by(SpecialSample.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    samples = result.scalars().all()

    return [SpecialSampleResponse.model_validate(s) for s in samples]


@router.get("/samples/{sample_id}", response_model=SpecialSampleResponse)
async def get_sample(
    sample_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get a specific sample"""
    result = await db.execute(
        select(SpecialSample).where(SpecialSample.id == sample_id)
    )
    sample = result.scalar_one_or_none()

    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    return SpecialSampleResponse.model_validate(sample)


@router.post("/samples/receive")
async def receive_samples(
    data: ReceiveSamplesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Receive approved samples"""
    result = await db.execute(
        select(SpecialSample).where(SpecialSample.id.in_(data.sample_ids))
    )
    samples = result.scalars().all()

    if len(samples) != len(data.sample_ids):
        raise HTTPException(status_code=404, detail="Some samples not found")

    now = datetime.now()
    received_count = 0

    for sample in samples:
        if sample.status == SpecialSampleStatus.APPROVED:
            sample.status = SpecialSampleStatus.RECEIVED
            sample.received_by = current_user.id
            sample.received_at = now
            received_count += 1

    await db.commit()

    return {
        "message": f"Successfully received {received_count} samples",
        "received_count": received_count
    }


@router.post("/samples/print-labels")
async def print_labels(
    data: PrintLabelsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Mark samples as printed and return label data"""
    result = await db.execute(
        select(SpecialSample).where(SpecialSample.id.in_(data.sample_ids))
    )
    samples = result.scalars().all()

    if not samples:
        raise HTTPException(status_code=404, detail="No samples found")

    now = datetime.now()
    labels = []

    for sample in samples:
        sample.label_printed = True
        sample.label_printed_at = now
        sample.label_printed_by = current_user.id
        sample.print_count += 1

        labels.append({
            "id": sample.id,
            "sample_code": sample.sample_code,
            "barcode": sample.barcode,
            "sample_type": sample.sample_type.value,
            "sample_name": sample.sample_name,
            "sequence_number": sample.sequence_number
        })

    await db.commit()

    return {
        "message": f"Printed {len(labels)} labels",
        "labels": labels
    }


# ============ Configuration Endpoints ============

@router.get("/configs", response_model=List[SpecialSampleConfigResponse])
async def get_configs(
    sample_type: Optional[SpecialSampleType] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get special sample configurations"""
    query = select(SpecialSampleConfig).where(SpecialSampleConfig.is_active == True)

    if sample_type:
        query = query.where(SpecialSampleConfig.sample_type == sample_type)

    result = await db.execute(query)
    configs = result.scalars().all()

    return [SpecialSampleConfigResponse.model_validate(c) for c in configs]


@router.post("/configs", response_model=SpecialSampleConfigResponse)
async def create_config(
    data: SpecialSampleConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Create or update special sample configuration"""
    # Check if config exists for this sample type
    result = await db.execute(
        select(SpecialSampleConfig).where(SpecialSampleConfig.sample_type == data.sample_type)
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing
        for key, value in data.model_dump().items():
            setattr(existing, key, value)
        config = existing
    else:
        # Create new
        config = SpecialSampleConfig(**data.model_dump())
        db.add(config)

    await db.commit()
    await db.refresh(config)

    return SpecialSampleConfigResponse.model_validate(config)


@router.get("/configs/{sample_type}", response_model=SpecialSampleConfigResponse)
async def get_config_by_type(
    sample_type: SpecialSampleType,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get configuration for a specific sample type"""
    result = await db.execute(
        select(SpecialSampleConfig).where(
            and_(
                SpecialSampleConfig.sample_type == sample_type,
                SpecialSampleConfig.is_active == True
            )
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        # Return default config
        default_prefixes = {
            SpecialSampleType.SC: "SC",
            SpecialSampleType.QC: "QC",
            SpecialSampleType.BLANK: "BLK",
            SpecialSampleType.OTHER: "OTH"
        }
        return SpecialSampleConfigResponse(
            id=0,
            sample_type=sample_type,
            prefix=default_prefixes.get(sample_type, "SPL"),
            default_separator="-",
            allow_custom_separator=True,
            code_optional=True,
            label_width=50,
            label_height=30,
            font_size=10,
            barcode_enabled=True,
            barcode_format="CODE128",
            is_active=True,
            created_at=datetime.now(),
            updated_at=None
        )

    return SpecialSampleConfigResponse.model_validate(config)


# ============ Statistics Endpoint ============

@router.get("/statistics")
async def get_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """Get special samples statistics"""
    # Count by status
    status_counts = {}
    for status in SpecialSampleStatus:
        result = await db.execute(
            select(func.count(SpecialSample.id)).where(SpecialSample.status == status)
        )
        status_counts[status.value] = result.scalar() or 0

    # Count by type
    type_counts = {}
    for sample_type in SpecialSampleType:
        result = await db.execute(
            select(func.count(SpecialSample.id)).where(SpecialSample.sample_type == sample_type)
        )
        type_counts[sample_type.value] = result.scalar() or 0

    # Pending applications count
    result = await db.execute(
        select(func.count(SpecialSampleApplication.id)).where(
            SpecialSampleApplication.status == SpecialSampleStatus.PENDING
        )
    )
    pending_applications = result.scalar() or 0

    return {
        "by_status": status_counts,
        "by_type": type_counts,
        "pending_applications": pending_applications,
        "total_samples": sum(status_counts.values())
    }
