"""Authentication helpers and dependencies."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable
from uuid import UUID, uuid4

import asyncpg
import jwt
from fastapi import HTTPException, Request
from passlib.context import CryptContext

_PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    email: str


def hash_password(password: str) -> str:
    return _PWD_CONTEXT.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _PWD_CONTEXT.verify(password, password_hash)


def create_access_token(user: AuthUser, secret: str, expires_seconds: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_token(token: str, secret: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc


async def get_user_by_email(pool: asyncpg.Pool, email: str) -> AuthUser | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email FROM users WHERE email = $1",
            email,
        )
    if not row:
        return None
    return AuthUser(user_id=str(row["id"]), email=row["email"])


async def get_user_by_id(pool: asyncpg.Pool, user_id: str) -> AuthUser | None:
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, email FROM users WHERE id = $1",
            user_uuid,
        )
    if not row:
        return None
    return AuthUser(user_id=str(row["id"]), email=row["email"])


async def create_user(pool: asyncpg.Pool, email: str, password_hash: str) -> AuthUser:
    user_id = uuid4()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO users (id, email, password_hash)
            VALUES ($1, $2, $3)
            """,
            user_id,
            email,
            password_hash,
        )
    return AuthUser(user_id=str(user_id), email=email)


async def ensure_dev_user(pool: asyncpg.Pool) -> AuthUser:
    email = "dev@local"
    existing = await get_user_by_email(pool, email)
    if existing:
        return existing
    password_hash = hash_password(str(uuid4()))
    return await create_user(pool, email, password_hash)


def get_current_user_dependency(
    pool: asyncpg.Pool,
    secret: str,
    dev_mode: bool,
) -> Callable[[Request], Awaitable[AuthUser]]:
    async def _get_current_user(request: Request) -> AuthUser:
        auth_header = request.headers.get("authorization")
        if not auth_header:
            if dev_mode:
                return await ensure_dev_user(pool)
            raise HTTPException(status_code=401, detail="Missing Authorization header")
        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid Authorization header")
        token = parts[1].strip()
        payload = decode_token(token, secret)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await get_user_by_id(pool, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user

    return _get_current_user
