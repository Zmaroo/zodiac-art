"""FastAPI dependencies and shared accessors."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Request

from zodiac_art.api.auth import AuthUser


def get_storage(request: Request) -> Any:
    return request.app.state.storage


def get_frame_store(request: Request) -> Any:
    return request.app.state.frame_store


def get_db_pool(request: Request) -> Any:
    return request.app.state.db_pool


def get_jwt_secret(request: Request) -> str | None:
    return request.app.state.jwt_secret


def get_jwt_expires_seconds(request: Request) -> int:
    return request.app.state.jwt_expires_seconds


async def require_user(request: Request) -> AuthUser:
    current_user = request.app.state.current_user
    if not current_user:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await current_user(request)


async def optional_user(request: Request) -> AuthUser | None:
    if not request.headers.get("authorization"):
        return None
    return await require_user(request)


def is_admin(request: Request, user: AuthUser) -> bool:
    admin_email = request.app.state.admin_email
    if not admin_email:
        return False
    return user.email.lower() == admin_email


async def frame_exists(request: Request, frame_id: str) -> bool:
    record = await get_frame_store(request).get_frame(frame_id)
    if record:
        return True
    return frame_id in await get_storage(request).list_frames()


async def load_chart_for_user(request: Request, chart_id: str, user_id: str):
    storage = get_storage(request)
    if hasattr(storage, "load_chart_for_user"):
        record = await storage.load_chart_for_user(chart_id, user_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Chart not found")
        return record
    record = await storage.load_chart(chart_id)
    if record.user_id and record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chart not found")
    return record
