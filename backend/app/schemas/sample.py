from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.sample import SampleStatus, SamplePurpose


class SampleBase(BaseModel):
    sample_code: str
    project_id: int
    subject_code: Optional[str] = None
    test_type: Optional[str] = None
    collection_time: Optional[str] = None
    collection_seq: Optional[str] = None
    cycle_group: Optional[str] = None
    is_primary: bool = True
    purpose: Optional[SamplePurpose] = None


class SampleCreate(SampleBase):
    barcode: Optional[str] = None
    transport_condition: Optional[str] = None
    special_notes: Optional[str] = None


class SampleUpdate(BaseModel):
    status: Optional[SampleStatus] = None
    purpose: Optional[SamplePurpose] = None
    freezer_id: Optional[str] = None
    shelf_level: Optional[str] = None
    rack_position: Optional[str] = None
    box_code: Optional[str] = None
    position_in_box: Optional[str] = None
    special_notes: Optional[str] = None


class SampleResponse(SampleBase):
    id: int
    barcode: Optional[str] = None
    status: SampleStatus
    freezer_id: Optional[str] = None
    shelf_level: Optional[str] = None
    rack_position: Optional[str] = None
    box_code: Optional[str] = None
    position_in_box: Optional[str] = None
    transport_condition: Optional[str] = None
    special_notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
