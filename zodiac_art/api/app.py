"""FastAPI application for chart rendering."""

from __future__ import annotations

import json
import logging
import re
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Body, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import Scope

from zodiac_art.api.auth import (
    AuthUser,
    create_access_token,
    create_user,
    get_current_user_dependency,
    get_user_by_email,
    hash_password,
    verify_password,
)
from zodiac_art.api.frames_store import (
    FileFrameStore,
    PostgresFrameStore,
    default_template_metadata,
    normalize_tags,
    prepare_frame_files,
    validate_frame_image,
    write_template_metadata,
)
from zodiac_art.api.models import (
    AuthRequest,
    AuthResponse,
    AuthUserInfo,
    AutoLayoutRequest,
    AutoLayoutResponse,
    ChartCreateRequest,
    ChartCreateResponse,
    ChartFrameStatus,
    ChartInfoResponse,
    ChartListItem,
)
from zodiac_art.api.rendering import (
    chart_only_meta_payload,
    compute_auto_layout_overrides,
    render_chart_only_png,
    render_chart_only_svg,
    render_chart_png,
    render_chart_svg,
)
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
from zodiac_art.frames.validation import validate_meta
from zodiac_art.geo.timezone import resolve_timezone, to_utc_iso


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


load_dotenv(override=False)


class StaticFilesWithCors(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response


app = FastAPI(title="Zodiac Art API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": exc.errors()})


frames_path = PROJECT_ROOT / "zodiac_art" / "frames"
data_path = PROJECT_ROOT / "data"
storage_path = STORAGE_ROOT
storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/static/frames", StaticFilesWithCors(directory=frames_path), name="frames")
app.mount("/static/data", StaticFilesWithCors(directory=data_path), name="data")
app.mount("/static/storage", StaticFilesWithCors(directory=storage_path), name="storage")

logger = logging.getLogger(__name__)


def _validate_chart_id(chart_id: str) -> None:
    from uuid import UUID

    try:
        UUID(chart_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid chart id") from exc


def _validate_chart_fit_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Chart fit payload must be an object")
    dx = payload.get("dx", 0.0)
    dy = payload.get("dy", 0.0)
    scale = payload.get("scale", 1.0)
    rotation = payload.get("rotation_deg", 0.0)
    if not isinstance(dx, (int, float)) or not isinstance(dy, (int, float)):
        raise HTTPException(status_code=400, detail="Chart fit dx/dy must be numbers")
    if not isinstance(scale, (int, float)) or scale <= 0:
        raise HTTPException(status_code=400, detail="Chart fit scale must be positive")
    if not isinstance(rotation, (int, float)):
        raise HTTPException(status_code=400, detail="Chart fit rotation must be a number")
    return {
        "dx": float(dx),
        "dy": float(dy),
        "scale": float(scale),
        "rotation_deg": float(rotation),
    }


def _validate_layout_payload(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Layout payload must be an object")
    version = payload.get("version", 1)
    if not isinstance(version, int):
        raise HTTPException(status_code=400, detail="Layout version must be an integer")
    overrides = payload.get("overrides", {})
    if not isinstance(overrides, dict):
        raise HTTPException(status_code=400, detail="Layout overrides must be an object")
    normalized_overrides: dict[str, dict[str, float | str]] = {}
    for key, value in overrides.items():
        if not isinstance(key, str) or not isinstance(value, dict):
            raise HTTPException(status_code=400, detail="Invalid override format")
        normalized: dict[str, float | str] = {}
        if "dx" in value:
            dx = value.get("dx", 0.0)
            if not isinstance(dx, (int, float)):
                logger.warning("Invalid override dx for %s", key)
                raise HTTPException(status_code=400, detail="Override dx must be a number")
            normalized["dx"] = float(dx)
        if "dy" in value:
            dy = value.get("dy", 0.0)
            if not isinstance(dy, (int, float)):
                logger.warning("Invalid override dy for %s", key)
                raise HTTPException(status_code=400, detail="Override dy must be a number")
            normalized["dy"] = float(dy)
        if "dr" in value:
            dr = value.get("dr", 0.0)
            if not isinstance(dr, (int, float)):
                logger.warning("Invalid override dr for %s", key)
                raise HTTPException(status_code=400, detail="Override dr must be a number")
            normalized["dr"] = float(dr)
        if "dt" in value:
            dt = value.get("dt", 0.0)
            if not isinstance(dt, (int, float)):
                logger.warning("Invalid override dt for %s", key)
                raise HTTPException(status_code=400, detail="Override dt must be a number")
            normalized["dt"] = float(dt)
        if "color" in value:
            color = value.get("color")
            if not isinstance(color, str):
                logger.warning("Invalid override color for %s", key)
                raise HTTPException(status_code=400, detail="Override color must be a string")
            normalized["color"] = color
        if normalized:
            normalized_overrides[key] = normalized
    frame_circle = payload.get("frame_circle")
    normalized_circle: dict[str, float] | None = None
    if frame_circle is not None:
        if not isinstance(frame_circle, dict):
            raise HTTPException(status_code=400, detail="frame_circle must be an object")
        normalized_circle = {}
        for key in ("cxNorm", "cyNorm", "rNorm"):
            value = frame_circle.get(key)
            if not isinstance(value, (int, float)):
                raise HTTPException(status_code=400, detail="frame_circle values must be numbers")
            normalized_circle[key] = float(value)
    result = {"version": version, "overrides": normalized_overrides}
    if normalized_circle is not None:
        result["frame_circle"] = normalized_circle
    return result


def _ensure_layout_version(layout: dict, context: str) -> dict:
    if not isinstance(layout, dict):
        return layout
    if "version" in layout:
        return layout
    logger.warning("Layout missing version (%s)", context)
    return {"version": 1, **layout}


def _validate_glyph_outline_color(color: str | None) -> None:
    if not color:
        return
    if not isinstance(color, str):
        raise HTTPException(status_code=400, detail="glyph_outline_color must be a string")
    if not re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", color):
        raise HTTPException(status_code=400, detail="Invalid glyph_outline_color format")


def _is_admin(user: AuthUser) -> bool:
    admin_email = app.state.admin_email
    if not admin_email:
        return False
    return user.email.lower() == admin_email


def _get_storage() -> Any:
    return app.state.storage


def _get_frame_store() -> Any:
    return app.state.frame_store


def _get_db_pool():
    return app.state.db_pool


def _get_jwt_secret() -> str | None:
    return app.state.jwt_secret


def _get_jwt_expires_seconds() -> int:
    return app.state.jwt_expires_seconds


def _render_cache_headers() -> dict[str, str]:
    return {"Cache-Control": "private, max-age=60"}


def _public_url(rel_path: str) -> str:
    storage_path = STORAGE_ROOT / rel_path
    if storage_path.exists():
        return f"/static/storage/{rel_path}"
    return f"/static/{rel_path}"


def _parse_template_metadata(
    raw_json: str | None,
    width: int,
    height: int,
) -> dict:
    if not raw_json:
        return default_template_metadata(width, height)
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError("Invalid template_metadata_json") from exc
    if not isinstance(data, dict):
        raise ValueError("template_metadata_json must be an object")
    return data


async def _require_user(request: Request) -> AuthUser:
    current_user = request.app.state.current_user
    if not current_user:
        raise HTTPException(status_code=500, detail="Auth not initialized")
    return await current_user(request)


async def _optional_user(request: Request) -> AuthUser | None:
    if not request.headers.get("authorization"):
        return None
    return await _require_user(request)


async def _frame_exists(frame_id: str) -> bool:
    record = await _get_frame_store().get_frame(frame_id)
    if record:
        return True
    return frame_id in await _get_storage().list_frames()


async def _load_chart_for_user(chart_id: str, user_id: str):
    storage = _get_storage()
    if hasattr(storage, "load_chart_for_user"):
        record = await storage.load_chart_for_user(chart_id, user_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Chart not found")
        return record
    record = await storage.load_chart(chart_id)
    if record.user_id and record.user_id != user_id:
        raise HTTPException(status_code=404, detail="Chart not found")
    return record


@app.get("/api/frames")
async def list_frames(
    tag: str | None = None,
    mine: bool | None = None,
    limit: int | None = 200,
    offset: int | None = 0,
    user: AuthUser | None = Depends(_optional_user),
) -> list[dict]:
    tag_filter = tag.strip().lower() if tag else None
    safe_limit = max(1, min(limit or 200, 500))
    safe_offset = max(0, offset or 0)
    owner_user_id = None
    include_global = True
    if mine:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        owner_user_id = user.user_id
        include_global = False
    elif mine is False:
        owner_user_id = None
        include_global = True
    elif user:
        owner_user_id = user.user_id
    records = await _get_frame_store().list_frames(
        tag=tag_filter,
        owner_user_id=owner_user_id,
        include_global=include_global,
        limit=safe_limit,
        offset=safe_offset,
    )
    response: list[dict] = []
    for record in records:
        response.append(
            {
                "id": record.frame_id,
                "name": record.name,
                "tags": record.tags,
                "width": record.width,
                "height": record.height,
                "thumb_url": _public_url(record.thumb_path),
            }
        )
    return response


@app.get("/api/frames/{frame_id}")
async def get_frame(frame_id: str) -> dict:
    record = await _get_frame_store().get_frame(frame_id)
    if not record:
        raise HTTPException(status_code=404, detail="Frame not found")
    return {
        "id": record.frame_id,
        "name": record.name,
        "tags": record.tags,
        "width": record.width,
        "height": record.height,
        "thumb_url": _public_url(record.thumb_path),
        "image_url": _public_url(record.image_path),
        "template_metadata_json": record.template_metadata_json,
    }


@app.post("/api/frames")
async def create_frame(
    file: UploadFile = File(...),
    name: str = Form(...),
    tags: str | None = Form(None),
    template_metadata_json: str | None = Form(None),
    global_frame: bool = Form(False),
    user: AuthUser = Depends(_require_user),
) -> dict:
    frame_store = _get_frame_store()
    if not isinstance(frame_store, PostgresFrameStore):
        raise HTTPException(status_code=500, detail="Database not configured")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Frame name is required")
    if not file.content_type or file.content_type.lower() not in {
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
    }:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")

    from io import BytesIO

    from PIL import Image

    try:
        with Image.open(BytesIO(data)) as image:
            image.load()
            width, height = validate_frame_image(image)
            metadata = _parse_template_metadata(
                template_metadata_json,
                width,
                height,
            )
            validate_meta(metadata, image.size)
            frame_id = str(uuid4())
            file_info = prepare_frame_files(frame_id, image)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    write_template_metadata(frame_id, metadata)
    owner_user_id = user.user_id
    if global_frame:
        if not _is_admin(user):
            raise HTTPException(status_code=403, detail="Admin required")
        owner_user_id = None
    record = await frame_store.create_frame(
        frame_id=frame_id,
        owner_user_id=owner_user_id,
        name=name.strip(),
        tags=normalize_tags(tags or ""),
        width=width,
        height=height,
        image_path=file_info["image_path"],
        thumb_path=file_info["thumb_256"],
        template_metadata_json=metadata,
        thumbnails=[
            (256, file_info["thumb_256"]),
            (512, file_info["thumb_512"]),
        ],
    )
    return {
        "id": record.frame_id,
        "name": record.name,
        "tags": record.tags,
        "width": record.width,
        "height": record.height,
        "thumb_url": _public_url(record.thumb_path),
        "image_url": _public_url(record.image_path),
        "template_metadata_json": record.template_metadata_json,
    }


@app.post("/api/auth/register", response_model=AuthResponse)
async def register(payload: AuthRequest) -> AuthResponse:
    db_pool = _get_db_pool()
    jwt_secret = _get_jwt_secret()
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
    token = create_access_token(user, jwt_secret, _get_jwt_expires_seconds())
    return AuthResponse(
        token=token,
        user=AuthUserInfo(id=user.user_id, email=user.email, is_admin=_is_admin(user)),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(payload: AuthRequest) -> AuthResponse:
    db_pool = _get_db_pool()
    jwt_secret = _get_jwt_secret()
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
    token = create_access_token(user, jwt_secret, _get_jwt_expires_seconds())
    return AuthResponse(
        token=token,
        user=AuthUserInfo(id=user.user_id, email=user.email, is_admin=_is_admin(user)),
    )


@app.get("/api/auth/me")
async def me(user: AuthUser = Depends(_require_user)) -> dict:
    return {"id": user.user_id, "email": user.email, "is_admin": _is_admin(user)}


@app.post("/api/charts", response_model=ChartCreateResponse)
async def create_chart(
    payload: ChartCreateRequest,
    user: AuthUser = Depends(_require_user),
) -> ChartCreateResponse:
    storage = _get_storage()
    if payload.default_frame_id:
        frame = await _get_frame_store().get_frame(payload.default_frame_id)
        if not frame and payload.default_frame_id not in await storage.list_frames():
            raise HTTPException(status_code=400, detail="Unknown frame_id")
    name = payload.name.strip() if payload.name else None
    if not name:
        now = datetime.now(timezone.utc)
        name = f"Chart {now.strftime('%Y-%m-%d %H:%M')}"
    birth_place_text = None
    birth_place_id = None
    timezone_name = None
    birth_datetime_utc = None
    latitude = payload.latitude
    longitude = payload.longitude

    if payload.birth_place_id:
        raise HTTPException(status_code=400, detail="birth_place_id is not supported")
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude are required")
    if timezone_name is None:
        timezone_name = resolve_timezone(latitude, longitude)
    if timezone_name:
        try:
            birth_datetime_utc = to_utc_iso(payload.birth_date, payload.birth_time, timezone_name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    record = await storage.create_chart(
        user_id=user.user_id,
        name=name,
        birth_date=payload.birth_date,
        birth_time=payload.birth_time,
        latitude=latitude,
        longitude=longitude,
        default_frame_id=payload.default_frame_id,
        birth_place_text=birth_place_text,
        birth_place_id=birth_place_id,
        timezone=timezone_name,
        birth_datetime_utc=birth_datetime_utc,
    )
    return ChartCreateResponse(chart_id=record.chart_id)


@app.get("/api/charts", response_model=list[ChartListItem])
async def list_charts(
    limit: int | None = 20,
    offset: int | None = 0,
    user: AuthUser = Depends(_require_user),
) -> list[ChartListItem]:
    safe_limit = max(1, min(limit or 20, 200))
    safe_offset = max(0, offset or 0)
    storage = _get_storage()
    if hasattr(storage, "list_charts"):
        records = await storage.list_charts(user.user_id, safe_limit, safe_offset)
    else:
        records = []
    return [
        ChartListItem(
            chart_id=record.chart_id,
            name=record.name,
            created_at=record.created_at,
            default_frame_id=record.default_frame_id,
        )
        for record in records
    ]


@app.get("/api/charts/{chart_id}", response_model=ChartInfoResponse)
async def get_chart(chart_id: str, user: AuthUser = Depends(_require_user)) -> ChartInfoResponse:
    _validate_chart_id(chart_id)
    record = await _load_chart_for_user(chart_id, user.user_id)
    frames = []
    for frame in await _get_frame_store().list_frames():
        frame_id = frame.frame_id
        frames.append(
            ChartFrameStatus(
                id=frame_id,
                has_metadata=await _get_storage().metadata_exists(chart_id, frame_id),
                has_layout=await _get_storage().layout_exists(chart_id, frame_id),
            )
        )
    return ChartInfoResponse(
        chart_id=record.chart_id,
        name=record.name,
        birth_date=record.birth_date,
        birth_time=record.birth_time,
        latitude=record.latitude,
        longitude=record.longitude,
        default_frame_id=record.default_frame_id,
        created_at=record.created_at,
        birth_place_text=record.birth_place_text,
        birth_place_id=record.birth_place_id,
        timezone=record.timezone,
        birth_datetime_utc=record.birth_datetime_utc,
        frames=frames,
    )


@app.put("/api/charts/{chart_id}/frames/{frame_id}/metadata")
async def save_metadata(
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")

    storage = _get_storage()
    image_path = await storage.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    validate_meta(payload, image_size)
    await storage.save_chart_meta(chart_id, frame_id, payload)
    return {"status": "ok"}


@app.get("/api/charts/{chart_id}/frames/{frame_id}/metadata")
async def load_metadata(
    chart_id: str,
    frame_id: str,
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    meta = await _get_storage().load_chart_meta(chart_id, frame_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Metadata not found")
    return meta


@app.put("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def save_layout(
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    validated = _validate_layout_payload(payload)
    await _get_storage().save_chart_layout(chart_id, frame_id, validated)
    return {"status": "ok"}


@app.get("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def load_layout(
    chart_id: str,
    frame_id: str,
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    layout = await _get_storage().load_chart_layout(chart_id, frame_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return _ensure_layout_version(layout, f"chart {chart_id} frame {frame_id}")


@app.get("/api/charts/{chart_id}/chart_only/meta")
async def load_chart_only_meta(
    chart_id: str,
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    chart_fit = await _get_storage().load_chart_fit(chart_id)
    return chart_only_meta_payload(chart_fit)


@app.put("/api/charts/{chart_id}/chart_fit")
async def save_chart_fit(
    chart_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    validated = _validate_chart_fit_payload(payload)
    await _get_storage().save_chart_fit(chart_id, validated)
    return {"status": "ok"}


@app.get("/api/charts/{chart_id}/chart_fit")
async def load_chart_fit(
    chart_id: str,
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    chart_fit = await _get_storage().load_chart_fit(chart_id)
    if chart_fit is None:
        raise HTTPException(status_code=404, detail="Chart fit not found")
    return chart_fit


@app.put("/api/charts/{chart_id}/layout")
async def save_chart_layout(
    chart_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    validated = _validate_layout_payload(payload)
    await _get_storage().save_chart_layout_base(chart_id, validated)
    return {"status": "ok"}


@app.get("/api/charts/{chart_id}/layout")
async def load_chart_layout(
    chart_id: str,
    user: AuthUser = Depends(_require_user),
) -> dict:
    _validate_chart_id(chart_id)
    await _load_chart_for_user(chart_id, user.user_id)
    layout = await _get_storage().load_chart_layout_base(chart_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return _ensure_layout_version(layout, f"chart {chart_id} base")


@app.post(
    "/api/charts/{chart_id}/frames/{frame_id}/auto_layout",
    response_model=AutoLayoutResponse,
)
async def auto_layout(
    chart_id: str,
    frame_id: str,
    payload: AutoLayoutRequest = Body(default=AutoLayoutRequest()),
    user: AuthUser = Depends(_require_user),
) -> AutoLayoutResponse:
    _validate_chart_id(chart_id)
    record = await _load_chart_for_user(chart_id, user.user_id)
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if payload.mode != "glyphs":
        raise HTTPException(status_code=400, detail="Unsupported auto layout mode")
    storage = _get_storage()
    overrides = await compute_auto_layout_overrides(
        storage,
        record,
        frame_id,
        min_gap_px=payload.min_gap_px,
        max_iter=payload.max_iter,
    )
    return AutoLayoutResponse(overrides=overrides)


@app.get("/api/charts/{chart_id}/render.svg")
async def render_svg(
    chart_id: str,
    frame_id: str | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(_require_user),
) -> Response:
    _validate_chart_id(chart_id)
    _validate_glyph_outline_color(glyph_outline_color)
    record = await _load_chart_for_user(chart_id, user.user_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    result = await render_chart_svg(
        _get_storage(),
        record,
        frame_id,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    return Response(
        content=result.svg,
        media_type="image/svg+xml",
        headers=_render_cache_headers(),
    )


@app.get("/api/charts/{chart_id}/render_chart.svg")
async def render_chart_only_svg_endpoint(
    chart_id: str,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(_require_user),
) -> Response:
    _validate_chart_id(chart_id)
    _validate_glyph_outline_color(glyph_outline_color)
    record = await _load_chart_for_user(chart_id, user.user_id)
    result = await render_chart_only_svg(
        _get_storage(),
        record,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    return Response(
        content=result.svg,
        media_type="image/svg+xml",
        headers=_render_cache_headers(),
    )


@app.get("/api/charts/{chart_id}/render.png")
async def render_png(
    chart_id: str,
    frame_id: str | None = None,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(_require_user),
) -> Response:
    _validate_chart_id(chart_id)
    _validate_glyph_outline_color(glyph_outline_color)
    record = await _load_chart_for_user(chart_id, user.user_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    assert frame_id is not None
    png_bytes = await render_chart_png(
        _get_storage(),
        record,
        frame_id,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers=_render_cache_headers(),
    )


@app.get("/api/charts/{chart_id}/render_chart.png")
async def render_chart_only_png_endpoint(
    chart_id: str,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(_require_user),
) -> Response:
    _validate_chart_id(chart_id)
    _validate_glyph_outline_color(glyph_outline_color)
    record = await _load_chart_for_user(chart_id, user.user_id)
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    png_bytes = await render_chart_only_png(
        _get_storage(),
        record,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers=_render_cache_headers(),
    )


@app.get("/api/health/db", response_model=None)
async def health_db() -> JSONResponse:
    database_url = build_database_url()
    db_pool = _get_db_pool()
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


def main() -> None:
    import uvicorn

    uvicorn.run("zodiac_art.api.app:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
