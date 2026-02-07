"""FastAPI application for chart rendering."""

from __future__ import annotations

import json
from typing import Any
from uuid import uuid4

from fastapi import Body, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from zodiac_art.api.models import (
    AutoLayoutRequest,
    AutoLayoutResponse,
    ChartCreateRequest,
    ChartCreateResponse,
    ChartInfoResponse,
    ChartFrameStatus,
)
from zodiac_art.api.rendering import (
    compute_auto_layout_overrides,
    render_chart_png,
    render_chart_svg,
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
from zodiac_art.api.storage import FileStorage
from zodiac_art.api.storage_async import AsyncFileStorage
from zodiac_art.api.storage_postgres import PostgresStorage
from zodiac_art.config import PROJECT_ROOT, STORAGE_ROOT, build_database_url
from zodiac_art.frames.validation import validate_meta

app = FastAPI(title="Zodiac Art API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)

storage: Any = None
frame_store: Any = None
db_pool = None

frames_path = PROJECT_ROOT / "zodiac_art" / "frames"
data_path = PROJECT_ROOT / "data"
storage_path = STORAGE_ROOT
storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/static/frames", StaticFiles(directory=frames_path), name="frames")
app.mount("/static/data", StaticFiles(directory=data_path), name="data")
app.mount("/static/storage", StaticFiles(directory=storage_path), name="storage")


@app.on_event("startup")
async def startup() -> None:
    global storage
    global frame_store
    global db_pool
    database_url = build_database_url()
    if database_url:
        import asyncpg

        db_pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5)
        storage = PostgresStorage(db_pool)
        frame_store = PostgresFrameStore(db_pool)
    else:
        storage = AsyncFileStorage(FileStorage())
        frame_store = FileFrameStore()


@app.on_event("shutdown")
async def shutdown() -> None:
    global db_pool
    if db_pool:
        await db_pool.close()
        db_pool = None


def _validate_chart_id(chart_id: str) -> None:
    from uuid import UUID

    try:
        UUID(chart_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid chart id") from exc


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


async def _frame_exists(frame_id: str) -> bool:
    record = await frame_store.get_frame(frame_id)
    if record:
        return True
    return frame_id in await storage.list_frames()


@app.get("/api/frames")
async def list_frames(
    tag: str | None = None,
    mine: bool | None = None,
    limit: int | None = 200,
) -> list[dict]:
    tag_filter = tag.strip().lower() if tag else None
    safe_limit = max(1, min(limit or 200, 500))
    records = await frame_store.list_frames(tag=tag_filter, mine=bool(mine), limit=safe_limit)
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
    record = await frame_store.get_frame(frame_id)
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
) -> dict:
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
    record = await frame_store.create_frame(
        frame_id=frame_id,
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


@app.post("/api/charts", response_model=ChartCreateResponse)
async def create_chart(payload: ChartCreateRequest) -> ChartCreateResponse:
    if payload.default_frame_id:
        frame = await frame_store.get_frame(payload.default_frame_id)
        if not frame and payload.default_frame_id not in await storage.list_frames():
            raise HTTPException(status_code=400, detail="Unknown frame_id")
    record = await storage.create_chart(
        birth_date=payload.birth_date,
        birth_time=payload.birth_time,
        latitude=payload.latitude,
        longitude=payload.longitude,
        default_frame_id=payload.default_frame_id,
    )
    return ChartCreateResponse(chart_id=record.chart_id)


@app.get("/api/charts/{chart_id}", response_model=ChartInfoResponse)
async def get_chart(chart_id: str) -> ChartInfoResponse:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    record = await storage.load_chart(chart_id)
    frames = []
    for frame in await frame_store.list_frames():
        frame_id = frame.frame_id
        frames.append(
            ChartFrameStatus(
                id=frame_id,
                has_metadata=await storage.metadata_exists(chart_id, frame_id),
                has_layout=await storage.layout_exists(chart_id, frame_id),
            )
        )
    return ChartInfoResponse(
        chart_id=record.chart_id,
        birth_date=record.birth_date,
        birth_time=record.birth_time,
        latitude=record.latitude,
        longitude=record.longitude,
        default_frame_id=record.default_frame_id,
        frames=frames,
    )


@app.put("/api/charts/{chart_id}/frames/{frame_id}/metadata")
async def save_metadata(
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
) -> dict:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")

    image_path = await storage.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    validate_meta(payload, image_size)
    await storage.save_chart_meta(chart_id, frame_id, payload)
    return {"status": "ok"}


@app.get("/api/charts/{chart_id}/frames/{frame_id}/metadata")
async def load_metadata(chart_id: str, frame_id: str) -> dict:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    meta = await storage.load_chart_meta(chart_id, frame_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Metadata not found")
    return meta


@app.put("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def save_layout(
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
) -> dict:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    overrides = payload.get("overrides", {})
    if not isinstance(overrides, dict):
        raise HTTPException(status_code=400, detail="Layout overrides must be an object")
    for key, value in overrides.items():
        if not isinstance(key, str) or not isinstance(value, dict):
            raise HTTPException(status_code=400, detail="Invalid override format")
        if "dx" in value or "dy" in value:
            dx = value.get("dx", 0.0)
            dy = value.get("dy", 0.0)
            if not isinstance(dx, (int, float)) or not isinstance(dy, (int, float)):
                raise HTTPException(
                    status_code=400, detail="Override dx/dy must be numbers"
                )
        if "dr" in value or "dt" in value:
            dr = value.get("dr", 0.0)
            dt = value.get("dt", 0.0)
            if not isinstance(dr, (int, float)) or not isinstance(dt, (int, float)):
                raise HTTPException(
                    status_code=400, detail="Override dr/dt must be numbers"
                )
    await storage.save_chart_layout(chart_id, frame_id, payload)
    return {"status": "ok"}


@app.get("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def load_layout(chart_id: str, frame_id: str) -> dict:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    layout = await storage.load_chart_layout(chart_id, frame_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return layout


@app.post(
    "/api/charts/{chart_id}/frames/{frame_id}/auto_layout",
    response_model=AutoLayoutResponse,
)
async def auto_layout(
    chart_id: str,
    frame_id: str,
    payload: AutoLayoutRequest = Body(default=AutoLayoutRequest()),
) -> AutoLayoutResponse:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if payload.mode != "labels":
        raise HTTPException(status_code=400, detail="Unsupported auto layout mode")
    record = await storage.load_chart(chart_id)
    overrides = await compute_auto_layout_overrides(
        storage,
        record,
        frame_id,
        min_gap_px=payload.min_gap_px,
        max_iter=payload.max_iter,
    )
    return AutoLayoutResponse(overrides=overrides)


@app.get("/api/charts/{chart_id}/render.svg")
async def render_svg(chart_id: str, frame_id: str | None = None) -> Response:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    record = await storage.load_chart(chart_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await _frame_exists(frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    result = await render_chart_svg(storage, record, frame_id)
    return Response(content=result.svg, media_type="image/svg+xml")


@app.get("/api/charts/{chart_id}/render.png")
async def render_png(
    chart_id: str, frame_id: str | None = None, size: int | None = None
) -> Response:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    record = await storage.load_chart(chart_id)
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
    png_bytes = await render_chart_png(storage, record, frame_id, max_size=size)
    return Response(content=png_bytes, media_type="image/png")


@app.get("/api/health/db", response_model=None)
async def health_db() -> JSONResponse:
    database_url = build_database_url()
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
