from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_rate_limit
from app.models.user import User
from app.schemas.user import UserOut


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserOut], dependencies=[Depends(require_rate_limit)])
def search_users(
    q: str = Query(min_length=2, max_length=120),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    pattern = f"%{q}%"
    return (
        db.query(User)
        .filter(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
        .limit(20)
        .all()
    )
