from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Cookie, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_session
from .models import User

security = HTTPBearer(auto_error=False)
AUTH_COOKIE_NAME = "portfolio_admin_session"
PUBLIC_SESSION_COOKIE_NAME = "portfolio_public_session"
password_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_access_token(user: User) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {
        "sub": user.email,
        "uid": user.id,
        "role": user.role,
        "tv": user.token_version,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def public_session_id(
    response: Response,
    session_cookie: str | None = Cookie(default=None, alias=PUBLIC_SESSION_COOKIE_NAME),
) -> str:
    session_id = ""
    if session_cookie:
        try:
            payload = jwt.decode(session_cookie, settings.jwt_secret, algorithms=["HS256"])
            if payload.get("purpose") == "public_session":
                session_id = str(payload.get("sid") or "")
        except JWTError:
            session_id = ""
    if not session_id:
        session_id = uuid4().hex
        token = jwt.encode(
            {
                "purpose": "public_session",
                "sid": session_id,
                "exp": datetime.now(timezone.utc) + timedelta(days=30),
            },
            settings.jwt_secret,
            algorithm="HS256",
        )
        response.set_cookie(
            PUBLIC_SESSION_COOKIE_NAME,
            token,
            httponly=True,
            secure=settings.auth_cookie_secure,
            samesite="lax",
            max_age=30 * 24 * 60 * 60,
            path="/",
        )
    return session_id


def resolved_public_session(value: object, legacy: str = "default") -> str:
    return value if isinstance(value, str) and value else legacy


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    session_cookie: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
    session: Session = Depends(get_session),
) -> User:
    token = credentials.credentials if credentials is not None else session_cookie
    if not token:
        raise HTTPException(status_code=401, detail="Missing authentication session")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc

    subject = str(payload.get("sub") or "")
    user_id = payload.get("uid")
    if not subject or not user_id:
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    user = session.scalar(select(User).where(User.id == int(user_id), User.email == subject))
    if not user or not user.is_active or int(payload.get("tv") or 0) != user.token_version:
        raise HTTPException(status_code=401, detail="Account is inactive or token has expired")
    return user


def require_admin(user: User = Depends(current_user)) -> str:
    """Legacy dependency name used by CMS routes; admin and editor are staff."""
    if user.role not in {"admin", "editor"}:
        raise HTTPException(status_code=403, detail="Editor permission required")
    return user.email


def require_super_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator permission required")
    return user


def ensure_bootstrap_admin(session: Session) -> User | None:
    email = settings.admin_email.strip().lower()
    if not email or not settings.admin_password:
        return None
    user = session.scalar(select(User).where(User.email == email))
    if user:
        return user
    user = User(
        email=email,
        password_hash=hash_password(settings.admin_password),
        role="admin",
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
