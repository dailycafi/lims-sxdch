from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.schemas.global_params import OrganizationResponse


class ProjectBase(BaseModel):
    sponsor_project_code: str
    lab_project_code: str
    sponsor_id: int
    clinical_org_id: Optional[int] = None  # 保持兼容，可选


class ProjectCreate(ProjectBase):
    clinical_org_ids: Optional[List[int]] = None  # 支持多个临床机构
    sample_code_rule: Optional[Dict[str, Any]] = None
    sample_meta_config: Optional[Dict[str, Any]] = None


class ProjectUpdate(BaseModel):
    sponsor_id: Optional[int] = None
    clinical_org_id: Optional[int] = None
    clinical_org_ids: Optional[List[int]] = None
    sample_code_rule: Optional[Dict[str, Any]] = None
    sample_meta_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ProjectResponse(ProjectBase):
    id: int
    sample_code_rule: Optional[Dict[str, Any]] = None
    sample_meta_config: Optional[Dict[str, Any]] = None
    is_active: bool
    is_archived: bool
    status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # 额外包含的信息
    sponsor: Optional[OrganizationResponse] = None
    clinical_org: Optional[OrganizationResponse] = None
    clinical_orgs: Optional[List[OrganizationResponse]] = None  # 临床机构列表

    class Config:
        from_attributes = True
