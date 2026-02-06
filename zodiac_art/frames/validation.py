"""Frame metadata validation utilities."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from zodiac_art.frames.frame_loader import FrameMeta


def _require_mapping(data: dict, key: str) -> dict:
    value = data.get(key)
    if not isinstance(value, dict):
        raise ValueError(f"Frame metadata missing required object '{key}'.")
    return value


def _require_number(data: dict, key: str, label: str) -> float:
    value = data.get(key)
    if not isinstance(value, (int, float)):
        raise ValueError(f"Frame metadata '{label}' must be a number.")
    return float(value)


def _require_int(data: dict, key: str, label: str) -> int:
    value = data.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"Frame metadata '{label}' must be an integer.")
    if isinstance(value, float) and not value.is_integer():
        raise ValueError(f"Frame metadata '{label}' must be a whole number.")
    return int(value)


def validate_meta(meta: dict, image_size: tuple[int, int]) -> "FrameMeta":
    """Validate metadata against schema and image size."""

    if not isinstance(meta, dict):
        raise ValueError("Frame metadata must be a JSON object.")

    canvas = _require_mapping(meta, "canvas")
    chart = _require_mapping(meta, "chart")
    center = _require_mapping(chart, "center")

    canvas_width = _require_int(canvas, "width", "canvas.width")
    canvas_height = _require_int(canvas, "height", "canvas.height")
    if canvas_width <= 0 or canvas_height <= 0:
        raise ValueError("Frame canvas dimensions must be positive.")

    center_x = _require_number(center, "x", "chart.center.x")
    center_y = _require_number(center, "y", "chart.center.y")
    ring_outer = _require_number(chart, "ring_outer", "chart.ring_outer")
    ring_inner = _require_number(chart, "ring_inner", "chart.ring_inner")
    if "rotation_deg" in chart:
        rotation_deg = _require_number(chart, "rotation_deg", "chart.rotation_deg")
    else:
        rotation_deg = 0.0

    chart_fit = meta.get("chart_fit")
    chart_fit_dx = 0.0
    chart_fit_dy = 0.0
    chart_fit_scale = 1.0
    chart_fit_rotation = 0.0
    if chart_fit is not None:
        if not isinstance(chart_fit, dict):
            raise ValueError("Frame metadata 'chart_fit' must be an object.")
        if "dx" in chart_fit:
            chart_fit_dx = _require_number(chart_fit, "dx", "chart_fit.dx")
        if "dy" in chart_fit:
            chart_fit_dy = _require_number(chart_fit, "dy", "chart_fit.dy")
        if "scale" in chart_fit:
            chart_fit_scale = _require_number(chart_fit, "scale", "chart_fit.scale")
        if "rotation_deg" in chart_fit:
            chart_fit_rotation = _require_number(
                chart_fit, "rotation_deg", "chart_fit.rotation_deg"
            )
        if chart_fit_scale <= 0:
            raise ValueError("Frame metadata chart_fit.scale must be positive.")

    if ring_outer <= 0:
        raise ValueError("Frame metadata chart.ring_outer must be positive.")
    if ring_inner <= 0:
        raise ValueError("Frame metadata chart.ring_inner must be positive.")
    if ring_inner >= ring_outer:
        raise ValueError("Frame metadata chart.ring_inner must be less than ring_outer.")

    image_width, image_height = image_size
    if canvas_width != image_width or canvas_height != image_height:
        raise ValueError(
            "Frame canvas dimensions do not match image size "
            f"({canvas_width}x{canvas_height} vs {image_width}x{image_height})."
        )

    if center_x - ring_outer < 0 or center_x + ring_outer > canvas_width:
        raise ValueError(
            "Frame metadata chart.ring_outer exceeds canvas width bounds "
            "for the provided center.x."
        )
    if center_y - ring_outer < 0 or center_y + ring_outer > canvas_height:
        raise ValueError(
            "Frame metadata chart.ring_outer exceeds canvas height bounds "
            "for the provided center.y."
        )

    from zodiac_art.frames.frame_loader import FrameMeta

    return FrameMeta(
        canvas_width=canvas_width,
        canvas_height=canvas_height,
        chart_center_x=center_x,
        chart_center_y=center_y,
        ring_outer=ring_outer,
        ring_inner=ring_inner,
        rotation_deg=rotation_deg,
        chart_fit_dx=chart_fit_dx,
        chart_fit_dy=chart_fit_dy,
        chart_fit_scale=chart_fit_scale,
        chart_fit_rotation_deg=chart_fit_rotation,
    )
