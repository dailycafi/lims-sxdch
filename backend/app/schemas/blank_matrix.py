"""空白基质 Pydantic Schema"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class BlankMatrixReceiveCreate(BaseModel):
    """空白基质接收创建"""
    project_id: int
    source_name: str
    source_contact: Optional[str] = None
    source_phone: Optional[str] = None
    anticoagulants: List[str]  # ["EDTA", "heparin_sodium", "sodium_citrate"]
    matrix_type: str
    matrix_type_other: Optional[str] = None
    notes: Optional[str] = None


class BlankMatrixSampleCreate(BaseModel):
    """空白基质样本创建"""
    anticoagulant: Optional[str] = None
    matrix_type: str
    edta_volume: Optional[Decimal] = None
    heparin_volume: Optional[Decimal] = None
    citrate_volume: Optional[Decimal] = None
    total_volume: Optional[Decimal] = None
    special_notes: Optional[str] = None


class BlankMatrixSampleResponse(BaseModel):
    """空白基质样本响应"""
    id: int
    sample_code: str
    barcode: Optional[str] = None
    receive_record_id: int
    project_id: int
    anticoagulant: Optional[str] = None
    matrix_type: str
    edta_volume: Optional[Decimal] = None
    heparin_volume: Optional[Decimal] = None
    citrate_volume: Optional[Decimal] = None
    total_volume: Optional[Decimal] = None
    status: str
    special_notes: Optional[str] = None
    freezer_id: Optional[str] = None
    shelf_level: Optional[str] = None
    rack_position: Optional[str] = None
    box_code: Optional[str] = None
    position_in_box: Optional[str] = None
    inventoried_by: Optional[int] = None
    inventoried_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlankMatrixReceiveResponse(BaseModel):
    """空白基质接收记录响应"""
    id: int
    project_id: int
    project_name: Optional[str] = None
    source_name: str
    source_contact: Optional[str] = None
    source_phone: Optional[str] = None
    consent_files: Optional[List[str]] = None
    ethics_files: Optional[List[str]] = None
    medical_report_files: Optional[List[str]] = None
    anticoagulants: List[str]
    matrix_type: str
    matrix_type_other: Optional[str] = None
    received_by: int
    received_by_name: Optional[str] = None
    received_at: datetime
    status: str
    notes: Optional[str] = None
    sample_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BlankMatrixInventoryItem(BaseModel):
    """空白基质清点条目"""
    sample_code: str
    anticoagulant: Optional[str] = None
    edta_volume: Optional[Decimal] = None
    heparin_volume: Optional[Decimal] = None
    citrate_volume: Optional[Decimal] = None
    special_notes: Optional[str] = None


class BlankMatrixInventoryCreate(BaseModel):
    """空白基质清点提交"""
    receive_record_id: int
    samples: List[BlankMatrixInventoryItem]
    storage_location: Optional[str] = None  # 暂存位置
    is_final: bool = False  # 是否入库（False为暂存）


class BlankMatrixSampleUpdate(BaseModel):
    """空白基质样本更新"""
    anticoagulant: Optional[str] = None
    edta_volume: Optional[Decimal] = None
    heparin_volume: Optional[Decimal] = None
    citrate_volume: Optional[Decimal] = None
    special_notes: Optional[str] = None
    status: Optional[str] = None
    freezer_id: Optional[str] = None
    shelf_level: Optional[str] = None
    rack_position: Optional[str] = None
    box_code: Optional[str] = None
    position_in_box: Optional[str] = None


class BlankMatrixCodeGenerateRequest(BaseModel):
    """生成空白基质编号请求"""
    project_code: str  # 项目编码，如 CRC
    prefix: str = "BP"  # 空白基质前缀，默认 BP
    anticoagulant: str  # 抗凝剂类型: E(EDTA), H(肝素钠), C(枸橼酸钠)
    count: int = 1  # 生成数量


class BlankMatrixCodeResponse(BaseModel):
    """生成的空白基质编号响应"""
    codes: List[str]
