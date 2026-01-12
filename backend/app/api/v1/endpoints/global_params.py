from typing import List, Annotated, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, field_validator
from datetime import datetime

from app.core.database import get_db
from app.models.global_params import OrganizationType, Organization, SampleType, GlobalConfiguration, SystemSetting
from app.models.test_group import CollectionPoint
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# Pydantic schemas
class OrganizationTypeCreate(BaseModel):
    value: str
    label: str
    display_order: Optional[int] = 0

class OrganizationTypeUpdate(BaseModel):
    label: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class OrganizationTypeResponse(BaseModel):
    id: int
    value: str
    label: str
    is_system: bool
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class OrganizationCreate(BaseModel):
    name: str
    org_type: str
    project_id: Optional[int] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

    @field_validator("contact_email")
    @classmethod
    def empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        if v == "":
            return None
        return v

class OrganizationUpdate(OrganizationCreate):
    audit_reason: str  # 修改理由

    @field_validator("audit_reason")
    @classmethod
    def reason_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("修改理由不能为空")
        return v

class SampleTypeCreate(BaseModel):
    project_id: Optional[int] = None
    category: str = "clinical"  # clinical, stability, qc
    cycle_group: Optional[str] = None
    test_type: Optional[str] = None
    code: Optional[str] = None
    primary_codes: Optional[str] = None  # 正份代码，逗号分隔
    backup_codes: Optional[str] = None  # 备份代码，逗号分隔
    primary_count: int = 1
    backup_count: int = 1
    purpose: Optional[str] = None
    transport_method: Optional[str] = None
    status: Optional[str] = None
    special_notes: Optional[str] = None

class SampleTypeUpdate(SampleTypeCreate):
    audit_reason: str  # 修改理由

    @field_validator("audit_reason")
    @classmethod
    def reason_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("修改理由不能为空")
        return v

class OrganizationResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    name: str
    org_type: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True  # 允许从 ORM 对象创建

class SampleTypeResponse(BaseModel):
    id: int
    project_id: Optional[int] = None
    category: str
    cycle_group: Optional[str] = None
    test_type: Optional[str] = None
    code: Optional[str] = None
    primary_codes: Optional[str] = None  # 正份代码，逗号分隔
    backup_codes: Optional[str] = None  # 备份代码，逗号分隔
    primary_count: int
    backup_count: int
    purpose: Optional[str] = None
    transport_method: Optional[str] = None
    status: Optional[str] = None
    special_notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
class GlobalConfigurationResponse(BaseModel):
    id: int
    name: str
    category: str
    description: Optional[str] = None
    config_data: Dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# 采血点 Schemas
class CollectionPointCreate(BaseModel):
    code: str
    name: str
    time_description: Optional[str] = None
    display_order: int = 0


class CollectionPointUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    time_description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    audit_reason: str  # 修改理由

    @field_validator("audit_reason")
    @classmethod
    def reason_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("修改理由不能为空")
        return v


class CollectionPointResponse(BaseModel):
    id: int
    code: str
    name: str
    time_description: Optional[str] = None
    display_order: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SystemSettingResponse(BaseModel):
    key: str
    value: Any
    description: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemSettingUpdate(BaseModel):
    value: Any


def check_global_params_permission(user: User) -> bool:
    """检查全局参数管理权限"""
    allowed_roles = [UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    return user.role in allowed_roles


async def create_audit_log(
    db: AsyncSession,
    user_id: int,
    entity_type: str,
    entity_id: int,
    action: str,
    details: dict,
    reason: Optional[str] = None
):
    """创建审计日志"""
    audit_log = AuditLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        details=details,
        reason=reason,
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()


@router.get("/configurations", response_model=List[GlobalConfigurationResponse])
async def read_configurations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取全局配置模板列表"""
    result = await db.execute(select(GlobalConfiguration).where(GlobalConfiguration.is_active == True))
    return result.scalars().all()


@router.get("/settings", response_model=List[SystemSettingResponse])
async def read_system_settings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取所有系统设置"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限查看系统设置"
        )
    result = await db.execute(select(SystemSetting))
    return result.scalars().all()


@router.get("/settings/{key}", response_model=SystemSettingResponse)
async def read_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db)
):
    """获取单个系统设置（公开，部分设置可能需要权限，但目前这些都可以公开）"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="设置未找到")
    return setting


@router.put("/settings/{key}", response_model=SystemSettingResponse)
async def update_system_setting(
    key: str,
    setting_data: SystemSettingUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新系统设置"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理系统设置"
        )
    
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="设置未找到")
    
    original_value = setting.value
    setting.value = setting_data.value
    setting.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(setting)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="system_setting",
        entity_id=setting.id,
        action="update",
        details={
            "key": key,
            "original_value": original_value,
            "new_value": setting_data.value
        }
    )
    
    return setting


@router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(
    org_data: OrganizationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建组织/机构"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    try:
        db_org = Organization(**org_data.dict())
        db.add(db_org)
        await db.commit()
        await db.refresh(db_org)
        
        # 创建审计日志
        await create_audit_log(
            db=db,
            user_id=current_user.id,
            entity_type="organization",
            entity_id=db_org.id,
            action="create",
            details=org_data.dict()
        )
        
        return db_org
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="组织名称已存在"
        )


@router.get("/organizations", response_model=List[OrganizationResponse])
async def read_organizations(
    org_type: Optional[str] = None,
    project_id: Optional[int] = None,
    q: Optional[str] = None,
    include_project_scoped: bool = False,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取组织列表"""
    query = select(Organization).where(Organization.is_active == True)
    
    if org_type:
        query = query.where(Organization.org_type == org_type)
    
    if project_id is not None:
        # 显式指定 project_id：返回该项目下的组织（历史兼容：项目专属组织）
        query = query.where(Organization.project_id == project_id)
    else:
        # 未指定 project_id：默认仅返回全局组织（project_id 为空）
        if not include_project_scoped:
            query = query.where(Organization.project_id.is_(None))

    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            (Organization.name.ilike(like)) |
            (Organization.contact_person.ilike(like))
        )
    
    result = await db.execute(query.order_by(Organization.name))
    orgs = result.scalars().all()
    return orgs  # Pydantic 会自动转换


@router.put("/organizations/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: int,
    org_data: OrganizationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新组织信息"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    # 查找组织
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    db_org = result.scalar_one_or_none()
    
    if not db_org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    # 记录原始数据
    original_data = {
        "name": db_org.name,
        "org_type": db_org.org_type,
        "address": db_org.address,
        "contact_person": db_org.contact_person,
        "contact_phone": db_org.contact_phone,
        "contact_email": db_org.contact_email
    }
    
    # 更新数据
    update_data = org_data.dict(exclude={"audit_reason"})
    for key, value in update_data.items():
        setattr(db_org, key, value)
    
    db_org.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_org)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="organization",
        entity_id=db_org.id,
        action="update",
        details={
            "original": original_data,
            "updated": update_data
        },
        reason=org_data.audit_reason
    )
    
    return db_org


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除组织（软删除）"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    # 查找组织
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    db_org = result.scalar_one_or_none()
    
    if not db_org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    # 软删除
    db_org.is_active = False
    db_org.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="organization",
        entity_id=db_org.id,
        action="delete",
        details={"name": db_org.name, "org_type": db_org.org_type}
    )
    
    return {"message": "组织删除成功"}


@router.post("/sample-types", response_model=SampleTypeResponse)
async def create_sample_type(
    sample_type_data: SampleTypeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建样本类型配置"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    db_sample_type = SampleType(**sample_type_data.dict())
    db.add(db_sample_type)
    await db.commit()
    await db.refresh(db_sample_type)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="sample_type",
        entity_id=db_sample_type.id,
        action="create",
        details=sample_type_data.dict()
    )
    
    return db_sample_type


@router.get("/sample-types", response_model=List[SampleTypeResponse])
async def read_sample_types(
    category: Optional[str] = None,
    project_id: Optional[int] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本类型配置列表"""
    query = select(SampleType).where(SampleType.is_active == True)
    
    if category:
        query = query.where(SampleType.category == category)
    
    if project_id:
        query = query.where(SampleType.project_id == project_id)
        
    query = query.order_by(SampleType.id)
    
    result = await db.execute(query)
    sample_types = result.scalars().all()
    return sample_types


@router.put("/sample-types/{sample_type_id}", response_model=SampleTypeResponse)
async def update_sample_type(
    sample_type_id: int,
    sample_type_data: SampleTypeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新样本类型配置"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    # 查找样本类型
    result = await db.execute(
        select(SampleType).where(SampleType.id == sample_type_id)
    )
    db_sample_type = result.scalar_one_or_none()
    
    if not db_sample_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="样本类型不存在"
        )
    
    # 记录原始数据
    original_data = {
        "category": db_sample_type.category,
        "cycle_group": db_sample_type.cycle_group,
        "test_type": db_sample_type.test_type,
        "code": db_sample_type.code,
        "primary_codes": db_sample_type.primary_codes,
        "backup_codes": db_sample_type.backup_codes,
        "primary_count": db_sample_type.primary_count,
        "backup_count": db_sample_type.backup_count,
        "purpose": db_sample_type.purpose,
        "transport_method": db_sample_type.transport_method,
        "status": db_sample_type.status,
        "special_notes": db_sample_type.special_notes
    }
    
    # 更新数据
    update_data = sample_type_data.dict(exclude={"audit_reason"})
    for key, value in update_data.items():
        setattr(db_sample_type, key, value)
    
    db_sample_type.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_sample_type)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="sample_type",
        entity_id=db_sample_type.id,
        action="update",
        details={
            "original": original_data,
            "updated": update_data
        },
        reason=sample_type_data.audit_reason
    )
    
    return db_sample_type


@router.delete("/sample-types/{sample_type_id}")
async def delete_sample_type(
    sample_type_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除样本类型配置（软删除）"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    # 查找样本类型
    result = await db.execute(
        select(SampleType).where(SampleType.id == sample_type_id)
    )
    db_sample_type = result.scalar_one_or_none()
    
    if not db_sample_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="样本类型不存在"
        )
    
    # 软删除
    db_sample_type.is_active = False
    db_sample_type.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="sample_type",
        entity_id=db_sample_type.id,
        action="delete",
        details={
            "category": db_sample_type.category,
            "test_type": db_sample_type.test_type
        }
    )
    
    return {"message": "样本类型删除成功"}


# ==================== 组织类型管理 ====================

@router.get("/organization-types", response_model=List[OrganizationTypeResponse])
async def read_organization_types(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取所有组织类型"""
    result = await db.execute(
        select(OrganizationType)
        .where(OrganizationType.is_active == True)
        .order_by(OrganizationType.display_order, OrganizationType.id)
    )
    return result.scalars().all()


@router.post("/organization-types", response_model=OrganizationTypeResponse)
async def create_organization_type(
    org_type_data: OrganizationTypeCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建新的组织类型"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    # 检查value是否已存在
    result = await db.execute(
        select(OrganizationType).where(OrganizationType.value == org_type_data.value)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="组织类型值已存在"
        )
    
    # 创建新的组织类型
    db_org_type = OrganizationType(
        value=org_type_data.value,
        label=org_type_data.label,
        display_order=org_type_data.display_order or 0,
        is_system=False,  # 用户创建的不是系统预置
        is_active=True
    )
    
    db.add(db_org_type)
    await db.commit()
    await db.refresh(db_org_type)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="organization_type",
        entity_id=db_org_type.id,
        action="create",
        details={
            "value": org_type_data.value,
            "label": org_type_data.label
        }
    )
    
    return db_org_type


@router.put("/organization-types/{type_id}", response_model=OrganizationTypeResponse)
async def update_organization_type(
    type_id: int,
    org_type_data: OrganizationTypeUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新组织类型"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    result = await db.execute(
        select(OrganizationType).where(OrganizationType.id == type_id)
    )
    db_org_type = result.scalar_one_or_none()
    
    if not db_org_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织类型不存在"
        )
    
    # 记录原始数据
    original_data = {
        "label": db_org_type.label,
        "display_order": db_org_type.display_order,
        "is_active": db_org_type.is_active
    }
    
    # 更新字段
    if org_type_data.label is not None:
        db_org_type.label = org_type_data.label
    if org_type_data.display_order is not None:
        db_org_type.display_order = org_type_data.display_order
    if org_type_data.is_active is not None:
        db_org_type.is_active = org_type_data.is_active
    
    db_org_type.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_org_type)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="organization_type",
        entity_id=db_org_type.id,
        action="update",
        details={
            "original": original_data,
            "updated": {
                "label": db_org_type.label,
                "display_order": db_org_type.display_order,
                "is_active": db_org_type.is_active
            }
        }
    )
    
    return db_org_type


@router.delete("/organization-types/{type_id}")
async def delete_organization_type(
    type_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除组织类型（软删除，系统预置类型不可删除）"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    result = await db.execute(
        select(OrganizationType).where(OrganizationType.id == type_id)
    )
    db_org_type = result.scalar_one_or_none()
    
    if not db_org_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织类型不存在"
        )
    
    if db_org_type.is_system:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="系统预置的组织类型不能删除"
        )
    
    # 检查是否有组织在使用这个类型
    org_result = await db.execute(
        select(Organization).where(
            Organization.org_type == db_org_type.value,
            Organization.is_active == True
        ).limit(1)
    )
    if org_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该组织类型正在使用中，无法删除"
        )
    
    # 软删除
    db_org_type.is_active = False
    db_org_type.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="organization_type",
        entity_id=db_org_type.id,
        action="delete",
        details={
            "value": db_org_type.value,
            "label": db_org_type.label
        }
    )
    
    return {"message": "组织类型删除成功"}


# ==================== 采血点管理 ====================

@router.get("/collection-points", response_model=List[CollectionPointResponse])
async def get_collection_points(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取全局采血点列表"""
    result = await db.execute(
        select(CollectionPoint)
        .where(CollectionPoint.is_active == True, CollectionPoint.project_id == None)
        .order_by(CollectionPoint.display_order, CollectionPoint.code)
    )
    return result.scalars().all()


@router.post("/collection-points", response_model=CollectionPointResponse)
async def create_collection_point(
    point_data: CollectionPointCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建采血点"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    # 检查编号是否已存在
    existing = await db.execute(
        select(CollectionPoint).where(
            CollectionPoint.code == point_data.code,
            CollectionPoint.project_id == None,
            CollectionPoint.is_active == True
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"采血点编号 '{point_data.code}' 已存在"
        )
    
    db_point = CollectionPoint(
        code=point_data.code,
        name=point_data.name,
        time_description=point_data.time_description,
        display_order=point_data.display_order,
        project_id=None  # 全局采血点
    )
    db.add(db_point)
    await db.commit()
    await db.refresh(db_point)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="collection_point",
        entity_id=db_point.id,
        action="create",
        details={
            "code": db_point.code,
            "name": db_point.name,
            "time_description": db_point.time_description
        }
    )
    
    return db_point


@router.put("/collection-points/{point_id}", response_model=CollectionPointResponse)
async def update_collection_point(
    point_id: int,
    point_data: CollectionPointUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新采血点"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    result = await db.execute(
        select(CollectionPoint).where(CollectionPoint.id == point_id)
    )
    db_point = result.scalar_one_or_none()
    
    if not db_point:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="采血点不存在"
        )
    
    # 记录原始数据
    original_data = {
        "code": db_point.code,
        "name": db_point.name,
        "time_description": db_point.time_description,
        "display_order": db_point.display_order,
        "is_active": db_point.is_active
    }
    
    # 如果更新编号，检查是否重复
    if point_data.code and point_data.code != db_point.code:
        existing = await db.execute(
            select(CollectionPoint).where(
                CollectionPoint.code == point_data.code,
                CollectionPoint.project_id == None,
                CollectionPoint.is_active == True,
                CollectionPoint.id != point_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"采血点编号 '{point_data.code}' 已存在"
            )
    
    # 更新字段
    if point_data.code is not None:
        db_point.code = point_data.code
    if point_data.name is not None:
        db_point.name = point_data.name
    if point_data.time_description is not None:
        db_point.time_description = point_data.time_description
    if point_data.display_order is not None:
        db_point.display_order = point_data.display_order
    if point_data.is_active is not None:
        db_point.is_active = point_data.is_active
    
    db_point.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_point)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="collection_point",
        entity_id=db_point.id,
        action="update",
        details={
            "original": original_data,
            "updated": {
                "code": db_point.code,
                "name": db_point.name,
                "time_description": db_point.time_description,
                "display_order": db_point.display_order,
                "is_active": db_point.is_active
            }
        },
        reason=point_data.audit_reason
    )
    
    return db_point


@router.delete("/collection-points/{point_id}")
async def delete_collection_point(
    point_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """删除采血点（软删除）"""
    if not check_global_params_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限管理全局参数"
        )
    
    result = await db.execute(
        select(CollectionPoint).where(CollectionPoint.id == point_id)
    )
    db_point = result.scalar_one_or_none()
    
    if not db_point:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="采血点不存在"
        )
    
    # 软删除
    db_point.is_active = False
    db_point.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="collection_point",
        entity_id=db_point.id,
        action="delete",
        details={
            "code": db_point.code,
            "name": db_point.name
        }
    )
    
    return {"message": "采血点删除成功"}

