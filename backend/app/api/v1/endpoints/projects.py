from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime
from itertools import product

from app.core.database import get_db
from app.models.project import Project
from app.models.project_organization import ProjectOrganization
from app.models.test_group import TestGroup
from app.models.sample import (
    Sample,
    SampleReceiveRecord,
    SampleBorrowRequest,
    SampleTransferRecord,
    SampleDestroyRequest,
)
from app.models.deviation import Deviation
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.api.v1.endpoints.auth import get_current_user
from app.core.security import pwd_context
from app.services.sample_service import generate_sample_codes_logic
from app.api.v1.deps import assert_project_access, get_accessible_project_ids, is_project_admin
from app.models.project_member import ProjectMember
from app.models.global_params import Organization as GlobalOrganization

router = APIRouter()


# Pydantic schemas for sample code rule
class SampleCodeRuleUpdate(BaseModel):
    sample_code_rule: dict
    audit_reason: str


class ProjectOrganizationLinkCreate(BaseModel):
    organization_id: int
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None


class ProjectOrganizationLinkUpdate(BaseModel):
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    audit_reason: str


class OrganizationBrief(BaseModel):
    id: int
    project_id: Optional[int] = None
    name: str
    org_type: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class ProjectOrganizationLinkResponse(BaseModel):
    id: int
    project_id: int
    organization_id: int
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    organization: OrganizationBrief

    class Config:
        from_attributes = True


def check_project_permission(user: User) -> bool:
    """检查项目管理权限"""
    allowed_roles = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    return user.role in allowed_roles


def is_super_admin(user: User) -> bool:
    """检查是否为超级管理员（可执行特殊删除操作）"""
    return user.role == UserRole.SUPER_ADMIN or user.is_superuser


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


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """创建新项目（仅样本管理员）"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以创建项目"
        )
    
    # 检查实验室项目编号是否已存在
    result = await db.execute(
        select(Project).where(Project.lab_project_code == project_data.lab_project_code)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="实验室项目编号已存在"
        )
    
    # 检查申办方项目编号是否已存在
    if project_data.sponsor_project_code:
        result = await db.execute(
            select(Project).where(Project.sponsor_project_code == project_data.sponsor_project_code)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="申办方项目编号已存在"
            )
    
    try:
        # exclude clinical_org_ids as it is not a model field
        create_data = project_data.model_dump(exclude={"clinical_org_ids"})
        db_project = Project(
            **create_data,
            created_by=current_user.id
        )
        db.add(db_project)
        await db.flush()  # 获取 id

        # 处理多个临床机构
        if project_data.clinical_org_ids:
            for org_id in project_data.clinical_org_ids:
                link = ProjectOrganization(
                    project_id=db_project.id,
                    organization_id=org_id,
                    is_active=True
                )
                db.add(link)
            
            # 如果提供了 clinical_org_ids，将第一个设置为 clinical_org_id 以保持兼容
            if not db_project.clinical_org_id:
                db_project.clinical_org_id = project_data.clinical_org_ids[0]

        await db.commit()
        
        # 重新查询并加载关联对象
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Project)
            .options(
                selectinload(Project.sponsor),
                selectinload(Project.clinical_org),
                selectinload(Project.associated_organizations).selectinload(ProjectOrganization.organization)
            )
            .where(Project.id == db_project.id)
        )
        db_project = result.scalar_one()
        db_project.clinical_orgs = [assoc.organization for assoc in db_project.associated_organizations if assoc.organization.org_type == 'clinical']
        
        return db_project
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="创建项目失败"
        )


@router.get("/", response_model=List[ProjectResponse])
async def read_projects(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取项目列表"""
    from sqlalchemy.orm import selectinload
    
    query = select(Project).options(
        selectinload(Project.sponsor),
        selectinload(Project.clinical_org),
        selectinload(Project.associated_organizations).selectinload(ProjectOrganization.organization)
    )
    if active_only:
        query = query.where(Project.is_active == True)

    # 可见性过滤：非管理员仅返回被授权的项目
    if current_user and not is_project_admin(current_user):
        accessible_ids = await get_accessible_project_ids(db, current_user)
        if not accessible_ids:
            return []
        query = query.where(Project.id.in_(accessible_ids))
    
    result = await db.execute(query.offset(skip).limit(limit))
    projects = result.scalars().all()
    
    # 手动处理 clinical_orgs 列表
    for p in projects:
        p.clinical_orgs = [assoc.organization for assoc in p.associated_organizations if assoc.organization.org_type == 'clinical']
        
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def read_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取项目详情"""
    from sqlalchemy.orm import selectinload

    # 可见性校验
    await assert_project_access(db, current_user, project_id)
    
    result = await db.execute(
        select(Project)
        .options(
            selectinload(Project.sponsor),
            selectinload(Project.clinical_org),
            selectinload(Project.associated_organizations).selectinload(ProjectOrganization.organization)
        )
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 手动处理 clinical_orgs 列表
    project.clinical_orgs = [assoc.organization for assoc in project.associated_organizations if assoc.organization.org_type == 'clinical']
    
    return project


@router.get("/{project_id}/organizations", response_model=List[ProjectOrganizationLinkResponse])
async def list_project_organizations(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """获取项目关联组织列表（项目可见性范围内）"""
    from sqlalchemy.orm import selectinload

    await assert_project_access(db, current_user, project_id)
    result = await db.execute(
        select(ProjectOrganization)
        .options(selectinload(ProjectOrganization.organization))
        .where(ProjectOrganization.project_id == project_id)
        .where(ProjectOrganization.is_active == True)
        .order_by(ProjectOrganization.id.desc())
    )
    return result.scalars().all()


@router.post("/{project_id}/organizations", response_model=ProjectOrganizationLinkResponse)
async def add_project_organization(
    project_id: int,
    payload: ProjectOrganizationLinkCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """为项目关联一个全局组织（并可写入项目维度联系人/备注）"""
    from sqlalchemy.orm import selectinload

    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限修改项目组织")
    await assert_project_access(db, current_user, project_id)

    org_res = await db.execute(select(GlobalOrganization).where(GlobalOrganization.id == payload.organization_id))
    org = org_res.scalar_one_or_none()
    if not org or not org.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="组织不存在或已停用")

    # 查找是否已关联（支持恢复软删除）
    link_res = await db.execute(
        select(ProjectOrganization)
        .where(ProjectOrganization.project_id == project_id)
        .where(ProjectOrganization.organization_id == payload.organization_id)
    )
    link = link_res.scalar_one_or_none()
    if link:
        original = {
            "is_active": link.is_active,
            "contact_person": link.contact_person,
            "contact_phone": link.contact_phone,
            "contact_email": link.contact_email,
            "notes": link.notes,
        }
        link.is_active = True
        link.contact_person = payload.contact_person
        link.contact_phone = payload.contact_phone
        link.contact_email = payload.contact_email
        link.notes = payload.notes
        link.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(link)
        await create_audit_log(
            db=db,
            user_id=current_user.id,
            entity_type="project_organization",
            entity_id=link.id,
            action="upsert",
            details={"original": original, "updated": payload.model_dump()},
        )
    else:
        link = ProjectOrganization(
            project_id=project_id,
            organization_id=payload.organization_id,
            contact_person=payload.contact_person,
            contact_phone=payload.contact_phone,
            contact_email=payload.contact_email,
            notes=payload.notes,
        )
        db.add(link)
        await db.commit()
        await db.refresh(link)
        await create_audit_log(
            db=db,
            user_id=current_user.id,
            entity_type="project_organization",
            entity_id=link.id,
            action="create",
            details=payload.model_dump() | {"project_id": project_id},
        )

    # 返回带 organization 的对象
    res = await db.execute(
        select(ProjectOrganization)
        .options(selectinload(ProjectOrganization.organization))
        .where(ProjectOrganization.id == link.id)
    )
    return res.scalar_one()


@router.patch("/{project_id}/organizations/{link_id}", response_model=ProjectOrganizationLinkResponse)
async def update_project_organization(
    project_id: int,
    link_id: int,
    payload: ProjectOrganizationLinkUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """更新项目-组织关联信息（需要审计理由）"""
    from sqlalchemy.orm import selectinload

    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限修改项目组织")
    await assert_project_access(db, current_user, project_id)
    if not payload.audit_reason or not payload.audit_reason.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="修改理由不能为空")

    res = await db.execute(
        select(ProjectOrganization)
        .options(selectinload(ProjectOrganization.organization))
        .where(ProjectOrganization.id == link_id)
        .where(ProjectOrganization.project_id == project_id)
    )
    link = res.scalar_one_or_none()
    if not link or not link.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="关联记录不存在")

    original = {
        "contact_person": link.contact_person,
        "contact_phone": link.contact_phone,
        "contact_email": link.contact_email,
        "notes": link.notes,
    }
    link.contact_person = payload.contact_person
    link.contact_phone = payload.contact_phone
    link.contact_email = payload.contact_email
    link.notes = payload.notes
    link.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(link)

    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project_organization",
        entity_id=link.id,
        action="update",
        details={"original": original, "updated": payload.model_dump(exclude={"audit_reason"})},
        reason=payload.audit_reason,
    )
    return link


@router.delete("/{project_id}/organizations/{link_id}")
async def remove_project_organization(
    project_id: int,
    link_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """移除项目-组织关联（软删除）"""
    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限修改项目组织")
    await assert_project_access(db, current_user, project_id)

    res = await db.execute(
        select(ProjectOrganization)
        .where(ProjectOrganization.id == link_id)
        .where(ProjectOrganization.project_id == project_id)
    )
    link = res.scalar_one_or_none()
    if not link or not link.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="关联记录不存在")

    link.is_active = False
    link.updated_at = datetime.utcnow()
    await db.commit()

    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project_organization",
        entity_id=link.id,
        action="delete",
        details={"project_id": project_id, "organization_id": link.organization_id},
    )
    return {"message": "已移除项目关联组织"}


class ProjectMembersUpdate(BaseModel):
    user_ids: List[int]


@router.get("/{project_id}/members", response_model=List[int])
async def list_project_members(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """获取项目成员（仅项目管理员）"""
    if not is_project_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限管理项目成员")
    result = await db.execute(select(ProjectMember.user_id).where(ProjectMember.project_id == project_id))
    return list(result.scalars().all())


@router.put("/{project_id}/members", response_model=List[int])
async def replace_project_members(
    project_id: int,
    payload: ProjectMembersUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """替换项目成员列表（仅项目管理员）"""
    if not is_project_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限管理项目成员")

    # 清空旧成员
    old = await db.execute(select(ProjectMember).where(ProjectMember.project_id == project_id))
    for row in old.scalars().all():
        await db.delete(row)
    await db.flush()

    # 写入新成员（去重）
    uniq_user_ids = list(dict.fromkeys([int(x) for x in payload.user_ids if x is not None]))
    for uid in uniq_user_ids:
        db.add(ProjectMember(project_id=project_id, user_id=uid))
    await db.commit()
    return uniq_user_ids


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_update: ProjectUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新项目信息"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改项目"
        )
    
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 检查是否已有样本，如果有则不能修改编号规则
    if project_update.sample_code_rule is not None:
        sample_count_res = await db.execute(
            select(func.count()).select_from(Sample).where(Sample.project_id == project_id)
        )
        if sample_count_res.scalar_one() > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="项目已有样本，无法修改编号规则"
            )
    
    # 检查实验室项目编号唯一性
    if project_update.lab_project_code and project_update.lab_project_code != project.lab_project_code:
        existing = await db.execute(
            select(Project).where(
                Project.lab_project_code == project_update.lab_project_code,
                Project.id != project_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="实验室项目编号已存在"
            )
    
    # 检查申办方项目编号唯一性
    if project_update.sponsor_project_code and project_update.sponsor_project_code != project.sponsor_project_code:
        existing = await db.execute(
            select(Project).where(
                Project.sponsor_project_code == project_update.sponsor_project_code,
                Project.id != project_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="申办方项目编号已存在"
            )
    
    # 记录原始数据
    original_data = {
        "sponsor_project_code": project.sponsor_project_code,
        "lab_project_code": project.lab_project_code,
        "sponsor_id": project.sponsor_id,
    }
    
    update_data = project_update.model_dump(exclude_unset=True, exclude={"audit_reason"})
    for field, value in update_data.items():
        setattr(project, field, value)
    
    project.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(project)
    
    # 创建审计日志
    if project_update.audit_reason:
        await create_audit_log(
            db=db,
            user_id=current_user.id,
            entity_type="project",
            entity_id=project.id,
            action="update",
            details={
                "original": original_data,
                "updated": update_data
            },
            reason=project_update.audit_reason
        )
    
    return project


@router.post("/{project_id}/archive")
async def archive_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """归档项目"""
    # 权限检查 - 需要通过审批流程
    allowed_roles = [UserRole.SYSTEM_ADMIN]
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要系统管理员权限"
        )
    
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    if project.is_archived:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目已归档"
        )
    
    project.is_archived = True
    project.is_active = False
    
    await db.commit()
    
    return {"message": "项目已归档"}


class ProjectDeleteRequest(BaseModel):
    reason: str
    password: Optional[str] = None


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    delete_data: Optional[ProjectDeleteRequest] = None,
    db: AsyncSession = Depends(get_db)
):
    """删除项目（仅系统管理员，可删除无关联数据的项目；超级管理员可强制删除）"""
    if current_user.role not in [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要系统管理员权限"
        )

    # 验证删除理由
    delete_reason = "未提供理由"
    if delete_data and delete_data.reason:
        delete_reason = delete_data.reason.strip()
    
    if not delete_reason or delete_reason == "未提供理由":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="删除项目必须提供理由"
        )

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    # 超级管理员可以删除归档项目
    if project.is_archived and not is_super_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="归档项目不可删除"
        )

    # 删除前检查是否存在关联数据（超级管理员可跳过检查）
    if not is_super_admin(current_user):
        related_models = [
            (Sample, "样本"),
            (SampleReceiveRecord, "样本接收记录"),
            (SampleBorrowRequest, "样本领用申请"),
            (SampleTransferRecord, "样本转移记录"),
            (SampleDestroyRequest, "样本销毁申请"),
            (Deviation, "偏差记录"),
        ]

        for model, label in related_models:
            result = await db.execute(
                select(func.count()).select_from(model).where(model.project_id == project_id)
            )
            if result.scalar_one() > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"项目存在关联{label}，无法删除"
                )

    try:
        # 记录审计日志（包含删除理由）
        await create_audit_log(
            db=db,
            user_id=current_user.id,
            entity_type="project",
            entity_id=project.id,
            action="delete" if not is_super_admin(current_user) else "force_delete",
            details={
                "project_code": project.lab_project_code,
                "sponsor_code": project.sponsor_project_code,
                "is_archived": project.is_archived
            },
            reason=delete_reason
        )
        await db.delete(project)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="项目存在关联数据，无法删除"
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{project_id}/sample-code-rule")
async def update_sample_code_rule(
    project_id: int,
    rule_data: SampleCodeRuleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """更新项目的样本编号规则"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以配置样本编号规则"
        )
    # 二次认证：要求在 audit_reason 中附带 e-signature 密码字段（简单兼容）
    # 例如：{"reason": "修改编号规则", "password": "xxx"}
    # 若前端尚未传此格式，可跳过；未来可切换到独立 verify-signature 接口前置校验
    try:
        if isinstance(rule_data.audit_reason, str) and rule_data.audit_reason.strip().startswith('{'):
            import json as _json
            payload = _json.loads(rule_data.audit_reason)
            password = payload.get('password')
            reason_text = payload.get('reason') or ''
            if not password:
                raise ValueError('missing password')
            if not pwd_context.verify(password, current_user.hashed_password):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="电子签名验证失败")
            # 用纯理由写入审计
            rule_data.audit_reason = reason_text or '更新编号规则'
    except Exception:
        # 兼容旧入参，不阻断（但建议前端改造为显式二次验证）
        pass
    
    # 查找项目
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 检查是否已有样本接收，如果有则不允许修改（超级管理员除外）
    if not is_super_admin(current_user):
        sample_count_result = await db.execute(
            select(func.count()).select_from(Sample).where(Sample.project_id == project_id)
        )
        sample_count = sample_count_result.scalar_one()
        if sample_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"项目已有 {sample_count} 个样本接收，编号规则已锁定，不能修改"
            )
    
    # 记录原始规则
    original_rule = project.sample_code_rule
    
    # 更新规则
    project.sample_code_rule = rule_data.sample_code_rule
    project.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(project)
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="update_sample_code_rule",
        details={
            "original": original_rule,
            "updated": rule_data.sample_code_rule
        },
        reason=rule_data.audit_reason
    )
    
    return {"message": "样本编号规则已更新", "sample_code_rule": project.sample_code_rule}


@router.post("/{project_id}/generate-sample-codes")
async def generate_sample_codes(
    project_id: int,
    generation_params: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """批量生成样本编号"""
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以生成样本编号"
        )
    
    # 查找项目
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    if not project.sample_code_rule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先配置样本编号规则"
        )
    
    unique_codes = generate_sample_codes_logic(project, generation_params)
    max_count = int(generation_params.get("max_count", 5000))
    unique_codes = unique_codes[:max_count]
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="generate_sample_codes",
        details={
            "parameters": generation_params,
            "count": len(unique_codes)
        }
    )
    
    return {
        "message": f"成功生成{len(unique_codes)}个样本编号",
        "sample_codes": unique_codes
    }


@router.post("/{project_id}/import-subjects")
async def import_subjects(
    project_id: int,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导入受试者编号（Excel），返回受试者编号字符串数组。支持首列为受试者编号，或列名为subject/受试者/受试者编号。"""
    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限")

    try:
        content = await file.read()
        import pandas as _pd
        import io as _io
        df = _pd.read_excel(_io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Excel 解析失败")

    cols = [str(c).strip().lower() for c in df.columns]
    subject_col_idx = 0
    for idx, name in enumerate(cols):
        if name in ["subject", "subject_id", "受试者", "受试者编号", "被试者", "编号"]:
            subject_col_idx = idx
            break

    subjects: List[str] = []
    for val in df.iloc[:, subject_col_idx].astype(str).tolist():
        s = val.strip()
        if not s or s.lower() in ["nan", "none"]:
            continue
        subjects.append(s)

    if not subjects:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未识别到受试者编号")

    # 去重并限制
    subjects = list(dict.fromkeys(subjects))[:5000]
    return {"subjects": subjects}


@router.post("/{project_id}/import-clinic-subjects")
async def import_clinic_subjects(
    project_id: int,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导入临床机构-受试者配对（Excel）。支持两列(clinic,subject)或中文列(临床机构,受试者编号)。"""
    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限")

    try:
        content = await file.read()
        import pandas as _pd
        import io as _io
        df = _pd.read_excel(_io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Excel 解析失败")

    cols = [str(c).strip().lower() for c in df.columns]
    clinic_alias = ["clinic", "clinic_code", "临床机构", "临床机构序号", "分中心", "分中心序号", "机构"]
    subject_alias = ["subject", "subject_id", "受试者", "受试者编号", "被试者", "编号"]

    def _find_col(candidates: List[str]) -> Optional[int]:
        for idx, name in enumerate(cols):
            if name in candidates:
                return idx
        return None

    clinic_idx = _find_col(clinic_alias)
    subject_idx = _find_col(subject_alias)
    
    # 如果未找到明确列名，默认第一列为临床机构，第二列为受试者
    if clinic_idx is None:
        clinic_idx = 0
    if subject_idx is None:
        subject_idx = 1 if len(df.columns) > 1 else 0

    pairs: List[dict] = []
    clinic_series = df.iloc[:, clinic_idx].astype(str).tolist()
    subject_series = df.iloc[:, subject_idx].astype(str).tolist()
    
    for c, s in zip(clinic_series, subject_series):
        c, s = c.strip(), s.strip()
        if not c or c.lower() in ["nan", "none"]:
            continue
        if not s or s.lower() in ["nan", "none"]:
            continue
        pairs.append({"clinic": c, "subject": s})

    if not pairs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未识别到临床机构-受试者配对")

    # 去重并限制
    uniq = []
    seen = set()
    for p in pairs:
        key = (p.get("clinic", ""), p.get("subject", ""))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
        if len(uniq) >= 5000:
            break
    return {"clinic_subject_pairs": uniq}


@router.post("/{project_id}/import-seq-times")
async def import_seq_times(
    project_id: int,
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """导入采血序号/时间对（Excel）。支持两列(seq,time)或中文列(序号,时间)，或单列pair如01/0h。"""
    if not check_project_permission(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有权限")

    try:
        content = await file.read()
        import pandas as _pd
        import io as _io
        df = _pd.read_excel(_io.BytesIO(content))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Excel 解析失败")

    cols = [str(c).strip().lower() for c in df.columns]
    seq_alias = ["seq", "序号", "采血序号", "序"]
    time_alias = ["time", "时间", "采血时间", "时"]

    def _find_col(candidates: List[str]) -> Optional[int]:
        for idx, name in enumerate(cols):
            if name in candidates:
                return idx
        return None

    seq_idx = _find_col(seq_alias)
    time_idx = _find_col(time_alias)

    pairs: List[dict] = []
    if seq_idx is not None and time_idx is not None:
        seq_series = df.iloc[:, seq_idx].astype(str).tolist()
        time_series = df.iloc[:, time_idx].astype(str).tolist()
        for s, t in zip(seq_series, time_series):
            s, t = s.strip(), t.strip()
            if not s or s.lower() in ["nan", "none"]:
                continue
            pairs.append({"seq": s, "time": t})
    else:
        # 尝试单列表达
        for col in df.columns:
            series = df[col].astype(str).tolist()
            for token in series:
                token = token.strip()
                if not token or token.lower() in ["nan", "none"]:
                    continue
                if "/" in token:
                    parts = token.split("/")
                    s = parts[0].strip()
                    t = parts[1].strip() if len(parts) > 1 else ""
                    pairs.append({"seq": s, "time": t})

    if not pairs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未识别到采血序号/时间")

    # 去重并限制
    uniq = []
    seen = set()
    for p in pairs:
        key = (p.get("seq", ""), p.get("time", ""))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
        if len(uniq) >= 5000:
            break
    return {"seq_time_pairs": uniq}


class StabilityQCCodeGenerate(BaseModel):
    """稳定性及质控样本编号生成参数"""
    sample_category: str  # STB 或 QC
    code: str  # 代码，如 L, M, H
    quantity: int  # 数量
    start_number: int = 1  # 起始编号


@router.post("/{project_id}/generate-stability-qc-codes")
async def generate_stability_qc_codes(
    project_id: int,
    params: StabilityQCCodeGenerate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """生成稳定性及质控样本编号"""
    # 检查权限
    if current_user.role not in [UserRole.SAMPLE_ADMIN, UserRole.SYSTEM_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以生成样本编号"
        )
    
    # 获取项目
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # 生成编号
    # 格式：样本类别-代码-序号
    # 例如：STB-L-31
    sample_codes = []
    for i in range(params.quantity):
        code_number = params.start_number + i
        sample_code = f"{params.sample_category}-{params.code}-{code_number}"
        sample_codes.append(sample_code)
    
    # 记录审计日志
    await create_audit_log(
        db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project_id,
        action="generate_stability_qc_codes",
        details={
            "project_code": project.lab_project_code,
            "sample_category": params.sample_category,
            "code": params.code,
            "quantity": params.quantity,
            "start_number": params.start_number,
            "generated_codes": sample_codes[:10]  # 只记录前10个
        }
    )
    
    return {
        "sample_codes": sample_codes,
        "count": len(sample_codes)
    }


@router.post("/{project_id}/generate-all-sample-codes")
async def generate_all_sample_codes(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """
    根据项目的所有试验组配置，一键生成所有临床样本编号。
    此端点会读取项目中所有已确认的试验组，根据其配置自动生成样本编号。
    """
    if not check_project_permission(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有样本管理员可以生成样本编号"
        )

    # 获取项目
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )

    if not project.sample_code_rule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先配置样本编号规则"
        )

    # 获取所有已确认的试验组
    test_groups_result = await db.execute(
        select(TestGroup)
        .where(TestGroup.project_id == project_id)
        .where(TestGroup.is_active == True)
        .where(TestGroup.is_confirmed == True)
        .order_by(TestGroup.display_order)
    )
    test_groups = test_groups_result.scalars().all()

    if not test_groups:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="没有已确认的试验组，请先确认试验组配置"
        )

    all_sample_codes = []
    generation_summary = []

    for tg in test_groups:
        # 生成受试者编号列表
        subjects = []
        if tg.subject_prefix and tg.planned_count > 0:
            total_count = tg.planned_count + (tg.backup_subject_count or 0)
            for i in range(total_count):
                num = (tg.subject_start_number or 1) + i
                subjects.append(f"{tg.subject_prefix}{num:03d}")

        # 处理检测配置
        detection_configs = tg.detection_configs or []
        if not detection_configs:
            continue

        for detection in detection_configs:
            test_type = detection.get("test_type", "")
            collection_points = detection.get("collection_points", [])
            primary_sets = detection.get("primary_sets", 0)
            backup_sets = detection.get("backup_sets", 0)

            # 生成正份和备份代码
            primary_codes = []
            backup_codes = []

            # 从项目规则中获取正备份代码模式
            rule = project.sample_code_rule or {}
            dictionaries = rule.get("dictionaries", {})
            primary_types = dictionaries.get("primary_types", [])
            backup_types = dictionaries.get("backup_types", [])

            # 使用项目配置的正备份代码
            for i in range(primary_sets):
                if i < len(primary_types):
                    primary_codes.append(primary_types[i])
                else:
                    primary_codes.append(f"P{i+1}")

            for i in range(backup_sets):
                if i < len(backup_types):
                    backup_codes.append(backup_types[i])
                else:
                    backup_codes.append(f"B{i+1}")

            # 构建生成参数
            seq_time_pairs = []
            for cp in collection_points:
                seq_time_pairs.append({
                    "seq": cp.get("code", ""),
                    "time": cp.get("name", "")
                })

            if not seq_time_pairs:
                seq_time_pairs = [{"seq": "", "time": ""}]

            generation_params = {
                "cycles": [tg.cycle] if tg.cycle else [""],
                "test_types": [test_type] if test_type else [""],
                "subjects": subjects,
                "primary": primary_codes,
                "backup": backup_codes,
                "seq_time_pairs": seq_time_pairs,
                "clinic_codes": [""],
            }

            # 生成样本编号
            codes = generate_sample_codes_logic(project, generation_params)
            all_sample_codes.extend(codes)

            generation_summary.append({
                "test_group_id": tg.id,
                "test_group_cycle": tg.cycle,
                "test_type": test_type,
                "subjects_count": len(subjects),
                "collection_points_count": len(collection_points),
                "primary_sets": primary_sets,
                "backup_sets": backup_sets,
                "generated_count": len(codes)
            })

    # 去重
    unique_codes = list(dict.fromkeys(all_sample_codes))

    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="generate_all_sample_codes",
        details={
            "test_groups_count": len(test_groups),
            "total_codes_generated": len(unique_codes),
            "summary": generation_summary
        }
    )

    return {
        "message": f"成功生成 {len(unique_codes)} 个样本编号",
        "sample_codes": unique_codes,
        "count": len(unique_codes),
        "summary": generation_summary
    }
