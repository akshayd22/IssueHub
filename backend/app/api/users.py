from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_rate_limit
from app.dao import users as user_dao
from app.models.user import User
from app.schemas.user import UserOut


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserOut], dependencies=[Depends(require_rate_limit)])
def search_users(
    q: str = Query(min_length=2, max_length=120),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    return user_dao.search_users(db, q)
