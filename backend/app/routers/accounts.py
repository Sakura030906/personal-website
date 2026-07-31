from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..activity import record_activity
from ..database import get_session
from ..models import User
from ..schemas import UserCreate, UserOut, UserPasswordUpdate, UserUpdate
from ..security import hash_password, require_super_admin


router = APIRouter()


@router.get("/users", response_model=list[UserOut])
def list_users(
    _: User = Depends(require_super_admin),
    session: Session = Depends(get_session),
) -> list[User]:
    return list(session.scalars(select(User).order_by(User.created_at.asc(), User.id.asc())))


@router.post("/users", response_model=UserOut)
def create_user(
    payload: UserCreate,
    admin: User = Depends(require_super_admin),
    session: Session = Depends(get_session),
) -> User:
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if session.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Account already exists")
    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    session.add(user)
    session.flush()
    record_activity(
        session,
        action="account_created",
        entity_type="user",
        entity_id=user.id,
        entity_title=user.email,
        actor_email=admin.email,
    )
    session.commit()
    session.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    admin: User = Depends(require_super_admin),
    session: Session = Depends(get_session),
) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.id == admin.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    if user.id == admin.id and payload.role and payload.role != "admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own administrator role")
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None and user.is_active != payload.is_active:
        user.is_active = payload.is_active
        user.token_version += 1
    record_activity(
        session,
        action="account_updated",
        entity_type="user",
        entity_id=user.id,
        entity_title=user.email,
        actor_email=admin.email,
    )
    session.commit()
    session.refresh(user)
    return user


@router.post("/users/{user_id}/password")
def reset_user_password(
    user_id: int,
    payload: UserPasswordUpdate,
    admin: User = Depends(require_super_admin),
    session: Session = Depends(get_session),
) -> dict[str, str]:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    user.password_hash = hash_password(payload.password)
    user.token_version += 1
    record_activity(
        session,
        action="account_password_reset",
        entity_type="user",
        entity_id=user.id,
        entity_title=user.email,
        actor_email=admin.email,
    )
    session.commit()
    return {"status": "password_reset"}
