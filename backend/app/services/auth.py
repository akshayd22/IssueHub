from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.dao import users as user_dao
from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    return user_dao.get_user_by_email(db, email)


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return user_dao.get_user_by_id(db, user_id)


def create_user(db: Session, name: str, email: str, password: str) -> User:
    password_hash = hash_password(password)
    return user_dao.create_user(db, name=name, email=email, password_hash=password_hash)


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
