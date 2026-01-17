from datetime import datetime

from pydantic import BaseModel, Field

from app.models.issue import IssuePriority, IssueStatus


class IssueCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    priority: IssuePriority = IssuePriority.medium
    assignee_id: int | None = None


class IssueUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: IssueStatus | None = None
    priority: IssuePriority | None = None
    assignee_id: int | None = None


class IssueOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: IssueStatus
    priority: IssuePriority
    reporter_id: int
    assignee_id: int | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IssueListOut(BaseModel):
    items: list[IssueOut]
    total: int
    limit: int
    offset: int
