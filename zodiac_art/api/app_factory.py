"""FastAPI app factory."""

from __future__ import annotations

import logging
import secrets
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope

from zodiac_art.api.auth import get_current_user_dependency
from zodiac_art.api.frames_store import FileFrameStore, PostgresFrameStore
from zodiac_art.api.routes import auth, charts, frames, health, renders
from zodiac_art.api.storage import FileStorage
from zodiac_art.api.storage_async import AsyncFileStorage
from zodiac_art.api.storage_postgres import PostgresStorage
from zodiac_art.config import (
    PROJECT_ROOT,
    STORAGE_ROOT,
    build_database_url,
    get_admin_email,
    get_cors_origins,
    get_dev_mode,
    get_jwt_expires_seconds,
    get_jwt_secret,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    dev_mode = get_dev_mode()
    jwt_expires_seconds = get_jwt_expires_seconds()
    jwt_secret = get_jwt_secret()
    admin_email = get_admin_email()
    if not jwt_secret:
        if dev_mode:
            jwt_secret = secrets.token_urlsafe(32)
            logging.getLogger(__name__).warning("JWT_SECRET not set; using a temporary dev secret.")
        else:
            raise RuntimeError("JWT_SECRET is required when DEV_MODE is false.")
    database_url = build_database_url()
    if database_url:
        import asyncpg

        db_pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5)
        storage = PostgresStorage(db_pool)
        frame_store = PostgresFrameStore(db_pool)
        current_user = get_current_user_dependency(db_pool, jwt_secret, dev_mode)
    else:
        db_pool = None
        storage = AsyncFileStorage(FileStorage())
        frame_store = FileFrameStore()
        current_user = None
    app.state.storage = storage
    app.state.frame_store = frame_store
    app.state.db_pool = db_pool
    app.state.current_user = current_user
    app.state.jwt_secret = jwt_secret
    app.state.jwt_expires_seconds = jwt_expires_seconds
    app.state.dev_mode = dev_mode
    app.state.admin_email = admin_email
    try:
        yield
    finally:
        if app.state.db_pool:
            await app.state.db_pool.close()


class StaticFilesWithCors(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response


def _register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"error": exc.errors()})


def create_app() -> FastAPI:
    load_dotenv(override=False)
    app = FastAPI(title="Zodiac Art API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["*"],
    )

    _register_exception_handlers(app)

    frames_path = PROJECT_ROOT / "zodiac_art" / "frames"
    data_path = PROJECT_ROOT / "data"
    storage_path = STORAGE_ROOT
    storage_path.mkdir(parents=True, exist_ok=True)
    app.mount("/static/frames", StaticFilesWithCors(directory=frames_path), name="frames")
    app.mount("/static/data", StaticFilesWithCors(directory=data_path), name="data")
    app.mount("/static/storage", StaticFilesWithCors(directory=storage_path), name="storage")

    app.include_router(auth.router)
    app.include_router(charts.router)
    app.include_router(frames.router)
    app.include_router(renders.router)
    app.include_router(health.router)

    return app
