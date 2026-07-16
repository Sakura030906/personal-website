from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings

security = HTTPBearer(auto_error=False)


def create_access_token(subject: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
    payload = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid bearer token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid bearer token")
    return subject
