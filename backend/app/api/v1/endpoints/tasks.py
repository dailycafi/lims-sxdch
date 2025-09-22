from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.endpoints.auth import get_current_user
from app.core.database import get_db
from app.models.sample import (
    SampleBorrowItem,
    SampleBorrowRequest,
    SampleDestroyRequest,
    SampleTransferRecord,
)
from app.models.user import User
from app.schemas.task import TaskItem, TaskOverviewResponse

router = APIRouter()


@router.get("/", response_model=TaskOverviewResponse)
async def get_task_overview(
    project_id: Optional[int] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskOverviewResponse:
    """Return a grouped overview of sample related tasks across projects."""

    overview = TaskOverviewResponse()

    borrow_query = (
        select(SampleBorrowRequest)
        .options(
            selectinload(SampleBorrowRequest.project),
            selectinload(SampleBorrowRequest.requester),
            selectinload(SampleBorrowRequest.approver),
            selectinload(SampleBorrowRequest.samples).selectinload(SampleBorrowItem.sample),
        )
        .order_by(SampleBorrowRequest.created_at.desc())
        .limit(limit)
    )
    if project_id:
        borrow_query = borrow_query.where(SampleBorrowRequest.project_id == project_id)

    result = await db.execute(borrow_query)
    borrow_requests = result.scalars().all()

    for request in borrow_requests:
        overview.borrow.append(
            TaskItem(
                id=request.id,
                category='borrow',
                project_id=request.project_id,
                project_code=request.project.lab_project_code if request.project else None,
                sponsor_project_code=request.project.sponsor_project_code if request.project else None,
                title=f"领用申请 {request.request_code}",
                status=request.status,
                created_at=request.created_at or datetime.utcnow(),
                updated_at=request.updated_at,
                due_at=getattr(request, 'target_date', None),
                requester=request.requester.full_name if request.requester else None,
                assignee=request.approver.full_name if request.approver else None,
                sample_count=len(request.samples),
                action_required=request.status in {"pending", "approved"},
                metadata={
                    "request_code": request.request_code,
                    "purpose": request.purpose,
                    "target_location": request.target_location,
                },
            )
        )

        # Outstanding returns are part of borrow lifecycle
        if request.status in {"borrowed", "partial_returned"}:
            outstanding = sum(1 for item in request.samples if not item.returned_at)
            if outstanding:
                overview.return_.append(
                    TaskItem(
                        id=request.id,
                        category='return',
                        project_id=request.project_id,
                        project_code=request.project.lab_project_code if request.project else None,
                        sponsor_project_code=request.project.sponsor_project_code if request.project else None,
                        title=f"样本归还 {request.request_code}",
                        status=request.status,
                        created_at=request.created_at or datetime.utcnow(),
                        updated_at=request.updated_at,
                        requester=request.requester.full_name if request.requester else None,
                        sample_count=outstanding,
                        action_required=True,
                        metadata={
                            "request_code": request.request_code,
                            "pending_samples": outstanding,
                        },
                    )
                )

    transfer_query = (
        select(SampleTransferRecord)
        .options(
            selectinload(SampleTransferRecord.project),
            selectinload(SampleTransferRecord.requester),
            selectinload(SampleTransferRecord.samples),
            selectinload(SampleTransferRecord.target_org),
        )
        .order_by(SampleTransferRecord.created_at.desc())
        .limit(limit)
    )
    if project_id:
        transfer_query = transfer_query.where(SampleTransferRecord.project_id == project_id)

    result = await db.execute(transfer_query)
    transfer_records = result.scalars().all()

    for record in transfer_records:
        overview.transfer.append(
            TaskItem(
                id=record.id,
                category='transfer',
                project_id=record.project_id,
                project_code=record.project.lab_project_code if record.project else None,
                sponsor_project_code=record.project.sponsor_project_code if record.project else None,
                title=f"样本转移 {record.transfer_code}",
                status=record.status,
                created_at=record.created_at or datetime.utcnow(),
                updated_at=record.completed_at,
                requester=record.requester.full_name if record.requester else None,
                assignee=record.target_org.name if record.target_org else None,
                sample_count=len(record.samples),
                action_required=record.status in {"pending", "approved"},
                metadata={
                    "transfer_code": record.transfer_code,
                    "transfer_type": record.transfer_type,
                    "from_location": record.from_location,
                    "to_location": record.to_location,
                },
            )
        )

    destroy_query = (
        select(SampleDestroyRequest)
        .options(
            selectinload(SampleDestroyRequest.project),
            selectinload(SampleDestroyRequest.requester),
            selectinload(SampleDestroyRequest.samples),
        )
        .order_by(SampleDestroyRequest.created_at.desc())
        .limit(limit)
    )
    if project_id:
        destroy_query = destroy_query.where(SampleDestroyRequest.project_id == project_id)

    result = await db.execute(destroy_query)
    destroy_requests = result.scalars().all()

    for request in destroy_requests:
        overview.destroy.append(
            TaskItem(
                id=request.id,
                category='destroy',
                project_id=request.project_id,
                project_code=request.project.lab_project_code if request.project else None,
                sponsor_project_code=request.project.sponsor_project_code if request.project else None,
                title=f"样本销毁 {request.request_code}",
                status=request.status,
                created_at=request.created_at or datetime.utcnow(),
                updated_at=request.updated_at,
                requester=request.requester.full_name if request.requester else None,
                sample_count=len(request.samples),
                action_required=request.status in {"pending", "test_manager_approved", "director_approved"},
                metadata={
                    "request_code": request.request_code,
                    "reason": request.reason,
                },
            )
        )

    return overview
