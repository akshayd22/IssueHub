from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_rate_limit
from app.core.security import create_access_token
from app.models.user import User
from app.schemas.auth import TokenOut
from app.schemas.user import UserCreate, UserLogin, UserOut
from app.services.audit import write_audit_log
from app.services.auth import authenticate_user, create_user, get_user_by_email


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut, dependencies=[Depends(require_rate_limit)])
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> UserOut:
    existing = get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )
    user = create_user(db, payload.name, payload.email, payload.password)
    write_audit_log(db, user.id, "signup", "user", user.id, {"email": user.email})
    return user


@router.post("/login", response_model=TokenOut, dependencies=[Depends(require_rate_limit)])
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenOut:
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    token = create_access_token(str(user.id))
    write_audit_log(db, user.id, "login", "user", user.id, None)
    return TokenOut(access_token=token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    write_audit_log(db, user.id, "logout", "user", user.id, None)
    return None


