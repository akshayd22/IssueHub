from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.models.issue import Issue, IssuePriority, IssueStatus


def create_issue(
    db: Session,
    project_id: int,
    title: str,
    description: str | None,
    priority: IssuePriority,
    reporter_id: int,
    assignee_id: int | None,
) -> Issue:
    issue = Issue(
        project_id=project_id,
        title=title,
        description=description,
        priority=priority,
        reporter_id=reporter_id,
        assignee_id=assignee_id,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


def get_issue(db: Session, issue_id: int) -> Issue | None:
    return db.query(Issue).filter(Issue.id == issue_id).first()


def delete_issue(db: Session, issue: Issue) -> None:
    db.delete(issue)
    db.commit()


def update_issue(db: Session, issue: Issue, data: dict) -> Issue:
    for key, value in data.items():
        setattr(issue, key, value)
    db.commit()
    db.refresh(issue)
    return issue


def list_issues(
    db: Session,
    project_id: int,
    q: str | None,
    status: IssueStatus | None,
    priority: IssuePriority | None,
    assignee_id: int | None,
    sort: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Issue], int]:
    query = db.query(Issue).filter(Issue.project_id == project_id)

    if q:
        query = query.filter(Issue.title.ilike(f"%{q}%"))
    if status:
        query = query.filter(Issue.status == status)
    if priority:
        query = query.filter(Issue.priority == priority)
    if assignee_id is not None:
        query = query.filter(Issue.assignee_id == assignee_id)

    if sort == "created_at":
        query = query.order_by(desc(Issue.created_at))
    elif sort == "priority":
        query = query.order_by(desc(Issue.priority))
    elif sort == "status":
        query = query.order_by(asc(Issue.status))

    total = query.order_by(None).count()
    items = query.offset(offset).limit(limit).all()
    return items, total
