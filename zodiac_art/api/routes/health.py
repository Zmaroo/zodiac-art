"""Health check routes."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from zodiac_art.api.deps import get_db_pool
from zodiac_art.config import build_database_url

router = APIRouter()


@router.get("/api/health/db", response_model=None)
async def health_db(request: Request) -> JSONResponse:
    database_url = build_database_url()
    db_pool = get_db_pool(request)
    if not database_url or not db_pool:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": "Database not configured"},
        )
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return JSONResponse(status_code=200, content={"ok": True, "db": "postgres"})
    except Exception as exc:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(exc)})
