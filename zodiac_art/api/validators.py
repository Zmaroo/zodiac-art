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
    if normalized_circle is not None:
        result["frame_circle"] = normalized_circle
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
