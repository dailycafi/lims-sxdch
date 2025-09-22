from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class ProjectBase(BaseModel):
    sponsor_project_code: str
    lab_project_code: str
    sponsor_id: int
    clinical_org_id: int


class ProjectCreate(ProjectBase):
    sample_code_rule: Optional[Dict[str, Any]] = None


class ProjectUpdate(BaseModel):
    sponsor_id: Optional[int] = None
    clinical_org_id: Optional[int] = None
    sample_code_rule: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: int
    sample_code_rule: Optional[Dict[str, Any]] = None
    is_active: bool
    is_archived: bool
    status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
