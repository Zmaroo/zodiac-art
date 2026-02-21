"""Authentication routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from zodiac_art.api.auth import (
    AuthUser,
    create_access_token,
    create_user,
    get_user_by_email,
    hash_password,
    verify_password,
)
from zodiac_art.api.deps import (
    get_db_pool,
    get_jwt_expires_seconds,
    get_jwt_secret,
    is_admin,
    require_user,
)
from zodiac_art.api.models import AuthRequest, AuthResponse, AuthUserInfo

router = APIRouter()


@router.post("/api/auth/register", response_model=AuthResponse)
async def register(payload: AuthRequest, request: Request) -> AuthResponse:
    db_pool = get_db_pool(request)
    jwt_secret = get_jwt_secret(request)
    if not db_pool or not jwt_secret:
        raise HTTPException(status_code=500, detail="Database not configured")
    email = payload.email.strip().lower()
    password = payload.password.strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long (max 72 bytes).",
        )
    existing = await get_user_by_email(db_pool, email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    password_hash = hash_password(password)
    user = await create_user(db_pool, email, password_hash)
    token = create_access_token(user, jwt_secret, get_jwt_expires_seconds(request))
    return AuthResponse(
        token=token,
        user=AuthUserInfo(id=user.user_id, email=user.email, is_admin=is_admin(request, user)),
    )


@router.post("/api/auth/login", response_model=AuthResponse)
async def login(payload: AuthRequest, request: Request) -> AuthResponse:
    db_pool = get_db_pool(request)
    jwt_secret = get_jwt_secret(request)
    if not db_pool or not jwt_secret:
        raise HTTPException(status_code=500, detail="Database not configured")
    email = payload.email.strip().lower()
    password = payload.password.strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long (max 72 bytes).",
        )
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email, password_hash FROM users WHERE email = $1",
            email,
        )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = AuthUser(user_id=str(row["id"]), email=row["email"])
    token = create_access_token(user, jwt_secret, get_jwt_expires_seconds(request))
    return AuthResponse(
        token=token,
        user=AuthUserInfo(id=user.user_id, email=user.email, is_admin=is_admin(request, user)),
    )


@router.get("/api/auth/me")
async def me(request: Request, user: AuthUser = Depends(require_user)) -> dict:
    return {"id": user.user_id, "email": user.email, "is_admin": is_admin(request, user)}
