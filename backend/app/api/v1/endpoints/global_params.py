from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import get_db
from app.models.global_params import Organization, SampleType
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

# Pydantic schemas
class OrganizationCreate(BaseModel):
    name: str
    org_type: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None

class OrganizationUpdate(OrganizationCreate):
    audit_reason: str  # 修改理由

class SampleTypeCreate(BaseModel):
    category: str = "clinical"  # clinical, stability, qc
    cycle_group: Optional[str] = None
    test_type: Optional[str] = None
    code: Optional[str] = None
    primary_count: int = 1
    backup_count: int = 1
    purpose: Optional[str] = None
    transport_method: Optional[str] = None
    status: Optional[str] = None
    special_notes: Optional[str] = None

class SampleTypeUpdate(SampleTypeCreate):
    audit_reason: str  # 修改理由

class OrganizationResponse(BaseModel):
    id: int
    name: str
    org_type: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True  # 允许从 ORM 对象创建

class SampleTypeResponse(BaseModel):
    id: int
    category: str
    cycle_group: Optional[str] = None
    test_type: Optional[str] = None
    code: Optional[str] = None
    primary_count: int
    backup_count: int
    purpose: Optional[str] = None
    transport_method: Optional[str] = None
    status: Optional[str] = None
    special_notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


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
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取组织列表"""
    query = select(Organization).where(Organization.is_active == True)
    
    if org_type:
        query = query.where(Organization.org_type == org_type)
    
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
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取样本类型配置列表"""
    query = select(SampleType).where(SampleType.is_active == True)
    
    if category:
        query = query.where(SampleType.category == category)
        
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
