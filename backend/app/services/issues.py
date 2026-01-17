from sqlalchemy.orm import Session

from app.dao import issues as issue_dao
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
    return issue_dao.create_issue(
        db,
        project_id,
        title,
        description,
        priority,
        reporter_id,
        assignee_id,
    )


def get_issue(db: Session, issue_id: int) -> Issue | None:
    return issue_dao.get_issue(db, issue_id)


def delete_issue(db: Session, issue: Issue) -> None:
    issue_dao.delete_issue(db, issue)


def update_issue(db: Session, issue: Issue, data: dict) -> Issue:
    return issue_dao.update_issue(db, issue, data)


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
    return issue_dao.list_issues(
        db,
        project_id,
        q,
        status,
        priority,
        assignee_id,
        sort,
        limit,
        offset,
    )
