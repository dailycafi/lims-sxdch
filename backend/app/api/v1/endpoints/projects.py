from typing import List, Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.project import Project
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# Pydantic schemas for sample code rule
class SampleCodeRuleUpdate(BaseModel):
    sample_code_rule: dict
    audit_reason: str


def check_project_permission(user: User) -> bool:
    """检查项目管理权限"""
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
    
    # 检查项目编号是否已存在
    result = await db.execute(
        select(Project).where(Project.lab_project_code == project_data.lab_project_code)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="实验室项目编号已存在"
        )
    
    try:
        db_project = Project(
            **project_data.model_dump(),
            created_by=current_user.id
        )
        db.add(db_project)
        await db.commit()
        await db.refresh(db_project)
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
        selectinload(Project.clinical_org)
    )
    if active_only:
        query = query.where(Project.is_active == True)
    
    result = await db.execute(query.offset(skip).limit(limit))
    projects = result.scalars().all()
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def read_project(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """获取项目详情"""
    from sqlalchemy.orm import selectinload
    
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.sponsor))
        .options(selectinload(Project.clinical_org))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    return project


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
        # TODO: 检查是否有样本
        pass
    
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
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
    
    # 查找项目
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="项目不存在"
        )
    
    # TODO: 检查是否已有样本接收，如果有则不允许修改
    # if project.has_samples:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="项目已有样本接收，不能修改编号规则"
    #     )
    
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
    
    # TODO: 实现批量生成样本编号的逻辑
    # 1. 解析generation_params中的参数
    # 2. 根据sample_code_rule生成编号
    # 3. 保存生成的编号到数据库
    # 4. 返回生成的编号列表
    
    generated_codes = []
    
    # 创建审计日志
    await create_audit_log(
        db=db,
        user_id=current_user.id,
        entity_type="project",
        entity_id=project.id,
        action="generate_sample_codes",
        details={
            "parameters": generation_params,
            "count": len(generated_codes)
        }
    )
    
    return {
        "message": f"成功生成{len(generated_codes)}个样本编号",
        "sample_codes": generated_codes
    }


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
    # 格式：临床试验研究室项目编号-样本类别-代码-序号
    # 例如：L2501-STB-L-31
    sample_codes = []
    for i in range(params.quantity):
        code_number = params.start_number + i
        sample_code = f"{project.lab_project_code}-{params.sample_category}-{params.code}-{code_number}"
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
