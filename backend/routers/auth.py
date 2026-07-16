"""Authentication endpoints: login, logout, current user."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.services import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class SessionUser(BaseModel):
    email: str
    name: str
    role: str
    merchant: str
    avatar: str


class LoginResponse(BaseModel):
    token: str
    user: SessionUser


@router.get("/demo-credentials")
def demo_credentials() -> dict:
    """Expose the demo login so reviewers can sign in in one click."""
    return {"email": auth.DEMO_EMAIL, "password": auth.DEMO_PASSWORD}


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest) -> LoginResponse:
    user = auth.authenticate(req.email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.create_session(req.email)
    session = auth.get_session(token)
    return LoginResponse(token=token, user=SessionUser(**_public(session)))


@router.get("/me", response_model=SessionUser)
def me(authorization: str | None = Header(default=None)) -> SessionUser:
    session = auth.get_session(auth.token_from_header(authorization))
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return SessionUser(**_public(session))


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)) -> dict:
    auth.destroy_session(auth.token_from_header(authorization))
    return {"ok": True}


def _public(session: dict) -> dict:
    return {
        "email": session["email"],
        "name": session["name"],
        "role": session["role"],
        "merchant": session["merchant"],
        "avatar": session["avatar"],
    }
