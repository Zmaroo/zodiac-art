"""Chart session routes."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response

from zodiac_art.api.chart_inputs import build_chart_payload
from zodiac_art.api.deps import (
    frame_exists,
    get_frame_store,
    get_session_store,
    get_storage,
    optional_user,
)
from zodiac_art.api.http_cache import compute_etag, etag_matches, render_cache_headers
from zodiac_art.api.models import (
    AutoLayoutRequest,
    AutoLayoutResponse,
    ChartCreateRequest,
    ChartFrameStatus,
    ChartSessionCreateResponse,
    ChartSessionInfoResponse,
)
from zodiac_art.api.rendering import (
    chart_only_meta_payload,
    compute_auto_layout_overrides,
    compute_auto_layout_overrides_chart_only,
    render_chart_only_png,
    render_chart_only_svg,
    render_chart_png,
    render_chart_svg,
)
from zodiac_art.api.session_storage import (
    ChartSession,
    SessionStorageAdapter,
    session_to_chart_record,
)
from zodiac_art.api.validators import (
    ensure_layout_version,
    normalize_design_settings,
    validate_chart_fit_payload,
    validate_glyph_outline_color,
    validate_layout_payload,
    validate_session_id,
)
from zodiac_art.frames.validation import validate_meta

router = APIRouter()


def _design_override_from_query(
    layer_order: str | None,
    sign_glyph_scale: float | None,
    planet_glyph_scale: float | None,
    inner_ring_scale: float | None,
    background_image_scale: float | None,
    background_image_dx: float | None,
    background_image_dy: float | None,
) -> dict | None:
    payload: dict[str, object] = {}
    if layer_order:
        payload["layer_order"] = [part.strip() for part in layer_order.split(",") if part.strip()]
    if sign_glyph_scale is not None:
        payload["sign_glyph_scale"] = sign_glyph_scale
    if planet_glyph_scale is not None:
        payload["planet_glyph_scale"] = planet_glyph_scale
    if inner_ring_scale is not None:
        payload["inner_ring_scale"] = inner_ring_scale
    if background_image_scale is not None:
        payload["background_image_scale"] = background_image_scale
    if background_image_dx is not None:
        payload["background_image_dx"] = background_image_dx
    if background_image_dy is not None:
        payload["background_image_dy"] = background_image_dy
    if not payload:
        return None
    normalized = normalize_design_settings(payload)
    return normalized or None


async def _load_session_for_user(request: Request, session_id: str, user) -> ChartSession:
    session = await get_session_store(request).load_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chart session not found")
    session_user = session.payload.get("user_id")
    if session_user:
        if not user or session_user != user.user_id:
            raise HTTPException(status_code=404, detail="Chart session not found")
    return session


def _session_storage(request: Request, session_id: str) -> SessionStorageAdapter:
    return SessionStorageAdapter(get_storage(request), get_session_store(request), session_id)


@router.post("/api/chart_sessions", response_model=ChartSessionCreateResponse)
async def create_session(
    request: Request,
    payload: ChartCreateRequest,
    user=Depends(optional_user),
) -> ChartSessionCreateResponse:
    storage = get_storage(request)
    if payload.default_frame_id:
        frame = await get_frame_store(request).get_frame(payload.default_frame_id)
        if not frame and payload.default_frame_id not in await storage.list_frames():
            raise HTTPException(status_code=400, detail="Unknown frame_id")
    chart_payload = build_chart_payload(payload)
    user_id = user.user_id if user else None
    session = await get_session_store(request).create_session(chart_payload, user_id)
    return ChartSessionCreateResponse(session_id=session.session_id)


@router.get("/api/chart_sessions/{session_id}", response_model=ChartSessionInfoResponse)
async def get_session(
    request: Request,
    session_id: str,
    user=Depends(optional_user),
) -> ChartSessionInfoResponse:
    validate_session_id(session_id)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    frames = []
    adapter = _session_storage(request, session_id)
    for frame in await get_frame_store(request).list_frames():
        frame_id = frame.frame_id
        frames.append(
            ChartFrameStatus(
                id=frame_id,
                has_metadata=await adapter.metadata_exists(session_id, frame_id),
                has_layout=await adapter.layout_exists(session_id, frame_id),
            )
        )
    return ChartSessionInfoResponse(
        session_id=session_id,
        name=chart_record.name,
        birth_date=chart_record.birth_date,
        birth_time=chart_record.birth_time,
        latitude=chart_record.latitude,
        longitude=chart_record.longitude,
        default_frame_id=chart_record.default_frame_id,
        created_at=chart_record.created_at,
        birth_place_text=chart_record.birth_place_text,
        birth_place_id=chart_record.birth_place_id,
        timezone=chart_record.timezone,
        birth_datetime_utc=chart_record.birth_datetime_utc,
        frames=frames,
    )


@router.put("/api/chart_sessions/{session_id}/frames/{frame_id}/metadata")
async def save_metadata(
    request: Request,
    session_id: str,
    frame_id: str,
    payload: dict = Body(...),
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    adapter = _session_storage(request, session_id)
    image_path = await adapter.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    validate_meta(payload, image_size)
    await adapter.save_chart_meta(session_id, frame_id, payload)
    return {"status": "ok"}


@router.get("/api/chart_sessions/{session_id}/frames/{frame_id}/metadata")
async def load_metadata(
    request: Request,
    session_id: str,
    frame_id: str,
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    meta = await _session_storage(request, session_id).load_chart_meta(session_id, frame_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Metadata not found")
    return meta


@router.put("/api/chart_sessions/{session_id}/frames/{frame_id}/layout")
async def save_layout(
    request: Request,
    session_id: str,
    frame_id: str,
    payload: dict = Body(...),
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    validated = validate_layout_payload(payload)
    await _session_storage(request, session_id).save_chart_layout(session_id, frame_id, validated)
    return {"status": "ok"}


@router.get("/api/chart_sessions/{session_id}/frames/{frame_id}/layout")
async def load_layout(
    request: Request,
    session_id: str,
    frame_id: str,
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    layout = await _session_storage(request, session_id).load_chart_layout(session_id, frame_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return ensure_layout_version(layout, f"session {session_id} frame {frame_id}")


@router.get("/api/chart_sessions/{session_id}/chart_only/meta")
async def load_chart_only_meta(
    request: Request,
    session_id: str,
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    chart_fit = await _session_storage(request, session_id).load_chart_fit(session_id)
    return chart_only_meta_payload(chart_fit)


@router.put("/api/chart_sessions/{session_id}/chart_fit")
async def save_chart_fit(
    request: Request,
    session_id: str,
    payload: dict = Body(...),
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    validated = validate_chart_fit_payload(payload)
    await _session_storage(request, session_id).save_chart_fit(session_id, validated)
    return {"status": "ok"}


@router.get("/api/chart_sessions/{session_id}/chart_fit")
async def load_chart_fit(
    request: Request,
    session_id: str,
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    chart_fit = await _session_storage(request, session_id).load_chart_fit(session_id)
    if chart_fit is None:
        raise HTTPException(status_code=404, detail="Chart fit not found")
    return chart_fit


@router.put("/api/chart_sessions/{session_id}/layout")
async def save_chart_layout(
    request: Request,
    session_id: str,
    payload: dict = Body(...),
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    validated = validate_layout_payload(payload)
    await _session_storage(request, session_id).save_chart_layout_base(session_id, validated)
    return {"status": "ok"}


@router.get("/api/chart_sessions/{session_id}/layout")
async def load_chart_layout(
    request: Request,
    session_id: str,
    user=Depends(optional_user),
) -> dict:
    validate_session_id(session_id)
    await _load_session_for_user(request, session_id, user)
    layout = await _session_storage(request, session_id).load_chart_layout_base(session_id)
    if layout is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return ensure_layout_version(layout, f"session {session_id} base")


@router.post(
    "/api/chart_sessions/{session_id}/frames/{frame_id}/auto_layout",
    response_model=AutoLayoutResponse,
)
async def auto_layout(
    request: Request,
    session_id: str,
    frame_id: str,
    payload: AutoLayoutRequest = Body(default=AutoLayoutRequest()),
    user=Depends(optional_user),
) -> AutoLayoutResponse:
    validate_session_id(session_id)
    session = await _load_session_for_user(request, session_id, user)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if payload.mode != "glyphs":
        raise HTTPException(status_code=400, detail="Unsupported auto layout mode")
    adapter = _session_storage(request, session_id)
    chart_record = session_to_chart_record(session)
    overrides = await compute_auto_layout_overrides(
        adapter,
        chart_record,
        frame_id,
        min_gap_px=payload.min_gap_px,
        max_iter=payload.max_iter,
    )
    return AutoLayoutResponse(overrides=overrides)


@router.post("/api/chart_sessions/{session_id}/auto_layout", response_model=AutoLayoutResponse)
async def auto_layout_chart_only(
    request: Request,
    session_id: str,
    payload: AutoLayoutRequest = Body(default=AutoLayoutRequest()),
    user=Depends(optional_user),
) -> AutoLayoutResponse:
    validate_session_id(session_id)
    session = await _load_session_for_user(request, session_id, user)
    if payload.mode != "glyphs":
        raise HTTPException(status_code=400, detail="Unsupported auto layout mode")
    adapter = _session_storage(request, session_id)
    chart_record = session_to_chart_record(session)
    overrides = await compute_auto_layout_overrides_chart_only(
        adapter,
        chart_record,
        min_gap_px=payload.min_gap_px,
        max_iter=payload.max_iter,
    )
    return AutoLayoutResponse(overrides=overrides)


@router.get("/api/chart_sessions/{session_id}/render.svg")
async def render_svg(
    request: Request,
    session_id: str,
    frame_id: str | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_layer_order: str | None = None,
    design_sign_glyph_scale: float | None = None,
    design_planet_glyph_scale: float | None = None,
    design_inner_ring_scale: float | None = None,
    design_background_image_scale: float | None = None,
    design_background_image_dx: float | None = None,
    design_background_image_dy: float | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    if frame_id is None:
        if chart_record.default_frame_id:
            frame_id = chart_record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    adapter = _session_storage(request, session_id)
    design_override = _design_override_from_query(
        design_layer_order,
        design_sign_glyph_scale,
        design_planet_glyph_scale,
        design_inner_ring_scale,
        design_background_image_scale,
        design_background_image_dx,
        design_background_image_dy,
    )
    result = await render_chart_svg(
        adapter,
        chart_record,
        frame_id,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        design_override=design_override,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render_chart.svg")
async def render_chart_only_svg_endpoint(
    request: Request,
    session_id: str,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_layer_order: str | None = None,
    design_sign_glyph_scale: float | None = None,
    design_planet_glyph_scale: float | None = None,
    design_inner_ring_scale: float | None = None,
    design_background_image_scale: float | None = None,
    design_background_image_dx: float | None = None,
    design_background_image_dy: float | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    adapter = _session_storage(request, session_id)
    design_override = _design_override_from_query(
        design_layer_order,
        design_sign_glyph_scale,
        design_planet_glyph_scale,
        design_inner_ring_scale,
        design_background_image_scale,
        design_background_image_dx,
        design_background_image_dy,
    )
    result = await render_chart_only_svg(
        adapter,
        chart_record,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        design_override=design_override,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render.png")
async def render_png(
    request: Request,
    session_id: str,
    frame_id: str | None = None,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_layer_order: str | None = None,
    design_sign_glyph_scale: float | None = None,
    design_planet_glyph_scale: float | None = None,
    design_inner_ring_scale: float | None = None,
    design_background_image_scale: float | None = None,
    design_background_image_dx: float | None = None,
    design_background_image_dy: float | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    if frame_id is None:
        if chart_record.default_frame_id:
            frame_id = chart_record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    adapter = _session_storage(request, session_id)
    design_override = _design_override_from_query(
        design_layer_order,
        design_sign_glyph_scale,
        design_planet_glyph_scale,
        design_inner_ring_scale,
        design_background_image_scale,
        design_background_image_dx,
        design_background_image_dy,
    )
    png_bytes = await render_chart_png(
        adapter,
        chart_record,
        frame_id,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        design_override=design_override,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render_chart.png")
async def render_chart_only_png_endpoint(
    request: Request,
    session_id: str,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_layer_order: str | None = None,
    design_sign_glyph_scale: float | None = None,
    design_planet_glyph_scale: float | None = None,
    design_inner_ring_scale: float | None = None,
    design_background_image_scale: float | None = None,
    design_background_image_dx: float | None = None,
    design_background_image_dy: float | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    adapter = _session_storage(request, session_id)
    design_override = _design_override_from_query(
        design_layer_order,
        design_sign_glyph_scale,
        design_planet_glyph_scale,
        design_inner_ring_scale,
        design_background_image_scale,
        design_background_image_dx,
        design_background_image_dy,
    )
    png_bytes = await render_chart_only_png(
        adapter,
        chart_record,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        design_override=design_override,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render_export.svg")
async def render_export_svg(
    request: Request,
    session_id: str,
    frame_id: str | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    if frame_id is None:
        if chart_record.default_frame_id:
            frame_id = chart_record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    adapter = _session_storage(request, session_id)
    result = await render_chart_svg(
        adapter,
        chart_record,
        frame_id,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render_export.png")
async def render_export_png(
    request: Request,
    session_id: str,
    frame_id: str | None = None,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    if frame_id is None:
        if chart_record.default_frame_id:
            frame_id = chart_record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    adapter = _session_storage(request, session_id)
    png_bytes = await render_chart_png(
        adapter,
        chart_record,
        frame_id,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render_export_chart.svg")
async def render_export_chart_only_svg(
    request: Request,
    session_id: str,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    adapter = _session_storage(request, session_id)
    result = await render_chart_only_svg(
        adapter,
        chart_record,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/chart_sessions/{session_id}/render_export_chart.png")
async def render_export_chart_only_png(
    request: Request,
    session_id: str,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user=Depends(optional_user),
) -> Response:
    validate_session_id(session_id)
    validate_glyph_outline_color(glyph_outline_color)
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    session = await _load_session_for_user(request, session_id, user)
    chart_record = session_to_chart_record(session)
    adapter = _session_storage(request, session_id)
    png_bytes = await render_chart_only_png(
        adapter,
        chart_record,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)
