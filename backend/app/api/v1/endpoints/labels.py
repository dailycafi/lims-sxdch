from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.orm import selectinload
from typing import List, Optional, Annotated, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field
import uuid

from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.models import User, LabelConfig, LabelBatch, Label, Project, AuditLog

router = APIRouter()


# ============ Pydantic Schemas ============

class LabelConfigCreate(BaseModel):
    project_id: int
    label_type: str  # sampling_tube, cryo_tube
    name: str
    config: Optional[Dict[str, Any]] = Field(default=None)
    separator: Optional[str] = "-"
    label_width: Optional[int] = 50
    label_height: Optional[int] = 30
    font_size: Optional[int] = 12
    barcode_enabled: Optional[bool] = True
    qrcode_enabled: Optional[bool] = False


class LabelConfigUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    separator: Optional[str] = None
    label_width: Optional[int] = None
    label_height: Optional[int] = None
    font_size: Optional[int] = None
    barcode_enabled: Optional[bool] = None
    qrcode_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    audit_reason: Optional[str] = None


class LabelConfigResponse(BaseModel):
    id: int
    project_id: int
    label_type: str
    name: str
    config: Optional[Dict[str, Any]] = None
    separator: Optional[str] = None
    label_width: int
    label_height: int
    font_size: int
    barcode_enabled: bool
    qrcode_enabled: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateLabelsRequest(BaseModel):
    project_id: int
    label_type: str  # sampling_tube, cryo_tube
    config_id: Optional[int] = None
    selected_options: Dict[str, List[str]]  # 选中的各个选项


class LabelResponse(BaseModel):
    id: int
    label_code: str
    internal_code: Optional[str] = None  # 系统内部编号（有空值时使用）
    label_type: str
    components: Optional[Dict[str, Any]] = None
    display_components: Optional[Dict[str, Any]] = None  # 显示用组件值
    is_printed: bool
    printed_at: Optional[datetime] = None
    print_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class LabelBatchResponse(BaseModel):
    id: int
    project_id: int
    batch_code: str
    label_type: str
    generation_params: Optional[Dict[str, Any]] = None
    total_count: int
    printed_count: int
    status: str
    generated_at: datetime
    labels: Optional[List[LabelResponse]] = Field(default=None)

    class Config:
        from_attributes = True


class CheckDuplicateRequest(BaseModel):
    project_id: int
    label_codes: List[str]


class CheckDuplicateResponse(BaseModel):
    has_duplicates: bool
    duplicate_codes: List[str]


class GenerateLabelsResponse(BaseModel):
    batch_id: int
    batch_code: str
    total_count: int
    label_codes: List[str]


class MessageResponse(BaseModel):
    message: str
    printed_count: Optional[int] = None


class DeleteResponse(BaseModel):
    message: str


# ============ Label Config Endpoints ============

@router.get("/configs", response_model=List[LabelConfigResponse])
async def get_label_configs(
    project_id: Optional[int] = None,
    label_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """获取标签配置列表"""
    query = select(LabelConfig).where(LabelConfig.is_active == True)
    
    if project_id:
        query = query.where(LabelConfig.project_id == project_id)
    if label_type:
        query = query.where(LabelConfig.label_type == label_type)
    
    query = query.order_by(LabelConfig.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/configs", response_model=LabelConfigResponse)
async def create_label_config(
    data: LabelConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """创建标签配置"""
    # 验证项目存在
    project_result = await db.execute(select(Project).where(Project.id == data.project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    config = LabelConfig(
        project_id=data.project_id,
        label_type=data.label_type,
        name=data.name,
        config=data.config,
        separator=data.separator,
        label_width=data.label_width,
        label_height=data.label_height,
        font_size=data.font_size,
        barcode_enabled=data.barcode_enabled,
        qrcode_enabled=data.qrcode_enabled,
        created_by=current_user.id
    )
    
    db.add(config)
    await db.commit()
    await db.refresh(config)
    
    return config


@router.get("/configs/{config_id}", response_model=LabelConfigResponse)
async def get_label_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """获取单个标签配置"""
    result = await db.execute(select(LabelConfig).where(LabelConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    return config


@router.put("/configs/{config_id}", response_model=LabelConfigResponse)
async def update_label_config(
    config_id: int,
    data: LabelConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """更新标签配置"""
    result = await db.execute(select(LabelConfig).where(LabelConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    update_data = data.model_dump(exclude_unset=True, exclude={'audit_reason'})
    for key, value in update_data.items():
        setattr(config, key, value)
    
    # 记录审计日志
    if data.audit_reason:
        audit_log = AuditLog(
            user_id=current_user.id,
            entity_type="label_config",
            entity_id=config_id,
            action="update",
            details={"reason": data.audit_reason, "changes": update_data}
        )
        db.add(audit_log)
    
    await db.commit()
    await db.refresh(config)
    
    return config


@router.delete("/configs/{config_id}", response_model=DeleteResponse)
async def delete_label_config(
    config_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """删除标签配置（软删除）"""
    result = await db.execute(select(LabelConfig).where(LabelConfig.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="配置不存在")
    
    config.is_active = False
    await db.commit()
    
    return DeleteResponse(message="配置已删除")


# ============ Label Generation Endpoints ============

@router.post("/generate", response_model=GenerateLabelsResponse)
async def generate_labels(
    data: GenerateLabelsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """生成标签编号"""
    # 验证项目存在
    project_result = await db.execute(select(Project).where(Project.id == data.project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 获取配置（如果指定）
    config = None
    separator = "-"
    if data.config_id:
        config_result = await db.execute(select(LabelConfig).where(LabelConfig.id == data.config_id))
        config = config_result.scalar_one_or_none()
        if config:
            separator = config.separator or "-"
    
    # 根据选项生成编号（笛卡尔积）
    selected = data.selected_options
    
    # 获取各个选项数组
    options_list = []
    option_keys = []
    
    for key, values in selected.items():
        if values and len(values) > 0:
            options_list.append(values)
            option_keys.append(key)
    
    if not options_list:
        raise HTTPException(status_code=400, detail="请至少选择一个选项")
    
    # 生成笛卡尔积
    from itertools import product
    combinations = list(product(*options_list))
    
    # 生成编号
    # 定义空值占位符
    EMPTY_PLACEHOLDER = "____"
    EMPTY_VALUES = {"", "____", "PENDING", "TBD", "NA", "N/A", "-", None}
    
    def is_empty_value(val):
        """检查值是否为空或占位符"""
        if val is None:
            return True
        str_val = str(val).strip().upper()
        return str_val in EMPTY_VALUES or str_val.startswith("_")
    
    label_codes = []
    for combo in combinations:
        components = dict(zip(option_keys, combo))
        
        # 生成显示用的组件（空值显示为下划线）
        display_components = {}
        has_empty = False
        for key, val in components.items():
            if is_empty_value(val):
                display_components[key] = EMPTY_PLACEHOLDER
                has_empty = True
            else:
                display_components[key] = str(val)
        
        # 生成显示编号（用于标签打印）
        display_values = [display_components.get(k, EMPTY_PLACEHOLDER) for k in option_keys]
        if separator == "":
            display_code = "".join(display_values)
        else:
            display_code = separator.join(display_values)
        
        # 如果有空值，生成内部唯一编号
        internal_code = None
        if has_empty:
            # 用随机字符串替换空值部分，生成内部唯一编号
            internal_values = []
            for key, val in components.items():
                if is_empty_value(val):
                    # 生成6位随机字符串作为内部标识
                    internal_values.append(uuid.uuid4().hex[:6].upper())
                else:
                    internal_values.append(str(val))
            if separator == "":
                internal_code = "".join(internal_values)
            else:
                internal_code = separator.join(internal_values)
        
        label_codes.append({
            "code": display_code,  # 显示用编号
            "internal_code": internal_code,  # 系统内部编号（有空值时）
            "components": components,  # 原始组件值
            "display_components": display_components  # 显示用组件值
        })
    
    # 创建批次记录
    batch_code = f"LB-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    
    batch = LabelBatch(
        project_id=data.project_id,
        config_id=data.config_id,
        batch_code=batch_code,
        label_type=data.label_type,
        generation_params=data.selected_options,
        total_count=len(label_codes),
        generated_by=current_user.id
    )
    
    db.add(batch)
    await db.flush()
    
    # 创建标签记录
    labels = []
    for item in label_codes:
        label = Label(
            batch_id=batch.id,
            project_id=data.project_id,
            label_code=item["code"],  # 显示用编号
            internal_code=item.get("internal_code"),  # 系统内部编号（有空值时）
            label_type=data.label_type,
            components=item["components"],  # 原始组件值
            display_components=item.get("display_components")  # 显示用组件值
        )
        db.add(label)
        labels.append(label)
    
    await db.commit()
    await db.refresh(batch)
    
    return GenerateLabelsResponse(
        batch_id=batch.id,
        batch_code=batch.batch_code,
        total_count=len(label_codes),
        label_codes=[l["code"] for l in label_codes]
    )


@router.post("/check-duplicates", response_model=CheckDuplicateResponse)
async def check_duplicates(
    data: CheckDuplicateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """检查编号是否重复"""
    result = await db.execute(
        select(Label.label_code).where(
            and_(
                Label.project_id == data.project_id,
                Label.label_code.in_(data.label_codes)
            )
        )
    )
    
    duplicate_codes = [r[0] for r in result.all()]
    
    return CheckDuplicateResponse(
        has_duplicates=len(duplicate_codes) > 0,
        duplicate_codes=duplicate_codes
    )


# ============ Label Batch Endpoints ============

@router.get("/batches", response_model=List[LabelBatchResponse])
async def get_label_batches(
    project_id: Optional[int] = None,
    label_type: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """获取标签批次列表"""
    query = select(LabelBatch)
    
    if project_id:
        query = query.where(LabelBatch.project_id == project_id)
    if label_type:
        query = query.where(LabelBatch.label_type == label_type)
    
    query = query.order_by(LabelBatch.generated_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/batches/{batch_id}", response_model=LabelBatchResponse)
async def get_label_batch(
    batch_id: int,
    include_labels: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """获取单个批次详情"""
    if include_labels:
        query = select(LabelBatch).options(selectinload(LabelBatch.labels)).where(LabelBatch.id == batch_id)
    else:
        query = select(LabelBatch).where(LabelBatch.id == batch_id)
    
    result = await db.execute(query)
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    return batch


@router.get("/batches/{batch_id}/labels", response_model=List[LabelResponse])
async def get_batch_labels(
    batch_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """获取批次下的标签列表"""
    query = select(Label).where(Label.batch_id == batch_id).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ============ Label Print Endpoints ============

@router.post("/batches/{batch_id}/print", response_model=MessageResponse)
async def mark_batch_printed(
    batch_id: int,
    label_ids: Optional[List[int]] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """标记标签已打印"""
    result = await db.execute(select(LabelBatch).where(LabelBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    now = datetime.now()
    
    if label_ids:
        # 部分打印
        labels_result = await db.execute(
            select(Label).where(
                and_(Label.batch_id == batch_id, Label.id.in_(label_ids))
            )
        )
        labels = labels_result.scalars().all()
        
        for label in labels:
            label.is_printed = True
            label.printed_at = now
            label.printed_by = current_user.id
            label.print_count += 1
        
        count_result = await db.execute(
            select(Label).where(
                and_(Label.batch_id == batch_id, Label.is_printed == True)
            )
        )
        batch.printed_count = len(count_result.scalars().all())
        
        if batch.printed_count == batch.total_count:
            batch.status = "printed"
        else:
            batch.status = "partial_printed"
    else:
        # 全部打印
        await db.execute(
            update(Label).where(Label.batch_id == batch_id).values(
                is_printed=True,
                printed_at=now,
                printed_by=current_user.id,
                print_count=Label.print_count + 1
            )
        )
        
        batch.printed_count = batch.total_count
        batch.status = "printed"
    
    await db.commit()
    
    return MessageResponse(message="打印状态已更新", printed_count=batch.printed_count)


# ============ Label Search Endpoints ============

@router.get("/search", response_model=List[LabelResponse])
async def search_labels(
    project_id: Optional[int] = None,
    label_type: Optional[str] = None,
    keyword: Optional[str] = None,
    is_printed: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[User, Depends(get_current_user)] = None
):
    """搜索标签"""
    query = select(Label)
    
    if project_id:
        query = query.where(Label.project_id == project_id)
    if label_type:
        query = query.where(Label.label_type == label_type)
    if keyword:
        query = query.where(Label.label_code.ilike(f"%{keyword}%"))
    if is_printed is not None:
        query = query.where(Label.is_printed == is_printed)
    
    query = query.order_by(Label.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()
