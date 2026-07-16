from fastapi import APIRouter, HTTPException

from ..config import settings
from ..schemas import LoginRequest, TokenResponse
from ..security import create_access_token

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest) -> TokenResponse:
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if not settings.admin_email or not settings.admin_password:
        raise HTTPException(status_code=503, detail="Admin account is not configured")
    if payload.email != settings.admin_email or payload.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return TokenResponse(access_token=create_access_token(payload.email))
