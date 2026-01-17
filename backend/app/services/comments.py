from sqlalchemy.orm import Session

from app.dao import comments as comment_dao
from app.models.comment import Comment


def list_comments(db: Session, issue_id: int) -> list[Comment]:
    return comment_dao.list_comments(db, issue_id)


def create_comment(db: Session, issue_id: int, author_id: int, body: str) -> Comment:
    return comment_dao.create_comment(db, issue_id, author_id, body)
