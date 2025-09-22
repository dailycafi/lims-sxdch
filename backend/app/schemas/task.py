from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field


TaskCategory = Literal['borrow', 'return', 'transfer', 'destroy']


class TaskItem(BaseModel):
    """Aggregated task item across sample workflows."""

    id: int
    category: TaskCategory
    project_id: int
    project_code: Optional[str] = None
    sponsor_project_code: Optional[str] = None
    title: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    due_at: Optional[datetime] = None
    requester: Optional[str] = None
    assignee: Optional[str] = None
    sample_count: Optional[int] = None
    action_required: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TaskOverviewResponse(BaseModel):
    """Grouped task overview used by the task center UI."""

    borrow: list[TaskItem] = Field(default_factory=list)
    return_: list[TaskItem] = Field(default_factory=list, alias='return')
    transfer: list[TaskItem] = Field(default_factory=list)
    destroy: list[TaskItem] = Field(default_factory=list)

    class Config:
        populate_by_name = True
