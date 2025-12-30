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
from app.api.v1.deps import assert_project_access, get_accessible_project_ids, is_project_admin

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

    await assert_project_access(db, current_user, project.id)
    
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
        status="pending_manager",
        current_step=2
    )
    
    db.add(archive_request)
    
    # 更新项目状态
    project.status = "pending_archive"
    
    await db.commit()
    await db.refresh(archive_request)
    
    # 获取完整的归档申请信息用于返回
    result = await db.execute(
        select(ProjectArchiveRequest).options(
            selectinload(ProjectArchiveRequest.project),
            selectinload(ProjectArchiveRequest.requester)
        ).where(ProjectArchiveRequest.id == archive_request.id)
    )
    req = result.scalar_one()
    
    # 创建审计日志
    # ... (existing audit log code)
    
    return {
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
        "created_at": req.created_at.isoformat()
    }


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

    if current_user and not is_project_admin(current_user):
        accessible_ids = await get_accessible_project_ids(db, current_user)
        if not accessible_ids:
            return []
        query = query.where(ProjectArchiveRequest.project_id.in_(accessible_ids))
    
    if status:
        if status == "pending":
            query = query.where(ProjectArchiveRequest.status.like("pending_%"))
        else:
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
    stmt = select(Project).options(
        selectinload(Project.sponsor),
        selectinload(Project.clinical_org)
    ).where(Project.is_archived == True)

    if current_user and not is_project_admin(current_user):
        accessible_ids = await get_accessible_project_ids(db, current_user)
        if not accessible_ids:
            return []
        stmt = stmt.where(Project.id.in_(accessible_ids))

    result = await db.execute(stmt.order_by(Project.archived_at.desc()))
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


class ArchiveApprovalStep(BaseModel):
    action: str  # approve, reject
    comments: str


@router.post("/request/{request_id}/approve")
async def approve_archive_request(
    request_id: int,
    approval_data: ArchiveApprovalStep,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """处理归档申请审批（支持4步流程）"""
    
    # 获取归档申请
    result = await db.execute(
        select(ProjectArchiveRequest).options(
            selectinload(ProjectArchiveRequest.project)
        ).where(ProjectArchiveRequest.id == request_id)
    )
    archive_request = result.scalar_one_or_none()
    
    if not archive_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="归档申请不存在"
        )
    
    # 根据当前步骤检查权限并处理
    user_role_codes = [role.code for role in current_user.roles]
    if current_user.role:
        user_role_codes.append(current_user.role.value)

    if archive_request.current_step == 2:
        # 步骤2: 分析测试主管审批
        is_allowed = (
            current_user.is_superuser or 
            any(role_code in ["test_manager", "system_admin"] for role_code in user_role_codes)
        )
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有分析测试主管可以在此步骤审批"
            )
        
        archive_request.test_manager_id = current_user.id
        archive_request.test_manager_approved_at = datetime.utcnow()
        archive_request.test_manager_comments = approval_data.comments
        archive_request.test_manager_action = approval_data.action
        
        if approval_data.action == "approve":
            archive_request.status = "pending_qa"
            archive_request.current_step = 3
        else:
            archive_request.status = "rejected"
            # 恢复项目状态
            archive_request.project.status = "active"
    
    elif archive_request.current_step == 3:
        # 步骤3: QA审批
        is_allowed = (
            current_user.is_superuser or 
            any(role_code in ["qa", "system_admin"] for role_code in user_role_codes)
        )
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有QA可以在此步骤审批"
            )
        
        archive_request.qa_id = current_user.id
        archive_request.qa_approved_at = datetime.utcnow()
        archive_request.qa_comments = approval_data.comments
        archive_request.qa_action = approval_data.action
        
        if approval_data.action == "approve":
            archive_request.status = "pending_admin"
            archive_request.current_step = 4
        else:
            archive_request.status = "rejected"
            # 恢复项目状态
            archive_request.project.status = "active"
    
    elif archive_request.current_step == 4:
        # 步骤4: 计算机管理员执行归档
        is_allowed = (
            current_user.is_superuser or 
            any(role_code == "system_admin" for role_code in user_role_codes)
        )
        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有系统管理员可以执行归档"
            )
        
        archive_request.admin_id = current_user.id
        archive_request.admin_executed_at = datetime.utcnow()
        archive_request.admin_comments = approval_data.comments
        archive_request.status = "archived"
        
        # 执行归档
        project = archive_request.project
        project.is_archived = True
        project.status = "archived"
        project.archived_at = datetime.utcnow()
        project.is_active = False
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的审批步骤"
        )
    
    await db.commit()
    
    # 创建审计日志
    action_detail = f"step_{archive_request.current_step}_{approval_data.action}"
    audit_log = AuditLog(
        user_id=current_user.id,
        entity_type="project_archive",
        entity_id=archive_request.project_id,
        action=action_detail,
        reason=approval_data.comments,
        details={
            "step": archive_request.current_step,
            "action": approval_data.action,
            "project_code": archive_request.project.lab_project_code
        },
        timestamp=datetime.utcnow()
    )
    db.add(audit_log)
    await db.commit()
    
    step_names = {
        2: "分析测试主管审批",
        3: "QA审批",
        4: "系统管理员执行归档"
    }
    
    return {
        "message": f"{step_names.get(archive_request.current_step, '审批')}{'完成' if approval_data.action == 'approve' else '已拒绝'}"
    }


@router.post("/request/{request_id}/reject")
async def reject_archive_request(
    request_id: int,
    rejection_data: dict,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    """拒绝归档申请"""
    # 检查用户权限
    user_role_codes = [role.code for role in current_user.roles]
    if current_user.role:
        user_role_codes.append(current_user.role.value)
        
    is_allowed = (
        current_user.is_superuser or 
        any(role_code in ["lab_director", "system_admin"] for role_code in user_role_codes)
    )
    
    if not is_allowed:
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
