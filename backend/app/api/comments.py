from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_rate_limit
from app.core.guardrails import validate_text
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut
from app.services.audit import write_audit_log
from app.services.comments import create_comment, list_comments
from app.services.issues import get_issue
from app.services.projects import get_membership


router = APIRouter(prefix="/issues/{issue_id}/comments", tags=["comments"])


@router.get("", response_model=list[CommentOut])
def list_issue_comments(
    issue_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommentOut]:
    issue = get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    membership = get_membership(db, issue.project_id, user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project membership required",
        )
    return list_comments(db, issue_id)


@router.post(
    "",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rate_limit)],
)
def create_issue_comment(
    issue_id: int,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentOut:
    issue = get_issue(db, issue_id)
    if not issue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    membership = get_membership(db, issue.project_id, user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project membership required",
        )
    try:
        validate_text("comment", payload.body)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    comment = create_comment(db, issue_id, user.id, payload.body)
    write_audit_log(db, user.id, "comment_added", "issue", issue_id, None)
    return comment
