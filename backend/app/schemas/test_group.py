from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime


class CollectionPointItem(BaseModel):
    """采集点项"""
    code: str  # 采集点代码（如 C1, C2）
    name: str  # 采集点名称（如 D1-0h, D1-1h）


class DetectionConfigItem(BaseModel):
    """检测配置项 - 一个试验组可以有多个检测类型，每个检测类型有自己的采集点"""
    test_type: str  # 检测类型（如 PK, ADA, Nab）
    sample_type: Optional[str] = None  # 样本类型（如 血浆, 血清）
    primary_sets: int = 1  # 正份套数
    backup_sets: int = 0  # 备份套数
    collection_points: Optional[List[CollectionPointItem]] = None  # 该检测类型对应的采集点列表


class TestGroupBase(BaseModel):
    """试验组基础模型"""
    name: Optional[str] = None  # 可选的试验组名称
    cycle: Optional[str] = None
    dosage: Optional[str] = None
    planned_count: int = 0
    backup_count: int = 0  # 保留向后兼容
    subject_prefix: Optional[str] = None
    subject_start_number: int = 1
    # 备用人员编号配置
    backup_subject_prefix: Optional[str] = None
    backup_subject_start_number: int = 1
    # 多检测类型配置
    detection_configs: Optional[List[DetectionConfigItem]] = None
    collection_points: Optional[List[CollectionPointItem]] = None
    display_order: int = 0


class TestGroupCreate(TestGroupBase):
    """创建试验组"""
    project_id: int


class TestGroupUpdate(BaseModel):
    """更新试验组"""
    name: Optional[str] = None  # 可选的试验组名称
    cycle: Optional[str] = None
    dosage: Optional[str] = None
    planned_count: Optional[int] = None
    backup_count: Optional[int] = None  # 保留向后兼容
    subject_prefix: Optional[str] = None
    subject_start_number: Optional[int] = None
    # 备用人员编号配置
    backup_subject_prefix: Optional[str] = None
    backup_subject_start_number: Optional[int] = None
    # 多检测类型配置
    detection_configs: Optional[List[DetectionConfigItem]] = None
    collection_points: Optional[List[CollectionPointItem]] = None
    display_order: Optional[int] = None
    audit_reason: Optional[str] = None

    @field_validator("audit_reason")
    @classmethod
    def reason_must_not_be_empty_if_provided(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("修改理由不能为空")
        return v


class TestGroupConfirm(BaseModel):
    """确认试验组"""
    password: str
    reason: Optional[str] = None


class TestGroupResponse(TestGroupBase):
    """试验组响应"""
    id: int
    project_id: int
    is_confirmed: bool
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[int] = None
    
    # 生成的受试者编号列表（计算字段）
    generated_subjects: Optional[List[str]] = None

    class Config:
        from_attributes = True


class TestGroupCopy(BaseModel):
    """复制试验组"""
    source_id: int  # 源试验组 ID
    # 可选的覆盖字段，复制时可以修改这些值
    name: Optional[str] = None
    cycle: Optional[str] = None
    dosage: Optional[str] = None
    planned_count: Optional[int] = None
    backup_count: Optional[int] = None
    subject_prefix: Optional[str] = None
    subject_start_number: Optional[int] = None
    detection_configs: Optional[List[DetectionConfigItem]] = None
    collection_points: Optional[List[CollectionPointItem]] = None


# 采集点相关
class CollectionPointCreate(BaseModel):
    """创建采集点"""
    project_id: Optional[int] = None
    code: str
    name: str
    description: Optional[str] = None
    display_order: int = 0


class CollectionPointUpdate(BaseModel):
    """更新采集点"""
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    audit_reason: str

    @field_validator("audit_reason")
    @classmethod
    def reason_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("修改理由不能为空")
        return v


class CollectionPointResponse(BaseModel):
    """采集点响应"""
    id: int
    project_id: Optional[int] = None
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
