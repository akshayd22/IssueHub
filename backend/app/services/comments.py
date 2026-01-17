from sqlalchemy.orm import Session

from app.models.comment import Comment


def list_comments(db: Session, issue_id: int) -> list[Comment]:
    return (
        db.query(Comment).filter(Comment.issue_id == issue_id).order_by(Comment.id).all()
    )


def create_comment(db: Session, issue_id: int, author_id: int, body: str) -> Comment:
    comment = Comment(issue_id=issue_id, author_id=author_id, body=body)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment
