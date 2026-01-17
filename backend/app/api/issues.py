from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db,
    require_maintainer,
    require_rate_limit,
)
from app.core.guardrails import validate_text
from app.models.issue import IssuePriority, IssueStatus
from app.models.project_member import ProjectRole
from app.models.user import User
from app.schemas.issue import IssueCreate, IssueListOut, IssueOut, IssueUpdate
from app.services.audit import write_audit_log
from app.services.issues import (
    create_issue,
    delete_issue,
    get_issue,
    list_issues,
    update_issue,
)
from app.services.projects import get_membership


router = APIRouter(prefix="/projects/{project_id}/issues", tags=["issues"])


def require_project_member(
    db: Session, project_id: int, user_id: int
) -> ProjectRole:
    membership = get_membership(db, project_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project membership required",
        )
    return membership.role


@router.get("", response_model=IssueListOut)
def list_project_issues(
    project_id: int,
    q: str | None = None,
    status: IssueStatus | None = None,
    priority: IssuePriority | None = None,
    assignee: int | None = Query(default=None, alias="assignee"),
    sort: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IssueListOut:
    require_project_member(db, project_id, user.id)
    items, total = list_issues(
        db, project_id, q, status, priority, assignee, sort, limit, offset
    )
    return IssueListOut(items=items, total=total, limit=limit, offset=offset)


@router.post(
    "",
    response_model=IssueOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rate_limit)],
)
def create_project_issue(
    project_id: int,
    payload: IssueCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IssueOut:
    require_project_member(db, project_id, user.id)
    try:
        validate_text("title", payload.title)
        validate_text("description", payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    issue = create_issue(
        db,
        project_id,
        payload.title,
        payload.description,
        payload.priority,
        user.id,
        payload.assignee_id,
    )
    write_audit_log(db, user.id, "issue_created", "issue", issue.id, None)
    return issue


@router.get("/{issue_id}", response_model=IssueOut)
def get_issue_detail(
    project_id: int,
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IssueOut:
    require_project_member(db, project_id, user.id)
    issue = get_issue(db, issue_id)
    if not issue or issue.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return issue


@router.patch("/{issue_id}", response_model=IssueOut, dependencies=[Depends(require_rate_limit)])
def update_issue_detail(
    project_id: int,
    issue_id: int,
    payload: IssueUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IssueOut:
    role = require_project_member(db, project_id, user.id)
    issue = get_issue(db, issue_id)
    if not issue or issue.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    is_maintainer = role == ProjectRole.maintainer
    if not is_maintainer and issue.reporter_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update this issue",
        )

    updates = payload.model_dump(exclude_unset=True)
    try:
        if "title" in updates:
            validate_text("title", updates["title"])
        if "description" in updates:
            validate_text("description", updates["description"])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if not is_maintainer:
        updates.pop("status", None)
        updates.pop("assignee_id", None)
    issue = update_issue(db, issue, updates)
    write_audit_log(db, user.id, "issue_updated", "issue", issue.id, updates)
    return issue


@router.delete(
    "/{issue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_rate_limit)],
)
def delete_issue_detail(
    project_id: int,
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    role = require_project_member(db, project_id, user.id)
    issue = get_issue(db, issue_id)
    if not issue or issue.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if role != ProjectRole.maintainer and issue.reporter_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this issue",
        )
    delete_issue(db, issue)
    write_audit_log(db, user.id, "issue_deleted", "issue", issue.id, None)
    return None


@router.patch(
    "/{issue_id}/status",
    response_model=IssueOut,
    dependencies=[Depends(require_rate_limit)],
)
def update_status(
    project_id: int,
    issue_id: int,
    status_value: IssueStatus,
    user: User = Depends(require_maintainer),
    db: Session = Depends(get_db),
) -> IssueOut:
    issue = get_issue(db, issue_id)
    if not issue or issue.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    issue = update_issue(db, issue, {"status": status_value})
    write_audit_log(db, user.id, "issue_status_changed", "issue", issue.id, None)
    return issue
