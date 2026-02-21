"""Render routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from zodiac_art.api.auth import AuthUser
from zodiac_art.api.deps import frame_exists, get_storage, load_chart_for_user, require_user
from zodiac_art.api.http_cache import compute_etag, etag_matches, render_cache_headers
from zodiac_art.api.rendering import (
    render_chart_only_png,
    render_chart_only_svg,
    render_chart_png,
    render_chart_svg,
)
from zodiac_art.api.validators import validate_chart_id, validate_glyph_outline_color

router = APIRouter()


@router.get("/api/charts/{chart_id}/render.svg")
async def render_svg(
    request: Request,
    chart_id: str,
    frame_id: str | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    result = await render_chart_svg(
        get_storage(request),
        record,
        frame_id,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/charts/{chart_id}/render_chart.svg")
async def render_chart_only_svg_endpoint(
    request: Request,
    chart_id: str,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    result = await render_chart_only_svg(
        get_storage(request),
        record,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/charts/{chart_id}/render.png")
async def render_png(
    request: Request,
    chart_id: str,
    frame_id: str | None = None,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    png_bytes = await render_chart_png(
        get_storage(request),
        record,
        frame_id,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/api/charts/{chart_id}/render_chart.png")
async def render_chart_only_png_endpoint(
    request: Request,
    chart_id: str,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    png_bytes = await render_chart_only_png(
        get_storage(request),
        record,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("interactive", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/api/charts/{chart_id}/render_export.svg")
async def render_export_svg(
    request: Request,
    chart_id: str,
    frame_id: str | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    result = await render_chart_svg(
        get_storage(request),
        record,
        frame_id,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/charts/{chart_id}/render_export.png")
async def render_export_png(
    request: Request,
    chart_id: str,
    frame_id: str | None = None,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    if frame_id is None:
        if record.default_frame_id:
            frame_id = record.default_frame_id
        else:
            raise HTTPException(status_code=400, detail="frame_id is required")
    assert frame_id is not None
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    png_bytes = await render_chart_png(
        get_storage(request),
        record,
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


@router.get("/api/charts/{chart_id}/render_export_chart.svg")
async def render_export_chart_only_svg(
    request: Request,
    chart_id: str,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    record = await load_chart_for_user(request, chart_id, user.user_id)
    result = await render_chart_only_svg(
        get_storage(request),
        record,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(result.svg)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=result.svg, media_type="image/svg+xml", headers=headers)


@router.get("/api/charts/{chart_id}/render_export_chart.png")
async def render_export_chart_only_png(
    request: Request,
    chart_id: str,
    size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    user: AuthUser = Depends(require_user),
) -> Response:
    validate_chart_id(chart_id)
    validate_glyph_outline_color(glyph_outline_color)
    if size is not None and size <= 0:
        raise HTTPException(status_code=400, detail="size must be positive")
    record = await load_chart_for_user(request, chart_id, user.user_id)
    png_bytes = await render_chart_only_png(
        get_storage(request),
        record,
        max_size=size,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    etag = compute_etag(png_bytes)
    headers = render_cache_headers("saved", etag)
    if etag_matches(request, etag):
        return Response(status_code=304, headers=headers)
    return Response(content=png_bytes, media_type="image/png", headers=headers)
