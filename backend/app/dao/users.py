from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.user import User


def create_user(db: Session, name: str, email: str, password_hash: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def search_users(db: Session, query: str, limit: int = 20) -> list[User]:
    pattern = f"%{query}%"
    return (
        db.query(User)
        .filter(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
        .limit(limit)
        .all()
    )
