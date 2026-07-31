from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_session
from ..models import User
from ..schemas import LoginRequest, PasswordChange, TokenResponse, UserOut
from ..config import settings
from ..security import AUTH_COOKIE_NAME, create_access_token, current_user, hash_password, verify_password

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, session: Session = Depends(get_session)) -> TokenResponse:
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    user = session.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user.last_login_at = datetime.now(timezone.utc)
    session.commit()
    token = create_access_token(user)
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite="lax",
        max_age=8 * 60 * 60,
        path="/",
    )
    return TokenResponse(access_token=token)


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    user: User = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1
    session.commit()
    return {"status": "password_changed"}
