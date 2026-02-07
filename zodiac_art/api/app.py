"""FastAPI application for chart rendering."""

from __future__ import annotations

from typing import Any

from fastapi import Body, FastAPI, HTTPException, Response
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
    FrameListItem,
)
from zodiac_art.api.rendering import (
    compute_auto_layout_overrides,
    render_chart_png,
    render_chart_svg,
)
from zodiac_art.api.storage import FileStorage
from zodiac_art.api.storage_async import AsyncFileStorage
from zodiac_art.api.storage_postgres import PostgresStorage
from zodiac_art.config import PROJECT_ROOT, build_database_url
from zodiac_art.frames.validation import validate_meta

app = FastAPI(title="Zodiac Art API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)

storage: Any = None
db_pool = None

frames_path = PROJECT_ROOT / "zodiac_art" / "frames"
data_path = PROJECT_ROOT / "data"
app.mount("/static/frames", StaticFiles(directory=frames_path), name="frames")
app.mount("/static/data", StaticFiles(directory=data_path), name="data")


@app.on_event("startup")
async def startup() -> None:
    global storage
    global db_pool
    database_url = build_database_url()
    if database_url:
        import asyncpg

        db_pool = await asyncpg.create_pool(database_url, min_size=1, max_size=5)
        storage = PostgresStorage(db_pool)
    else:
        storage = AsyncFileStorage(FileStorage())


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


@app.get("/api/frames", response_model=list[FrameListItem])
async def list_frames() -> list[FrameListItem]:
    frames: list[FrameListItem] = []
    for frame_id in await storage.list_frames():
        image_path = await storage.template_image_path(frame_id)
        frames.append(
            FrameListItem(
                id=frame_id,
                image_path=f"/static/frames/{frame_id}/{image_path.name}",
                template_meta_path=f"/static/frames/{frame_id}/metadata.json",
            )
        )
    return frames


@app.post("/api/charts", response_model=ChartCreateResponse)
async def create_chart(payload: ChartCreateRequest) -> ChartCreateResponse:
    if payload.default_frame_id and payload.default_frame_id not in await storage.list_frames():
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
    for frame_id in await storage.list_frames():
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
    if frame_id not in await storage.list_frames():
        raise HTTPException(status_code=404, detail="Frame not found")

    image_path = await storage.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    validate_meta(payload, image_size)
    await storage.save_chart_meta(chart_id, frame_id, payload)
    return {"status": "ok"}


@app.put("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def save_layout(
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
) -> dict:
    _validate_chart_id(chart_id)
    if not await storage.chart_exists(chart_id):
        raise HTTPException(status_code=404, detail="Chart not found")
    if frame_id not in await storage.list_frames():
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
    if frame_id not in await storage.list_frames():
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
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    assert frame_id is not None
    png_bytes = await render_chart_png(storage, record, frame_id, max_size=size)
    return Response(content=png_bytes, media_type="image/png")


@app.get("/api/health/db")
async def health_db() -> JSONResponse | dict:
    database_url = build_database_url()
    if not database_url or not db_pool:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": "Database not configured"},
        )
    try:
        async with db_pool.acquire() as conn:
            await conn.execute("SELECT 1")
        return {"ok": True, "db": "postgres"}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"ok": False, "error": str(exc)})


def main() -> None:
    import uvicorn

    uvicorn.run("zodiac_art.api.app:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
