"""Request validation helpers."""

from __future__ import annotations

import logging
import re

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def validate_chart_id(chart_id: str) -> None:
    from uuid import UUID

    try:
        UUID(chart_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid chart id") from exc


def validate_session_id(session_id: str) -> None:
    from uuid import UUID

    try:
        UUID(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid session id") from exc


def validate_chart_fit_payload(payload: dict) -> dict:
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


_REQUIRED_DESIGN_LAYERS = {"background", "frame", "chart"}


def normalize_design_settings(design: dict | None) -> dict | None:
    if design is None:
        return None
    if not isinstance(design, dict):
        raise HTTPException(status_code=400, detail="design must be an object")
    normalized: dict[str, object] = {}
    layer_order = design.get("layer_order")
    if layer_order is not None:
        if not isinstance(layer_order, list) or not all(isinstance(v, str) for v in layer_order):
            raise HTTPException(
                status_code=400, detail="design.layer_order must be a list of strings"
            )
        normalized_order: list[str] = []
        seen: set[str] = set()
        for layer in layer_order:
            if layer in seen:
                continue
            seen.add(layer)
            normalized_order.append(layer)
        for required in ("background", "frame", "chart"):
            if required not in seen:
                normalized_order.append(required)
                seen.add(required)
        normalized["layer_order"] = normalized_order
    for key in ("sign_glyph_scale", "planet_glyph_scale", "inner_ring_scale"):
        if key not in design:
            continue
        value = design.get(key)
        if not isinstance(value, (int, float)) or value <= 0:
            raise HTTPException(status_code=400, detail=f"design.{key} must be a positive number")
        normalized[key] = float(value)
    for key in ("background_image_scale",):
        if key not in design:
            continue
        value = design.get(key)
        if not isinstance(value, (int, float)) or value <= 0:
            raise HTTPException(status_code=400, detail=f"design.{key} must be a positive number")
        normalized[key] = float(value)
    for key in ("background_image_dx", "background_image_dy"):
        if key not in design:
            continue
        value = design.get(key)
        if not isinstance(value, (int, float)):
            raise HTTPException(status_code=400, detail=f"design.{key} must be a number")
        normalized[key] = float(value)
    layer_opacity = design.get("layer_opacity")
    if layer_opacity is not None:
        if not isinstance(layer_opacity, dict):
            raise HTTPException(status_code=400, detail="design.layer_opacity must be an object")
        normalized_opacity: dict[str, float] = {}
        for key, value in layer_opacity.items():
            if not isinstance(key, str):
                raise HTTPException(
                    status_code=400, detail="design.layer_opacity keys must be strings"
                )
            if not isinstance(value, (int, float)) or not 0 <= float(value) <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="design.layer_opacity values must be between 0 and 1",
                )
            normalized_opacity[key] = float(value)
        normalized["layer_opacity"] = normalized_opacity
    background_image_path = design.get("background_image_path")
    if background_image_path is not None:
        if not isinstance(background_image_path, str):
            raise HTTPException(
                status_code=400, detail="design.background_image_path must be a string"
            )
        normalized["background_image_path"] = background_image_path.strip() or None
    return normalized


def validate_layout_payload(payload: dict) -> dict:
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
    chart_fit = payload.get("chart_fit")
    if chart_fit is not None:
        if not isinstance(chart_fit, dict):
            raise HTTPException(status_code=400, detail="chart_fit must be an object")
        result["chart_fit"] = validate_chart_fit_payload(chart_fit)
    design = normalize_design_settings(payload.get("design"))
    if design:
        result["design"] = design
    if normalized_circle is not None:
        result["frame_circle"] = normalized_circle
    occluders = payload.get("chart_occluders")
    if occluders is not None:
        result["chart_occluders"] = _normalize_chart_occluders(occluders)
    return result


def ensure_layout_version(layout: dict, context: str) -> dict:
    if not isinstance(layout, dict):
        return layout
    if "version" in layout:
        return layout
    logger.warning("Layout missing version (%s)", context)
    return {"version": 1, **layout}


def validate_glyph_outline_color(color: str | None) -> None:
    if not color:
        return
    if not isinstance(color, str):
        raise HTTPException(status_code=400, detail="glyph_outline_color must be a string")
    if not re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", color):
        raise HTTPException(status_code=400, detail="Invalid glyph_outline_color format")


def _normalize_chart_occluders(raw: object) -> list[dict]:
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="chart_occluders must be a list")
    normalized: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="chart_occluders entries must be objects")
        occluder_id = item.get("id")
        shape = item.get("shape")
        if not isinstance(occluder_id, str) or not occluder_id.strip():
            raise HTTPException(status_code=400, detail="chart_occluders.id must be a string")
        if shape not in {"ellipse", "rect"}:
            raise HTTPException(
                status_code=400, detail="chart_occluders.shape must be ellipse or rect"
            )
        rotation = item.get("rotation_deg")
        rotation_value = 0.0
        if rotation is not None:
            if not isinstance(rotation, (int, float)):
                raise HTTPException(
                    status_code=400,
                    detail="chart_occluders.rotation_deg must be a number",
                )
            rotation_value = float(rotation)
        if shape == "ellipse":
            cx = item.get("cx")
            cy = item.get("cy")
            rx = item.get("rx")
            ry = item.get("ry")
            if not isinstance(cx, (int, float)) or not isinstance(cy, (int, float)):
                raise HTTPException(status_code=400, detail="chart_occluders.cx/cy must be numbers")
            if not isinstance(rx, (int, float)) or not isinstance(ry, (int, float)):
                raise HTTPException(status_code=400, detail="chart_occluders.rx/ry must be numbers")
            if rx <= 0 or ry <= 0:
                raise HTTPException(
                    status_code=400, detail="chart_occluders.rx/ry must be positive"
                )
            normalized.append(
                {
                    "id": occluder_id,
                    "shape": "ellipse",
                    "cx": float(cx),
                    "cy": float(cy),
                    "rx": float(rx),
                    "ry": float(ry),
                    "rotation_deg": rotation_value,
                }
            )
            continue
        x = item.get("x")
        y = item.get("y")
        width = item.get("width")
        height = item.get("height")
        if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            raise HTTPException(status_code=400, detail="chart_occluders.x/y must be numbers")
        if not isinstance(width, (int, float)) or not isinstance(height, (int, float)):
            raise HTTPException(
                status_code=400, detail="chart_occluders.width/height must be numbers"
            )
        if width <= 0 or height <= 0:
            raise HTTPException(
                status_code=400, detail="chart_occluders.width/height must be positive"
            )
        normalized.append(
            {
                "id": occluder_id,
                "shape": "rect",
                "x": float(x),
                "y": float(y),
                "width": float(width),
                "height": float(height),
                "rotation_deg": rotation_value,
            }
        )
    return normalized
