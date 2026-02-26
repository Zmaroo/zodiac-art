"""Dev-only API endpoints for automated testing."""

from __future__ import annotations

import os
import shutil
import time
from typing import Any, cast

from fastapi import APIRouter, Body, Depends, HTTPException, Request

from zodiac_art.api.deps import frame_exists, get_storage, load_chart_for_user, require_user
from zodiac_art.api.validators import validate_chart_fit_payload, validate_layout_payload
from zodiac_art.frames.validation import validate_meta

router = APIRouter()


def _require_dev_tools() -> None:
    value = os.environ.get("ZODIAC_DEV_TOOLS", "0").strip().lower()
    if value not in {"1", "true", "yes", "on"}:
        raise HTTPException(status_code=404, detail="Not found")


def _load_layout_or_default(layout: dict | None) -> dict:
    if not isinstance(layout, dict):
        return {"version": 1, "overrides": {}}
    if "version" not in layout:
        return {"version": 1, **layout}
    return dict(layout)


def _resolve_chart_fit(layout: dict, meta: dict | None) -> dict[str, float]:
    if isinstance(layout.get("chart_fit"), dict):
        return validate_chart_fit_payload(layout["chart_fit"])
    if isinstance(meta, dict) and isinstance(meta.get("chart_fit"), dict):
        return validate_chart_fit_payload(meta["chart_fit"])
    return {"dx": 0.0, "dy": 0.0, "scale": 1.0, "rotation_deg": 0.0}


def _chart_record_to_payload(record: Any) -> dict:
    return {
        "name": record.name,
        "birth_date": record.birth_date,
        "birth_time": record.birth_time,
        "latitude": record.latitude,
        "longitude": record.longitude,
        "default_frame_id": record.default_frame_id,
        "birth_place_text": record.birth_place_text,
        "birth_place_id": record.birth_place_id,
        "timezone": record.timezone,
        "birth_datetime_utc": record.birth_datetime_utc,
    }


async def _delete_chart_files(storage: Any, chart_id: str) -> None:
    target_storage = getattr(storage, "_storage", storage)
    chart_dir = target_storage._chart_dir(chart_id)
    if chart_dir.exists():
        shutil.rmtree(chart_dir)


@router.get("/api/dev/tools/layout")
async def dev_get_layout(
    request: Request,
    chart_id: str,
    frame_id: str,
    user=Depends(require_user),
) -> dict[str, Any]:
    _require_dev_tools()
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    storage = get_storage(request)
    layout = await storage.load_chart_layout(chart_id, frame_id)
    meta = await storage.load_chart_meta(chart_id, frame_id)
    return {
        "layout": layout,
        "meta": meta,
    }


@router.post("/api/dev/tools/chart-fit")
async def dev_set_chart_fit(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    if not isinstance(chart_id, str) or not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="chart_id and frame_id are required")
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    storage = get_storage(request)
    chart_fit = validate_chart_fit_payload(payload.get("chart_fit", {}))
    layout = _load_layout_or_default(await storage.load_chart_layout(chart_id, frame_id))
    layout["chart_fit"] = chart_fit
    validated_layout = validate_layout_payload(layout)
    await storage.save_chart_layout(chart_id, frame_id, validated_layout)
    meta = await storage.load_chart_meta(chart_id, frame_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Metadata not found")
    image_path = await storage.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    meta_payload = dict(meta)
    meta_payload["chart_fit"] = chart_fit
    validate_meta(meta_payload, image_size)
    await storage.save_chart_meta(chart_id, frame_id, meta_payload)
    return {"status": "ok", "chart_fit": chart_fit}


@router.post("/api/dev/tools/chart-fit/nudge")
async def dev_nudge_chart_fit(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    if not isinstance(chart_id, str) or not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="chart_id and frame_id are required")
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    storage = get_storage(request)
    layout = _load_layout_or_default(await storage.load_chart_layout(chart_id, frame_id))
    meta = await storage.load_chart_meta(chart_id, frame_id)
    current = _resolve_chart_fit(layout, meta)
    dx = payload.get("dx", 0.0)
    dy = payload.get("dy", 0.0)
    scale_delta = payload.get("scale_delta", 0.0)
    scale_mult = payload.get("scale_mult", 1.0)
    rotation_delta = payload.get("rotation_delta", 0.0)
    if not isinstance(dx, (int, float)) or not isinstance(dy, (int, float)):
        raise HTTPException(status_code=400, detail="dx/dy must be numbers")
    if not isinstance(scale_delta, (int, float)) or not isinstance(scale_mult, (int, float)):
        raise HTTPException(status_code=400, detail="scale values must be numbers")
    if not isinstance(rotation_delta, (int, float)):
        raise HTTPException(status_code=400, detail="rotation_delta must be a number")
    next_fit = {
        "dx": float(current["dx"]) + float(dx),
        "dy": float(current["dy"]) + float(dy),
        "scale": max(0.001, float(current["scale"]) * float(scale_mult) + float(scale_delta)),
        "rotation_deg": float(current["rotation_deg"]) + float(rotation_delta),
    }
    layout["chart_fit"] = next_fit
    validated_layout = validate_layout_payload(layout)
    await storage.save_chart_layout(chart_id, frame_id, validated_layout)
    meta = await storage.load_chart_meta(chart_id, frame_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="Metadata not found")
    image_path = await storage.template_image_path(frame_id)
    from PIL import Image

    with Image.open(image_path) as image:
        image_size = image.size
    meta_payload = dict(meta)
    meta_payload["chart_fit"] = next_fit
    validate_meta(meta_payload, image_size)
    await storage.save_chart_meta(chart_id, frame_id, meta_payload)
    return {"status": "ok", "chart_fit": next_fit}


@router.post("/api/dev/tools/frame-mask")
async def dev_set_frame_mask(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    if not isinstance(chart_id, str) or not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="chart_id and frame_id are required")
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    cx_norm_raw = payload.get("cx_norm")
    cy_norm_raw = payload.get("cy_norm")
    rx_norm_raw = payload.get("rx_norm")
    ry_norm_raw = payload.get("ry_norm")
    if not all(
        isinstance(value, (int, float))
        for value in (cx_norm_raw, cy_norm_raw, rx_norm_raw, ry_norm_raw)
    ):
        raise HTTPException(status_code=400, detail="frame mask values must be numbers")
    cx_norm = float(cast(float, cx_norm_raw))
    cy_norm = float(cast(float, cy_norm_raw))
    rx_norm = float(cast(float, rx_norm_raw))
    ry_norm = float(cast(float, ry_norm_raw))
    circle = {
        "cxNorm": cx_norm,
        "cyNorm": cy_norm,
        "rxNorm": rx_norm,
        "ryNorm": ry_norm,
    }
    layout = _load_layout_or_default(
        await get_storage(request).load_chart_layout(chart_id, frame_id)
    )
    layout["frame_circle"] = circle
    validated_layout = validate_layout_payload(layout)
    await get_storage(request).save_chart_layout(chart_id, frame_id, validated_layout)
    return {"status": "ok", "frame_circle": validated_layout.get("frame_circle")}


@router.post("/api/dev/tools/frame-mask/nudge")
async def dev_nudge_frame_mask(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    if not isinstance(chart_id, str) or not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="chart_id and frame_id are required")
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    storage = get_storage(request)
    layout = _load_layout_or_default(await storage.load_chart_layout(chart_id, frame_id))
    current = layout.get("frame_circle") if isinstance(layout.get("frame_circle"), dict) else None
    if not current:
        current = {"cxNorm": 0.5, "cyNorm": 0.5, "rxNorm": 0.2, "ryNorm": 0.2}
    dx = payload.get("cx_norm_delta", 0.0)
    dy = payload.get("cy_norm_delta", 0.0)
    drx = payload.get("rx_norm_delta", 0.0)
    dry = payload.get("ry_norm_delta", 0.0)
    if not all(isinstance(value, (int, float)) for value in (dx, dy, drx, dry)):
        raise HTTPException(status_code=400, detail="frame mask deltas must be numbers")
    next_circle = {
        "cxNorm": float(current.get("cxNorm", 0.5)) + float(dx),
        "cyNorm": float(current.get("cyNorm", 0.5)) + float(dy),
        "rxNorm": max(0.001, float(current.get("rxNorm", 0.2)) + float(drx)),
        "ryNorm": max(0.001, float(current.get("ryNorm", 0.2)) + float(dry)),
    }
    layout["frame_circle"] = next_circle
    validated_layout = validate_layout_payload(layout)
    await storage.save_chart_layout(chart_id, frame_id, validated_layout)
    return {"status": "ok", "frame_circle": validated_layout.get("frame_circle")}


@router.post("/api/dev/tools/layout/update")
async def dev_update_layout(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    if not isinstance(chart_id, str) or not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="chart_id and frame_id are required")
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    storage = get_storage(request)
    layout = _load_layout_or_default(await storage.load_chart_layout(chart_id, frame_id))
    if "overrides" in payload:
        layout["overrides"] = payload.get("overrides")
    if "design" in payload:
        layout["design"] = payload.get("design")
    if "chart_fit" in payload:
        layout["chart_fit"] = payload.get("chart_fit")
    if "frame_circle" in payload:
        layout["frame_circle"] = payload.get("frame_circle")
    if "chart_occluders" in payload:
        layout["chart_occluders"] = payload.get("chart_occluders")
    validated_layout = validate_layout_payload(layout)
    await storage.save_chart_layout(chart_id, frame_id, validated_layout)
    update_meta = payload.get("update_meta")
    if update_meta and "chart_fit" in validated_layout:
        meta = await storage.load_chart_meta(chart_id, frame_id)
        if meta is None:
            raise HTTPException(status_code=404, detail="Metadata not found")
        image_path = await storage.template_image_path(frame_id)
        from PIL import Image

        with Image.open(image_path) as image:
            image_size = image.size
        meta_payload = dict(meta)
        meta_payload["chart_fit"] = validated_layout["chart_fit"]
        validate_meta(meta_payload, image_size)
        await storage.save_chart_meta(chart_id, frame_id, meta_payload)
    return {"status": "ok", "layout": validated_layout}


@router.post("/api/dev/tools/layout/reset")
async def dev_reset_layout(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    if not isinstance(chart_id, str) or not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="chart_id and frame_id are required")
    await load_chart_for_user(request, chart_id, user.user_id)
    if not await frame_exists(request, frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    clear_chart_fit = bool(payload.get("clear_chart_fit", False))
    layout = _load_layout_or_default(
        await get_storage(request).load_chart_layout(chart_id, frame_id)
    )
    layout["overrides"] = {}
    layout.pop("design", None)
    layout["chart_occluders"] = []
    layout["frame_circle"] = None
    if clear_chart_fit:
        layout.pop("chart_fit", None)
    validated_layout = validate_layout_payload(layout)
    await get_storage(request).save_chart_layout(chart_id, frame_id, validated_layout)
    return {"status": "ok", "layout": validated_layout}


@router.post("/api/dev/tools/chart/duplicate")
async def dev_duplicate_chart(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    source_chart_id = payload.get("chart_id")
    frame_id = payload.get("frame_id")
    name_suffix = payload.get("name_suffix", "copy")
    if not isinstance(source_chart_id, str):
        raise HTTPException(status_code=400, detail="chart_id is required")
    if frame_id is not None and not isinstance(frame_id, str):
        raise HTTPException(status_code=400, detail="frame_id must be a string")
    if not isinstance(name_suffix, str):
        raise HTTPException(status_code=400, detail="name_suffix must be a string")
    storage = get_storage(request)
    record = await load_chart_for_user(request, source_chart_id, user.user_id)
    payload_data = _chart_record_to_payload(record)
    payload_data["name"] = f"{payload_data.get('name') or 'chart'}-{name_suffix}"
    new_record = await storage.create_chart(user.user_id, **payload_data)
    target_frame_id = frame_id or payload_data.get("default_frame_id")
    if target_frame_id:
        if not await frame_exists(request, target_frame_id):
            raise HTTPException(status_code=404, detail="Frame not found")
        layout = await storage.load_chart_layout(source_chart_id, target_frame_id)
        if isinstance(layout, dict):
            await storage.save_chart_layout(new_record.chart_id, target_frame_id, layout)
        meta = await storage.load_chart_meta(source_chart_id, target_frame_id)
        if isinstance(meta, dict):
            await storage.save_chart_meta(new_record.chart_id, target_frame_id, meta)
    return {"status": "ok", "chart_id": new_record.chart_id}


@router.post("/api/dev/tools/chart/seed")
async def dev_seed_chart(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    name = payload.get("name") or f"dev-seed-{int(time.time())}"
    birth_date = payload.get("birth_date", "1990-04-12")
    birth_time = payload.get("birth_time", "08:45")
    latitude = payload.get("latitude", 40.7128)
    longitude = payload.get("longitude", -74.0060)
    default_frame_id = payload.get("default_frame_id")
    if not isinstance(name, str):
        raise HTTPException(status_code=400, detail="name must be a string")
    if not isinstance(birth_date, str) or not isinstance(birth_time, str):
        raise HTTPException(status_code=400, detail="birth_date and birth_time must be strings")
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        raise HTTPException(status_code=400, detail="latitude/longitude must be numbers")
    if default_frame_id is not None and not isinstance(default_frame_id, str):
        raise HTTPException(status_code=400, detail="default_frame_id must be a string")
    if default_frame_id and not await frame_exists(request, default_frame_id):
        raise HTTPException(status_code=404, detail="Frame not found")
    storage = get_storage(request)
    record = await storage.create_chart(
        user.user_id,
        name=name,
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=float(latitude),
        longitude=float(longitude),
        default_frame_id=default_frame_id,
    )
    return {"status": "ok", "chart_id": record.chart_id}


@router.post("/api/dev/tools/chart/layout/reset")
async def dev_reset_chart_layout(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    if not isinstance(chart_id, str):
        raise HTTPException(status_code=400, detail="chart_id is required")
    await load_chart_for_user(request, chart_id, user.user_id)
    storage = get_storage(request)
    db_pool = request.app.state.db_pool
    if db_pool:
        from uuid import UUID

        chart_uuid = UUID(chart_id)
        async with db_pool.acquire() as conn:
            await conn.execute(
                "UPDATE charts SET chart_fit_json = NULL, layout_json = NULL WHERE id = $1",
                chart_uuid,
            )
    else:
        target_storage = getattr(storage, "_storage", storage)
        fit_path = target_storage._chart_fit_path(chart_id)
        layout_path = target_storage._chart_layout_path(chart_id)
        if fit_path.exists():
            fit_path.unlink()
        if layout_path.exists():
            layout_path.unlink()
    return {"status": "ok"}


@router.post("/api/dev/tools/chart/delete")
async def dev_delete_chart(
    request: Request,
    payload: dict = Body(...),
    user=Depends(require_user),
) -> dict:
    _require_dev_tools()
    chart_id = payload.get("chart_id")
    if not isinstance(chart_id, str):
        raise HTTPException(status_code=400, detail="chart_id is required")
    await load_chart_for_user(request, chart_id, user.user_id)
    storage = get_storage(request)
    db_pool = request.app.state.db_pool
    if db_pool:
        from uuid import UUID

        chart_uuid = UUID(chart_id)
        async with db_pool.acquire() as conn:
            await conn.execute("DELETE FROM charts WHERE id = $1", chart_uuid)
    else:
        await _delete_chart_files(storage, chart_id)
    return {"status": "ok"}
