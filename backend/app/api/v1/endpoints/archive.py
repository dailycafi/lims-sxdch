from typing import Optional, Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_db
from app.models.project import Project, ProjectArchiveRequest
from app.models.sample import Sample, SampleStatus, SampleBorrowItem, SampleTransferRecord
from app.models.deviation import Deviation
from app.models.user import User, UserRole
from app.models.audit import AuditLog
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


# Pydantic schemas
class ArchiveRequestCreate(BaseModel):
    project_id: int
    reason: str
    completion_summary: Optional[str] = None
    final_report_path: Optional[str] = None


@router.post("/request")
async def create_archive_request(
    request_data: ArchiveRequestCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """申请项目归档"""
    # 检查项目是否存在
    result = await db.execute(
        select(Project).where(Project.id == request_data.project_id)
    )
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
    
    # 检查是否有未完成的事项
    summary = await get_project_archive_summary(request_data.project_id, current_user, db)
    
    if summary["unreturned_samples"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"还有 {summary['unreturned_samples']} 个样本未归还，无法申请归档"
        )
    
    if summary["pending_transfers"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"还有 {summary['pending_transfers']} 个转移未完成，无法申请归档"
        )
    
    if summary["active_deviations"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"还有 {summary['active_deviations']} 个偏差未关闭，无法申请归档"
        )
    
    # 创建归档申请
    archive_request = ProjectArchiveRequest(
        project_id=request_data.project_id,
        requested_by=current_user.id,
        reason=request_data.reason,
        completion_summary=request_data.completion_summary,
        final_report_path=request_data.final_report_path,
        status="pending"
    )
    
    db.add(archive_request)
    
    # 更新项目状态
    project.status = "pending_archive"
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="project_archive",
        entity_id=project.id,
        action="request",
        details={
            "project_code": project.lab_project_code,
            "reason": request_data.reason
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "归档申请已提交"}


@router.get("/requests")
async def get_archive_requests(
    status: Optional[str] = None,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取归档申请列表"""
    query = select(ProjectArchiveRequest).options(
        selectinload(ProjectArchiveRequest.project),
        selectinload(ProjectArchiveRequest.requester),
        selectinload(ProjectArchiveRequest.approver)
    )
    
    if status:
        query = query.where(ProjectArchiveRequest.status == status)
    
    query = query.order_by(ProjectArchiveRequest.created_at.desc())
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for req in requests:
        response.append({
            "id": req.id,
            "project": {
                "id": req.project.id,
                "lab_project_code": req.project.lab_project_code,
                "sponsor_project_code": req.project.sponsor_project_code,
                "status": req.project.status
            },
            "requested_by": {
                "full_name": req.requester.full_name if req.requester else ""
            },
            "reason": req.reason,
            "status": req.status,
            "created_at": req.created_at.isoformat(),
            "approved_at": req.approved_at.isoformat() if req.approved_at else None
        })
    
    return response


@router.get("/archived")
async def get_archived_projects(
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取已归档项目列表"""
    result = await db.execute(
        select(Project).options(
            selectinload(Project.sponsor),
            selectinload(Project.clinical_org)
        ).where(Project.is_archived == True)
        .order_by(Project.archived_at.desc())
    )
    projects = result.scalars().all()
    
    # 转换为响应格式
    response = []
    for project in projects:
        response.append({
            "id": project.id,
            "lab_project_code": project.lab_project_code,
            "sponsor_project_code": project.sponsor_project_code,
            "sponsor": {
                "name": project.sponsor.name if project.sponsor else ""
            },
            "clinical_org": {
                "name": project.clinical_org.name if project.clinical_org else ""
            },
            "status": "archived",
            "created_at": project.created_at.isoformat(),
            "archived_at": project.archived_at.isoformat() if project.archived_at else None
        })
    
    return response


@router.post("/request/{request_id}/approve")
async def approve_archive_request(
    request_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """批准归档申请"""
    # 检查用户权限
    if current_user.role not in [UserRole.LAB_DIRECTOR, UserRole.SYSTEM_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有研究室主任或系统管理员可以批准归档申请"
        )
    
    # 获取归档申请
    result = await db.execute(
        select(ProjectArchiveRequest).where(ProjectArchiveRequest.id == request_id)
    )
    archive_request = result.scalar_one_or_none()
    
    if not archive_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="归档申请不存在"
        )
    
    if archive_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该申请已处理"
        )
    
    # 更新申请状态
    archive_request.status = "approved"
    archive_request.approved_by = current_user.id
    archive_request.approved_at = datetime.utcnow()
    
    # 执行归档
    result = await db.execute(
        select(Project).where(Project.id == archive_request.project_id)
    )
    project = result.scalar_one_or_none()
    
    if project:
        project.is_archived = True
        project.status = "archived"
        project.archived_at = datetime.utcnow()
        project.is_active = False
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="project_archive",
        entity_id=archive_request.project_id,
        action="approve",
        reason="批准项目归档",
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "归档申请已批准，项目已锁定"}


@router.post("/request/{request_id}/reject")
async def reject_archive_request(
    request_id: int,
    rejection_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """拒绝归档申请"""
    # 检查用户权限
    if current_user.role not in [UserRole.LAB_DIRECTOR, UserRole.SYSTEM_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有研究室主任或系统管理员可以拒绝归档申请"
        )
    
    # 获取归档申请
    result = await db.execute(
        select(ProjectArchiveRequest).where(ProjectArchiveRequest.id == request_id)
    )
    archive_request = result.scalar_one_or_none()
    
    if not archive_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="归档申请不存在"
        )
    
    if archive_request.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该申请已处理"
        )
    
    # 更新申请状态
    archive_request.status = "rejected"
    archive_request.approved_by = current_user.id
    archive_request.approved_at = datetime.utcnow()
    archive_request.approval_comments = rejection_data.get("reason", "")
    
    # 恢复项目状态
    result = await db.execute(
        select(Project).where(Project.id == archive_request.project_id)
    )
    project = result.scalar_one_or_none()
    
    if project:
        project.status = "active"
    
    await db.commit()
    
    # 创建审计日志
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="project_archive",
        entity_id=archive_request.project_id,
        action="reject",
        reason=rejection_data.get("reason", "拒绝项目归档"),
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "归档申请已拒绝"}


@router.get("/projects/{project_id}/archive-summary")
async def get_project_archive_summary(
    project_id: int,
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: AsyncSession = Depends(get_db)
):
    """获取项目归档前的状态检查"""
    # 样本总数
    result = await db.execute(
        select(func.count()).select_from(Sample).where(Sample.project_id == project_id)
    )
    total_samples = result.scalar() or 0
    
    # 已销毁样本数
    result = await db.execute(
        select(func.count()).select_from(Sample).where(
            and_(
                Sample.project_id == project_id,
                Sample.status == SampleStatus.DESTROYED
            )
        )
    )
    destroyed_samples = result.scalar() or 0
    
    # 未归还样本数
    result = await db.execute(
        select(func.count()).select_from(SampleBorrowItem)
        .join(Sample)
        .where(
            and_(
                Sample.project_id == project_id,
                SampleBorrowItem.returned_at.is_(None)
            )
        )
    )
    unreturned_samples = result.scalar() or 0
    
    # 未完成的转移
    result = await db.execute(
        select(func.count()).select_from(SampleTransferRecord).where(
            and_(
                SampleTransferRecord.project_id == project_id,
                SampleTransferRecord.status.in_(["pending", "in_transit"])
            )
        )
    )
    pending_transfers = result.scalar() or 0
    
    # 未关闭的偏差
    result = await db.execute(
        select(func.count()).select_from(Deviation).where(
            and_(
                Deviation.project_id == project_id,
                Deviation.status != "closed"
            )
        )
    )
    active_deviations = result.scalar() or 0
    
    return {
        "total_samples": total_samples,
        "destroyed_samples": destroyed_samples,
        "unreturned_samples": unreturned_samples,
        "pending_transfers": pending_transfers,
        "active_deviations": active_deviations
    }
