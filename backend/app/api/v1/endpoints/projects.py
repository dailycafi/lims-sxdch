from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.project import Project
from app.models.user import User, UserRole
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


def check_project_permission(user: User) -> bool:
    """检查项目管理权限"""
    allowed_roles = [UserRole.SYSTEM_ADMIN, UserRole.SAMPLE_ADMIN]
    return user.role in allowed_roles


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
    query = select(Project)
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
    result = await db.execute(select(Project).where(Project.id == project_id))
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
