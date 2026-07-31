from fastapi import HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base
from app.models import User
from app.routers import accounts, auth
from app.schemas import LoginRequest, PasswordChange, UserCreate, UserPasswordUpdate, UserUpdate
from app.security import create_access_token, current_user, hash_password, require_admin, require_super_admin


def make_session():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return Session(engine)


def admin_user(session: Session) -> User:
    user = User(
        email="owner@example.com",
        password_hash=hash_password("owner-password-123"),
        role="admin",
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def test_login_uses_database_account_and_returns_versioned_jwt():
    with make_session() as session:
        user = admin_user(session)
        response = Response()
        token = auth.login(LoginRequest(email=user.email, password="owner-password-123"), response=response, session=session)
        assert "portfolio_admin_session=" in response.headers["set-cookie"]
        payload = jwt.decode(token.access_token, settings.jwt_secret, algorithms=["HS256"])
        assert payload["uid"] == user.id
        assert payload["role"] == "admin"
        assert payload["tv"] == 1
        assert session.get(User, user.id).last_login_at is not None


def test_admin_can_create_and_disable_editor_account():
    with make_session() as session:
        owner = admin_user(session)
        editor = accounts.create_user(
            UserCreate(email="editor@example.com", password="editor-password-123", role="editor"),
            admin=owner,
            session=session,
        )
        assert editor.role == "editor"
        assert require_admin(editor) == editor.email
        updated = accounts.update_user(
            editor.id,
            UserUpdate(is_active=False),
            admin=owner,
            session=session,
        )
        assert updated.is_active is False
        assert updated.token_version == 2


def test_viewer_cannot_edit_or_manage_accounts():
    with make_session() as session:
        viewer = User(email="viewer@example.com", password_hash=hash_password("viewer-password-123"), role="viewer")
        session.add(viewer)
        session.commit()
        for dependency in (require_admin, require_super_admin):
            try:
                dependency(viewer)
            except HTTPException as error:
                assert error.status_code == 403
            else:
                raise AssertionError("viewer unexpectedly received write permission")


def test_password_change_and_admin_reset_invalidate_existing_tokens():
    with make_session() as session:
        owner = admin_user(session)
        old_token = create_access_token(owner)
        auth.change_password(
            PasswordChange(current_password="owner-password-123", new_password="new-owner-password-456"),
            user=owner,
            session=session,
        )
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=old_token)
        try:
            current_user(credentials=credentials, session=session)
        except HTTPException as error:
            assert error.status_code == 401
        else:
            raise AssertionError("old token remained valid after password change")

        accounts.reset_user_password(
            owner.id,
            UserPasswordUpdate(password="reset-owner-password-789"),
            admin=owner,
            session=session,
        )
        assert owner.token_version == 3
