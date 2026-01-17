from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_rate_limit
from app.core.guardrails import validate_text
from app.models.project_member import ProjectRole
from app.models.user import User
from app.schemas.issue import IssueOut, IssueUpdate
from app.services.audit import write_audit_log
from app.services.issues import delete_issue, get_issue, update_issue
from app.services.projects import get_membership


router = APIRouter(prefix="/issues", tags=["issues"])


def _require_issue_access(db: Session, issue_id: int, user: User) -> tuple:
    issue = get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    membership = get_membership(db, issue.project_id, user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project membership required",
        )
    return issue, membership.role


@router.get("/{issue_id}", response_model=IssueOut)
def get_issue_by_id(
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IssueOut:
    issue, _ = _require_issue_access(db, issue_id, user)
    return issue


@router.patch("/{issue_id}", response_model=IssueOut, dependencies=[Depends(require_rate_limit)])
def update_issue_by_id(
    issue_id: int,
    payload: IssueUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> IssueOut:
    issue, role = _require_issue_access(db, issue_id, user)
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
def delete_issue_by_id(
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    issue, role = _require_issue_access(db, issue_id, user)
    if role != ProjectRole.maintainer and issue.reporter_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this issue",
        )
    delete_issue(db, issue)
    write_audit_log(db, user.id, "issue_deleted", "issue", issue.id, None)
    return None
