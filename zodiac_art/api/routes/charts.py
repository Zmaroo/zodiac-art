"""Chart routes."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from zodiac_art.api.auth import AuthUser
from zodiac_art.api.deps import (
    frame_exists,
    get_frame_store,
    get_session_store,
    get_storage,
    load_chart_for_user,
    require_user,
)
from zodiac_art.api.chart_inputs import build_chart_payload, normalize_chart_name
from zodiac_art.api.models import (
    AutoLayoutRequest,
    AutoLayoutResponse,
    ChartCreateResponse,
    ChartFrameStatus,
    ChartInfoResponse,
    ChartListItem,
    ChartSaveRequest,
)
from zodiac_art.api.rendering import (
    chart_only_meta_payload,
    compute_auto_layout_overrides,
    compute_auto_layout_overrides_chart_only,
)
from zodiac_art.api.session_storage import ChartSession, session_to_chart_record
from zodiac_art.api.validators import (
    ensure_layout_version,
    validate_chart_fit_payload,
    validate_chart_id,
    validate_layout_payload,
    validate_session_id,
)
from zodiac_art.frames.validation import validate_meta

router = APIRouter()


@router.post("/api/charts", response_model=ChartCreateResponse)
async def create_chart(
    request: Request,
    payload: ChartSaveRequest,
    user: AuthUser = Depends(require_user),
) -> ChartCreateResponse:
    storage = get_storage(request)
    if payload.session_id:
        validate_session_id(payload.session_id)
        session_store = get_session_store(request)
        session = await session_store.load_session(payload.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Chart session not found")
        session_user = session.payload.get("user_id")
        if session_user and session_user != user.user_id:
            raise HTTPException(status_code=404, detail="Chart session not found")
        chart_record = session_to_chart_record(ChartSession(payload.session_id, session.payload))
        name = normalize_chart_name(payload.name or chart_record.name)
        default_frame_id = payload.default_frame_id or chart_record.default_frame_id
        if default_frame_id:
            frame = await get_frame_store(request).get_frame(default_frame_id)
            if not frame and default_frame_id not in await storage.list_frames():
                raise HTTPException(status_code=400, detail="Unknown frame_id")
        record = await storage.create_chart(
            user_id=user.user_id,
            name=name,
            birth_date=chart_record.birth_date,
            birth_time=chart_record.birth_time,
            latitude=chart_record.latitude,
            longitude=chart_record.longitude,
            default_frame_id=default_frame_id,
            birth_place_text=chart_record.birth_place_text,
            birth_place_id=chart_record.birth_place_id,
            timezone=chart_record.timezone,
            birth_datetime_utc=chart_record.birth_datetime_utc,
        )
    else:
        if payload.birth_date is None or payload.birth_time is None:
            raise HTTPException(status_code=400, detail="Birth date and time are required")
        if payload.default_frame_id:
            frame = await get_frame_store(request).get_frame(payload.default_frame_id)
            if not frame and payload.default_frame_id not in await storage.list_frames():
                raise HTTPException(status_code=400, detail="Unknown frame_id")
        chart_payload = build_chart_payload(payload)
        record = await storage.create_chart(
            user_id=user.user_id,
            name=chart_payload["name"],
            birth_date=chart_payload["birth_date"],
            birth_time=chart_payload["birth_time"],
            latitude=chart_payload["latitude"],
            longitude=chart_payload["longitude"],
            default_frame_id=chart_payload["default_frame_id"],
            birth_place_text=chart_payload["birth_place_text"],
            birth_place_id=chart_payload["birth_place_id"],
            timezone=chart_payload["timezone"],
            birth_datetime_utc=chart_payload["birth_datetime_utc"],
        )
    return ChartCreateResponse(chart_id=record.chart_id)


@router.get("/api/charts", response_model=list[ChartListItem])
async def list_charts(
    request: Request,
    limit: int | None = 20,
    offset: int | None = 0,
    user: AuthUser = Depends(require_user),
) -> list[ChartListItem]:
    safe_limit = max(1, min(limit or 20, 200))
    safe_offset = max(0, offset or 0)
    storage = get_storage(request)
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


@router.get("/api/charts/{chart_id}", response_model=ChartInfoResponse)
async def get_chart(
    request: Request,
    chart_id: str,
    user: AuthUser = Depends(require_user),
) -> ChartInfoResponse:
    validate_chart_id(chart_id)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    frames = []
    for frame in await get_frame_store(request).list_frames():
        frame_id = frame.frame_id
        frames.append(
            ChartFrameStatus(
                id=frame_id,
                has_metadata=await get_storage(request).metadata_exists(chart_id, frame_id),
                has_layout=await get_storage(request).layout_exists(chart_id, frame_id),
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


@router.put("/api/charts/{chart_id}/frames/{frame_id}/metadata")
async def save_metadata(
    request: Request,
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")

    storage = get_storage(request)
    image_path = await storage.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    validate_meta(payload, image_size)
    await storage.save_chart_meta(chart_id, frame_id, payload)
    return {"status": "ok"}


@router.get("/api/charts/{chart_id}/frames/{frame_id}/metadata")
async def load_metadata(
    request: Request,
    chart_id: str,
    frame_id: str,
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    meta = await get_storage(request).load_chart_meta(chart_id, frame_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Metadata not found")
    return meta


@router.put("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def save_layout(
    request: Request,
    chart_id: str,
    frame_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    validated = validate_layout_payload(payload)
    await get_storage(request).save_chart_layout(chart_id, frame_id, validated)
    return {"status": "ok"}


@router.get("/api/charts/{chart_id}/frames/{frame_id}/layout")
async def load_layout(
    request: Request,
    chart_id: str,
    frame_id: str,
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    layout = await get_storage(request).load_chart_layout(chart_id, frame_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return ensure_layout_version(layout, f"chart {chart_id} frame {frame_id}")


@router.get("/api/charts/{chart_id}/chart_only/meta")
async def load_chart_only_meta(
    request: Request,
    chart_id: str,
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    chart_fit = await get_storage(request).load_chart_fit(chart_id)
    return chart_only_meta_payload(chart_fit)


@router.put("/api/charts/{chart_id}/chart_fit")
async def save_chart_fit(
    request: Request,
    chart_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    validated = validate_chart_fit_payload(payload)
    await get_storage(request).save_chart_fit(chart_id, validated)
    return {"status": "ok"}


@router.get("/api/charts/{chart_id}/chart_fit")
async def load_chart_fit(
    request: Request,
    chart_id: str,
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    chart_fit = await get_storage(request).load_chart_fit(chart_id)
    if chart_fit is None:
        raise HTTPException(status_code=404, detail="Chart fit not found")
    return chart_fit


@router.put("/api/charts/{chart_id}/layout")
async def save_chart_layout(
    request: Request,
    chart_id: str,
    payload: dict = Body(...),
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    validated = validate_layout_payload(payload)
    await get_storage(request).save_chart_layout_base(chart_id, validated)
    return {"status": "ok"}


@router.get("/api/charts/{chart_id}/layout")
async def load_chart_layout(
    request: Request,
    chart_id: str,
    user: AuthUser = Depends(require_user),
) -> dict:
    validate_chart_id(chart_id)
    await load_chart_for_user(request, chart_id, user.user_id)
    layout = await get_storage(request).load_chart_layout_base(chart_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return ensure_layout_version(layout, f"chart {chart_id} base")


@router.post(
    "/api/charts/{chart_id}/frames/{frame_id}/auto_layout",
    response_model=AutoLayoutResponse,
)
async def auto_layout(
    request: Request,
    chart_id: str,
    frame_id: str,
    payload: AutoLayoutRequest = Body(default=AutoLayoutRequest()),
    user: AuthUser = Depends(require_user),
) -> AutoLayoutResponse:
    validate_chart_id(chart_id)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if payload.mode != "glyphs":
        raise HTTPException(status_code=400, detail="Unsupported auto layout mode")
    storage = get_storage(request)
    overrides = await compute_auto_layout_overrides(
        storage,
        record,
        frame_id,
        min_gap_px=payload.min_gap_px,
        max_iter=payload.max_iter,
    )
    return AutoLayoutResponse(overrides=overrides)


@router.post("/api/charts/{chart_id}/auto_layout", response_model=AutoLayoutResponse)
async def auto_layout_chart_only(
    request: Request,
    chart_id: str,
    payload: AutoLayoutRequest = Body(default=AutoLayoutRequest()),
    user: AuthUser = Depends(require_user),
) -> AutoLayoutResponse:
    validate_chart_id(chart_id)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if payload.mode != "glyphs":
        raise HTTPException(status_code=400, detail="Unsupported auto layout mode")
    overrides = await compute_auto_layout_overrides_chart_only(
        get_storage(request),
        record,
        min_gap_px=payload.min_gap_px,
        max_iter=payload.max_iter,
    )
    return AutoLayoutResponse(overrides=overrides)
