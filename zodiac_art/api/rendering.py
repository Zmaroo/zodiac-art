"""Rendering helpers for the API layer."""

from __future__ import annotations

import logging
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


logger = logging.getLogger(__name__)

_IMAGE_SIZE_CACHE: dict[str, tuple[float, tuple[int, int]]] = {}


def _build_settings(meta, config, font_scale: float = 1.0) -> RenderSettings:
    if meta.ring_outer <= 0:
        raise ValueError("Frame ring outer radius must be positive.")
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
        glyph_mode=config.glyph_mode,
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
            logger.warning("Ignoring override for %s: expected object", key)
            continue
        dx = value.get("dx", 0.0)
        dy = value.get("dy", 0.0)
        dr = value.get("dr")
        dt = value.get("dt")
        if not isinstance(dx, (int, float)) or not isinstance(dy, (int, float)):
            logger.warning("Invalid override dx/dy for %s", key)
            continue
        if dr is not None and not isinstance(dr, (int, float)):
            logger.warning("Invalid override dr for %s", key)
            dr = None
        if dt is not None and not isinstance(dt, (int, float)):
            logger.warning("Invalid override dt for %s", key)
            dt = None
        overrides[key] = ElementOverride(
            dx=float(dx),
            dy=float(dy),
            dr=float(dr) if dr is not None else None,
            dt=float(dt) if dt is not None else None,
            color=value.get("color"),
        )
    return overrides


def _get_image_size(image_path: Path) -> tuple[int, int]:
    try:
        mtime = image_path.stat().st_mtime
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Frame image not found: {image_path}") from exc
    cache_key = str(image_path)
    cached = _IMAGE_SIZE_CACHE.get(cache_key)
    if cached and cached[0] == mtime:
        return cached[1]
    with Image.open(image_path) as image:
        image_size = image.size
    _IMAGE_SIZE_CACHE[cache_key] = (mtime, image_size)
    return image_size


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
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
) -> RenderResult:
    config = load_config()
    template_meta = await storage.load_template_meta(frame_id)
    override_meta = await storage.load_chart_meta(chart.chart_id, frame_id)
    merged_meta = _merge_dicts(template_meta, override_meta)

    image_path = await storage.template_image_path(frame_id)
    image_size = _get_image_size(image_path)
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

    settings = _build_settings(meta, config)
    renderer = SvgChartRenderer(settings)
    chart_svg = renderer.render(
        _build_chart(chart),
        global_transform=chart_fit,
        overrides=overrides,
        frame_circle=frame_circle,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
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
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
) -> RenderResult:
    config = load_config()
    chart_fit_payload = await storage.load_chart_fit(chart.chart_id)
    layout = await storage.load_chart_layout_base(chart.chart_id) or {"overrides": {}}
    meta = _chart_only_meta(chart_fit_payload)
    font_scale = max(0.1, meta.ring_outer / CHART_ONLY_FONT_BASE_RADIUS)
    settings = _build_settings(meta, config, font_scale=font_scale)
    renderer = SvgChartRenderer(settings)
    overrides = _overrides_from_layout(layout)
    chart_fit = _chart_fit_from_payload(chart_fit_payload)
    chart_svg = renderer.render(
        _build_chart(chart),
        global_transform=chart_fit,
        overrides=overrides,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    return RenderResult(svg=chart_svg, width=meta.canvas_width, height=meta.canvas_height)


def _position_for_element(element: AutoLayoutElement, dr: float, dt: float) -> tuple[float, float]:
    dx, dy = polar_offset_to_xy(dr, dt, element.theta_deg)
    return element.base_x + dx, element.base_y + dy


def _overlaps_by_distance(
    element: AutoLayoutElement,
    dr: float,
    other: AutoLayoutElement,
    other_dr: float,
    min_gap_px: float,
    radius_scale: float,
) -> bool:
    x, y = _position_for_element(element, dr, 0.0)
    ox, oy = _position_for_element(other, other_dr, 0.0)
    radius = max(element.width, element.height) / 2 * radius_scale
    other_radius = max(other.width, other.height) / 2 * radius_scale
    min_distance = radius + other_radius + min_gap_px
    return math.hypot(x - ox, y - oy) < min_distance


async def compute_auto_layout_overrides(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
    min_gap_px: int = 0,
    max_iter: int = 200,
) -> dict[str, dict[str, float]]:
    config = load_config()
    template_meta = await storage.load_template_meta(frame_id)
    override_meta = await storage.load_chart_meta(chart.chart_id, frame_id)
    merged_meta = _merge_dicts(template_meta, override_meta)

    image_path = await storage.template_image_path(frame_id)
    image_size = _get_image_size(image_path)
    meta = validate_meta(merged_meta, image_size)

    settings = _build_settings(meta, config)
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
        glyph_font = 60.0 * settings.font_scale
        glyph_width = glyph_font * 0.75
        glyph_height = glyph_font * 0.75
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

    accepted: list[tuple[AutoLayoutElement, float]] = []
    overrides: dict[str, dict[str, float]] = {}
    dr_step = 6.0
    dr_min = -60.0
    strict_radius_scale = 0.42
    placement_radius_scale = 0.62

    for element in elements:
        dr = 0.0
        attempts = 0
        placed = False
        dr_index = 0
        if not any(
            _overlaps_by_distance(element, dr, other, other_dr, 0, strict_radius_scale)
            for other, other_dr in accepted
        ):
            accepted.append((element, dr))
            continue
        while attempts < max_iter:
            if not any(
                _overlaps_by_distance(
                    element,
                    dr,
                    other,
                    other_dr,
                    min_gap_px,
                    placement_radius_scale,
                )
                for other, other_dr in accepted
            ):
                accepted.append((element, dr))
                if dr != 0.0:
                    overrides[element.element_id] = {"dr": dr, "dt": 0.0}
                placed = True
                break
            attempts += 1
            dr_index += 1
            multiplier = (dr_index + 1) // 2
            dr = -multiplier * dr_step
            if dr <= dr_min:
                break
        if not placed:
            accepted.append((element, dr))
            if dr != 0.0:
                overrides[element.element_id] = {"dr": dr, "dt": 0.0}

    return overrides


async def render_chart_png(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
    max_size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
) -> bytes:
    result = await render_chart_svg(
        storage,
        chart,
        frame_id,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
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
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
) -> bytes:
    result = await render_chart_only_svg(
        storage,
        chart,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
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
