"""Rendering helpers for the API layer."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

import cairosvg
from PIL import Image

from zodiac_art.api.storage import ChartRecord
from zodiac_art.astro.chart_builder import build_chart
from zodiac_art.astro.ephemeris import calculate_ephemeris
from zodiac_art.compositor.compositor import compose_svg
from zodiac_art.config import load_config
from zodiac_art.frames.frame_loader import FrameAsset, FrameMeta
from zodiac_art.frames.validation import validate_meta
from zodiac_art.geo.timezone import to_utc_iso
from zodiac_art.renderer.geometry import longitude_to_angle, polar_offset_to_xy, polar_to_cartesian
from zodiac_art.renderer.svg_chart import (
    ChartFit,
    ElementOverride,
    FrameCircle,
    RenderSettings,
    SvgChartRenderer,
)


@dataclass(frozen=True)
class RenderResult:
    """Rendered chart output."""

    svg: str
    width: int
    height: int


@dataclass(frozen=True)
class AutoLayoutElement:
    element_id: str
    theta_deg: float
    base_x: float
    base_y: float
    width: float
    height: float


def _merge_dicts(base: dict, override: dict | None) -> dict:
    if override is None:
        return base
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_dicts(merged[key], value)
        else:
            merged[key] = value
    return merged


def _build_settings(meta, font_scale: float = 1.0) -> RenderSettings:
    if meta.ring_outer <= 0:
        raise ValueError("Frame ring outer radius must be positive.")
    config = load_config()
    inner_ratio = meta.ring_inner / meta.ring_outer
    return RenderSettings(
        width=meta.canvas_width,
        height=meta.canvas_height,
        center_x=meta.chart_center_x,
        center_y=meta.chart_center_y,
        radius=meta.ring_outer,
        sign_ring_inner_ratio=inner_ratio,
        sign_ring_outer_ratio=1.0,
        planet_ring_ratio=config.planet_ring_ratio,
        label_ring_ratio=config.label_ring_ratio,
        planet_label_offset_ratio=config.planet_label_offset_ratio,
        font_scale=font_scale,
    )


def _chart_only_radius() -> float:
    config = load_config()
    return min(config.canvas_width, config.canvas_height) * 0.4


CHART_ONLY_MIN_CANVAS = 4096
CHART_ONLY_FONT_BASE_RADIUS = 465.0


def _chart_only_canvas_size(radius: float, scale: float) -> int:
    config = load_config()
    label_extent = max(
        1.0,
        config.label_ring_ratio + config.planet_label_offset_ratio,
    )
    padding_ratio = max(1.2, label_extent + 0.2)
    size = 2 * radius * padding_ratio * scale
    return int(math.ceil(max(size, CHART_ONLY_MIN_CANVAS)))


def _chart_only_meta(chart_fit: dict | None) -> FrameMeta:
    config = load_config()
    scale = 1.0
    if chart_fit and isinstance(chart_fit, dict):
        scale_value = chart_fit.get("scale", 1.0)
        if isinstance(scale_value, (int, float)) and scale_value > 0:
            scale = float(scale_value)
    radius = _chart_only_radius()
    canvas_size = _chart_only_canvas_size(radius, scale)
    center = canvas_size / 2
    meta = {
        "canvas": {"width": canvas_size, "height": canvas_size},
        "chart": {
            "center": {"x": center, "y": center},
            "ring_outer": radius,
            "ring_inner": radius * config.sign_ring_inner_ratio,
            "rotation_deg": 0,
        },
    }
    return validate_meta(meta, (canvas_size, canvas_size))


def chart_only_meta_payload(chart_fit: dict | None) -> dict:
    meta = _chart_only_meta(chart_fit)
    payload = {
        "canvas": {"width": meta.canvas_width, "height": meta.canvas_height},
        "chart": {
            "center": {"x": meta.chart_center_x, "y": meta.chart_center_y},
            "ring_outer": meta.ring_outer,
            "ring_inner": meta.ring_inner,
            "rotation_deg": meta.rotation_deg,
        },
    }
    if chart_fit:
        payload["chart_fit"] = chart_fit
    return payload


def _overrides_from_layout(layout: dict | None) -> dict[str, ElementOverride]:
    overrides: dict[str, ElementOverride] = {}
    if not layout:
        return overrides
    for key, value in layout.get("overrides", {}).items():
        if not isinstance(value, dict):
            continue
        overrides[key] = ElementOverride(
            dx=value.get("dx", 0.0),
            dy=value.get("dy", 0.0),
            dr=value.get("dr"),
            dt=value.get("dt"),
            color=value.get("color"),
        )
    return overrides


def _frame_circle_from_layout(
    layout: dict | None,
    image_size: tuple[int, int],
) -> FrameCircle | None:
    if not layout:
        return None
    raw = layout.get("frame_circle")
    if not isinstance(raw, dict):
        return None
    cx_norm = raw.get("cxNorm")
    cy_norm = raw.get("cyNorm")
    r_norm = raw.get("rNorm")
    if not isinstance(cx_norm, (int, float)):
        return None
    if not isinstance(cy_norm, (int, float)):
        return None
    if not isinstance(r_norm, (int, float)):
        return None
    width, height = image_size
    return FrameCircle(
        cx=cx_norm * width,
        cy=cy_norm * height,
        r=r_norm * width,
    )


def _chart_fit_from_payload(chart_fit: dict | None) -> ChartFit:
    if not chart_fit or not isinstance(chart_fit, dict):
        return ChartFit(dx=0.0, dy=0.0, scale=1.0, rotation_deg=0.0)
    dx = chart_fit.get("dx", 0.0)
    dy = chart_fit.get("dy", 0.0)
    scale = chart_fit.get("scale", 1.0)
    rotation = chart_fit.get("rotation_deg", 0.0)
    if not isinstance(dx, (int, float)):
        dx = 0.0
    if not isinstance(dy, (int, float)):
        dy = 0.0
    if not isinstance(scale, (int, float)) or scale <= 0:
        scale = 1.0
    if not isinstance(rotation, (int, float)):
        rotation = 0.0
    return ChartFit(
        dx=float(dx),
        dy=float(dy),
        scale=float(scale),
        rotation_deg=float(rotation),
    )


def _build_chart(record: ChartRecord):
    if record.birth_datetime_utc:
        dt = datetime.fromisoformat(record.birth_datetime_utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    elif record.timezone:
        try:
            utc_iso = to_utc_iso(record.birth_date, record.birth_time, record.timezone)
            dt = datetime.fromisoformat(utc_iso)
        except ValueError:
            birth_datetime = f"{record.birth_date} {record.birth_time}"
            dt = datetime.strptime(birth_datetime, "%Y-%m-%d %H:%M")
    else:
        birth_datetime = f"{record.birth_date} {record.birth_time}"
        dt = datetime.strptime(birth_datetime, "%Y-%m-%d %H:%M")
    ephemeris = calculate_ephemeris(dt, record.latitude, record.longitude)
    return build_chart(
        ephemeris.planet_longitudes,
        ephemeris.house_cusps,
        ephemeris.ascendant,
        ephemeris.midheaven,
    )


async def render_chart_svg(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
) -> RenderResult:
    template_meta = await storage.load_template_meta(frame_id)
    override_meta = await storage.load_chart_meta(chart.chart_id, frame_id)
    merged_meta = _merge_dicts(template_meta, override_meta)

    image_path = await storage.template_image_path(frame_id)
    with Image.open(image_path) as image:
        image_size = image.size
    meta = validate_meta(merged_meta, image_size)

    layout = await storage.load_chart_layout(chart.chart_id, frame_id) or {"overrides": {}}
    overrides = _overrides_from_layout(layout)
    frame_circle = _frame_circle_from_layout(layout, image_size)

    chart_fit = ChartFit(
        dx=meta.chart_fit_dx,
        dy=meta.chart_fit_dy,
        scale=meta.chart_fit_scale,
        rotation_deg=meta.chart_fit_rotation_deg,
    )

    settings = _build_settings(meta)
    renderer = SvgChartRenderer(settings)
    chart_svg = renderer.render(
        _build_chart(chart),
        global_transform=chart_fit,
        overrides=overrides,
        frame_circle=frame_circle,
    )
    metadata_path = await storage.template_meta_path(frame_id)
    frame_asset = FrameAsset(
        frame_id=frame_id,
        frame_dir=image_path.parent,
        image_path=image_path,
        metadata_path=metadata_path,
        meta=meta,
        image=None,
    )
    final_svg = compose_svg(chart_svg, frame_asset)
    return RenderResult(svg=final_svg, width=meta.canvas_width, height=meta.canvas_height)


async def render_chart_only_svg(
    storage: StorageProtocol,
    chart: ChartRecord,
) -> RenderResult:
    chart_fit_payload = await storage.load_chart_fit(chart.chart_id)
    layout = await storage.load_chart_layout_base(chart.chart_id) or {"overrides": {}}
    meta = _chart_only_meta(chart_fit_payload)
    font_scale = max(0.1, meta.ring_outer / CHART_ONLY_FONT_BASE_RADIUS)
    settings = _build_settings(meta, font_scale=font_scale)
    renderer = SvgChartRenderer(settings)
    overrides = _overrides_from_layout(layout)
    chart_fit = _chart_fit_from_payload(chart_fit_payload)
    chart_svg = renderer.render(
        _build_chart(chart),
        global_transform=chart_fit,
        overrides=overrides,
    )
    return RenderResult(svg=chart_svg, width=meta.canvas_width, height=meta.canvas_height)


def _bbox_for_element(
    element: AutoLayoutElement,
    dr: float,
    dt: float,
    min_gap_px: float,
) -> tuple[float, float, float, float]:
    dx, dy = polar_offset_to_xy(dr, dt, element.theta_deg)
    x = element.base_x + dx
    y = element.base_y + dy
    half_w = element.width / 2 + min_gap_px / 2
    half_h = element.height / 2 + min_gap_px / 2
    return (x - half_w, y - half_h, x + half_w, y + half_h)


def _overlaps(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return not (a[2] <= b[0] or a[0] >= b[2] or a[3] <= b[1] or a[1] >= b[3])


async def compute_auto_layout_overrides(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
    min_gap_px: int = 10,
    max_iter: int = 200,
) -> dict[str, dict[str, float]]:
    template_meta = await storage.load_template_meta(frame_id)
    override_meta = await storage.load_chart_meta(chart.chart_id, frame_id)
    merged_meta = _merge_dicts(template_meta, override_meta)

    image_path = await storage.template_image_path(frame_id)
    with Image.open(image_path) as image:
        image_size = image.size
    meta = validate_meta(merged_meta, image_size)

    settings = _build_settings(meta)
    chart_data = _build_chart(chart)

    elements: list[AutoLayoutElement] = []
    for planet in chart_data.planets:
        angle = longitude_to_angle(planet.longitude)
        glyph_pos = polar_to_cartesian(
            meta.chart_center_x,
            meta.chart_center_y,
            settings.radius * settings.planet_ring_ratio,
            angle,
        )
        glyph_font = 60.0
        glyph_width = glyph_font * 1.0
        glyph_height = glyph_font * 1.0
        elements.append(
            AutoLayoutElement(
                element_id=f"planet.{planet.name}.glyph",
                theta_deg=angle,
                base_x=glyph_pos[0],
                base_y=glyph_pos[1],
                width=glyph_width,
                height=glyph_height,
            )
        )

    elements = sorted(elements, key=lambda item: (item.theta_deg, item.element_id))

    accepted: list[tuple[float, float, float, float]] = []
    overrides: dict[str, dict[str, float]] = {}
    dt_step = 5.0
    dt_max = 90.0
    dr_step = 6.0
    dr_min = -40.0
    dr_max = 40.0

    for element in elements:
        dr = 0.0
        dt = 0.0
        attempts = 0
        t_index = 0
        placed = False
        dr_direction = -1.0
        while attempts < max_iter:
            bbox = _bbox_for_element(element, dr, dt, min_gap_px)
            if not any(_overlaps(bbox, other) for other in accepted):
                accepted.append(bbox)
                if dr != 0.0 or dt != 0.0:
                    overrides[element.element_id] = {"dr": dr, "dt": dt}
                placed = True
                break
            attempts += 1
            t_index += 1
            direction = 1 if t_index % 2 == 1 else -1
            multiplier = (t_index + 1) // 2
            dt = direction * multiplier * dt_step
            if abs(dt) > dt_max:
                dt = 0.0
                t_index = 0
                dr += dr_direction * dr_step
                if dr_direction < 0 and dr <= dr_min:
                    dr_direction = 1.0
                    dr = dr_step
                elif dr_direction > 0 and dr >= dr_max:
                    break
        if not placed:
            bbox = _bbox_for_element(element, dr, dt, min_gap_px)
            accepted.append(bbox)
            if dr != 0.0 or dt != 0.0:
                overrides[element.element_id] = {"dr": dr, "dt": dt}

    return overrides


async def render_chart_png(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
    max_size: int | None = None,
) -> bytes:
    result = await render_chart_svg(storage, chart, frame_id)
    output_width = None
    output_height = None
    if max_size:
        if result.width >= result.height:
            output_width = max_size
            output_height = int(result.height * (max_size / result.width))
        else:
            output_height = max_size
            output_width = int(result.width * (max_size / result.height))
    png_bytes = cairosvg.svg2png(
        bytestring=result.svg.encode("utf-8"),
        output_width=output_width,
        output_height=output_height,
    )
    if png_bytes is None:
        raise RuntimeError("Failed to render PNG output.")
    return png_bytes


async def render_chart_only_png(
    storage: StorageProtocol,
    chart: ChartRecord,
    max_size: int | None = None,
) -> bytes:
    result = await render_chart_only_svg(storage, chart)
    output_width = None
    output_height = None
    if max_size:
        if result.width >= result.height:
            output_width = max_size
            output_height = int(result.height * (max_size / result.width))
        else:
            output_height = max_size
            output_width = int(result.width * (max_size / result.height))
    png_bytes = cairosvg.svg2png(
        bytestring=result.svg.encode("utf-8"),
        output_width=output_width,
        output_height=output_height,
    )
    if png_bytes is None:
        raise RuntimeError("Failed to render PNG output.")
    return png_bytes


class StorageProtocol(Protocol):
    async def load_template_meta(self, frame_id: str) -> dict: ...
    async def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None: ...
    async def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None: ...
    async def load_chart_fit(self, chart_id: str) -> dict | None: ...
    async def load_chart_layout_base(self, chart_id: str) -> dict | None: ...
    async def template_image_path(self, frame_id: str) -> Path: ...
    async def template_meta_path(self, frame_id: str) -> Path: ...
