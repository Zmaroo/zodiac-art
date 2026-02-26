"""Rendering helpers for the API layer."""

from __future__ import annotations

import hashlib
import json
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
from zodiac_art.config import STORAGE_ROOT, AppConfig, load_config
from zodiac_art.frames.frame_loader import FrameAsset, FrameMeta
from zodiac_art.frames.validation import validate_meta
from zodiac_art.geo.timezone import to_utc_iso
from zodiac_art.models.chart_models import Chart
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


@dataclass(frozen=True)
class DesignSettings:
    layer_order: tuple[str, ...]
    layer_opacity: dict[str, float]
    background_image_path: str | None
    background_image_scale: float
    background_image_dx: float
    background_image_dy: float
    sign_glyph_scale: float
    planet_glyph_scale: float
    inner_ring_scale: float


@dataclass(frozen=True)
class RenderContext:
    chart: Chart
    settings: RenderSettings
    overrides: dict[str, ElementOverride]
    chart_fit: ChartFit
    frame_circle: FrameCircle | None
    meta: FrameMeta
    design: DesignSettings
    chart_occluders: list[dict] | None = None
    image_path: Path | None = None
    frame_id: str | None = None
    metadata_path: Path | None = None
    cache_key: str = ""


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


_DEFAULT_LAYER_ORDER = ("background", "frame", "chart")
_DEFAULT_LAYER_OPACITY: dict[str, float] = {}
_REQUIRED_LAYERS = {"background", "frame", "chart"}
_BACKGROUND_IMAGE_LAYER = "chart_background_image"
_DEFAULT_SIGN_GLYPH_SCALE = 1.0
_DEFAULT_PLANET_GLYPH_SCALE = 1.0
_DEFAULT_INNER_RING_SCALE = 1.0
_DEFAULT_BACKGROUND_IMAGE_SCALE = 1.0
_DEFAULT_BACKGROUND_IMAGE_DX = 0.0
_DEFAULT_BACKGROUND_IMAGE_DY = 0.0


def _design_from_layout(
    layout: dict | None,
    override: dict | None = None,
) -> DesignSettings:
    design_payload = {}
    if layout and isinstance(layout.get("design"), dict):
        design_payload = layout.get("design", {})
    merged = {**design_payload}
    if override:
        merged.update({key: value for key, value in override.items() if value is not None})
    layer_order = merged.get("layer_order")
    if not isinstance(layer_order, list) or not set(layer_order).issuperset(_REQUIRED_LAYERS):
        layer_order_list = list(map(str, _DEFAULT_LAYER_ORDER))
    else:
        seen: set[str] = set()
        layer_order_list = [str(key) for key in layer_order if not (key in seen or seen.add(key))]
    background_image_path = merged.get("background_image_path")
    if isinstance(background_image_path, str):
        background_image_path = background_image_path.strip() or None
    else:
        background_image_path = None
    if background_image_path and _BACKGROUND_IMAGE_LAYER not in layer_order_list:
        if "chart" in layer_order_list:
            chart_index = layer_order_list.index("chart")
            layer_order_list.insert(chart_index, _BACKGROUND_IMAGE_LAYER)
        else:
            layer_order_list.append(_BACKGROUND_IMAGE_LAYER)
    layer_opacity = merged.get("layer_opacity")
    if not isinstance(layer_opacity, dict):
        layer_opacity = dict(_DEFAULT_LAYER_OPACITY)
    else:
        layer_opacity = {
            str(key): float(value)
            for key, value in layer_opacity.items()
            if isinstance(key, str) and isinstance(value, (int, float))
        }
    return DesignSettings(
        layer_order=tuple(layer_order_list),
        layer_opacity=layer_opacity,
        background_image_path=background_image_path,
        background_image_scale=float(
            merged.get("background_image_scale", _DEFAULT_BACKGROUND_IMAGE_SCALE)
        ),
        background_image_dx=float(merged.get("background_image_dx", _DEFAULT_BACKGROUND_IMAGE_DX)),
        background_image_dy=float(merged.get("background_image_dy", _DEFAULT_BACKGROUND_IMAGE_DY)),
        sign_glyph_scale=float(merged.get("sign_glyph_scale", _DEFAULT_SIGN_GLYPH_SCALE)),
        planet_glyph_scale=float(merged.get("planet_glyph_scale", _DEFAULT_PLANET_GLYPH_SCALE)),
        inner_ring_scale=float(merged.get("inner_ring_scale", _DEFAULT_INNER_RING_SCALE)),
    )


def _resolve_background_image_path(background_image_path: str | None) -> Path | None:
    if not background_image_path:
        return None
    candidate = Path(background_image_path)
    if candidate.is_absolute():
        return candidate if candidate.exists() else None
    cleaned = background_image_path.lstrip("/")
    resolved = STORAGE_ROOT / cleaned
    return resolved if resolved.exists() else None


logger = logging.getLogger(__name__)

_IMAGE_SIZE_CACHE: dict[str, tuple[float, tuple[int, int]]] = {}
_SVG_CACHE: dict[str, RenderResult] = {}
_PNG_CACHE: dict[str, bytes] = {}
_CACHE_KEYS: list[str] = []
_CACHE_MAX_ENTRIES = load_config().render_cache_max


def _build_settings(
    meta, config, design: DesignSettings, font_scale: float = 1.0
) -> RenderSettings:
    if meta.ring_outer <= 0:
        raise ValueError("Frame ring outer radius must be positive.")
    inner_ratio = (meta.ring_inner / meta.ring_outer) * design.inner_ring_scale
    return RenderSettings(
        width=meta.canvas_width,
        height=meta.canvas_height,
        center_x=meta.chart_center_x,
        center_y=meta.chart_center_y,
        radius=meta.ring_outer,
        sign_ring_inner_ratio=inner_ratio,
        sign_ring_outer_ratio=1.0,
        planet_ring_ratio=config.planet_ring_ratio * design.inner_ring_scale,
        label_ring_ratio=config.label_ring_ratio,
        planet_label_offset_ratio=config.planet_label_offset_ratio,
        font_scale=font_scale,
        sign_glyph_scale=design.sign_glyph_scale,
        planet_glyph_scale=design.planet_glyph_scale,
        glyph_mode=config.glyph_mode,
    )


def _cache_set(cache: dict, key: str, value) -> None:
    if _CACHE_MAX_ENTRIES <= 0:
        return
    if key in cache:
        cache[key] = value
        return
    cache[key] = value
    _CACHE_KEYS.append(key)
    if len(_CACHE_KEYS) > _CACHE_MAX_ENTRIES:
        oldest = _CACHE_KEYS.pop(0)
        _SVG_CACHE.pop(oldest, None)
        _PNG_CACHE.pop(oldest, None)


def _cache_key(*parts: object) -> str:
    payload = json.dumps(parts, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _render_chart_svg_from_context(
    context: RenderContext,
    glyph_glow: bool,
    glyph_outline_color: str | None,
    embed_frame_data_uri: bool,
) -> RenderResult:
    renderer = SvgChartRenderer(context.settings)
    chart_svg = renderer.render(
        context.chart,
        global_transform=context.chart_fit,
        overrides=context.overrides,
        frame_circle=context.frame_circle,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
    )
    frame_asset = None
    if context.image_path is not None:
        frame_id = context.frame_id or ""
        metadata_path = context.metadata_path or Path("")
        frame_asset = FrameAsset(
            frame_id=frame_id,
            frame_dir=context.image_path.parent,
            image_path=context.image_path,
            metadata_path=metadata_path,
            meta=context.meta,
            image=None,
        )
    background_image_path = _resolve_background_image_path(context.design.background_image_path)
    final_svg = compose_svg(
        chart_svg,
        frame_asset,
        embed_frame_data_uri=embed_frame_data_uri,
        layer_order=context.design.layer_order,
        layer_opacity=context.design.layer_opacity,
        background_image_path=background_image_path,
        background_image_transform=(
            context.design.background_image_scale,
            context.design.background_image_dx,
            context.design.background_image_dy,
        ),
        meta_override=context.meta,
        chart_occluders=context.chart_occluders,
    )
    return RenderResult(
        svg=final_svg, width=context.meta.canvas_width, height=context.meta.canvas_height
    )


def _chart_record_payload(chart: ChartRecord) -> dict:
    if hasattr(chart, "to_dict"):
        return chart.to_dict()
    return chart.__dict__


async def _build_frame_render_context(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
    config,
    design_override: dict | None = None,
) -> RenderContext:
    template_meta = await storage.load_template_meta(frame_id)
    override_meta = await storage.load_chart_meta(chart.chart_id, frame_id)
    merged_meta = _merge_dicts(template_meta, override_meta)

    image_path = await storage.template_image_path(frame_id)
    image_size = _get_image_size(image_path)
    meta = validate_meta(merged_meta, image_size)

    layout = await storage.load_chart_layout(chart.chart_id, frame_id) or {"overrides": {}}
    overrides = _overrides_from_layout(layout)
    frame_circle = _frame_circle_from_layout(layout, image_size)
    chart_occluders = layout.get("chart_occluders") if isinstance(layout, dict) else None

    layout_fit = layout.get("chart_fit") if isinstance(layout, dict) else None
    if isinstance(layout_fit, dict):
        chart_fit = _chart_fit_from_payload(layout_fit)
    else:
        chart_fit = ChartFit(
            dx=meta.chart_fit_dx,
            dy=meta.chart_fit_dy,
            scale=meta.chart_fit_scale,
            rotation_deg=meta.chart_fit_rotation_deg,
        )
    design = _design_from_layout(layout, design_override)
    settings = _build_settings(meta, config, design)
    metadata_path = await storage.template_meta_path(frame_id)
    cache_key = _cache_key(
        "frame",
        chart.chart_id,
        frame_id,
        _chart_record_payload(chart),
        merged_meta,
        layout,
    )
    return RenderContext(
        chart=_build_chart(chart),
        settings=settings,
        overrides=overrides,
        chart_fit=chart_fit,
        frame_circle=frame_circle,
        meta=meta,
        design=design,
        chart_occluders=chart_occluders,
        image_path=image_path,
        frame_id=frame_id,
        metadata_path=metadata_path,
        cache_key=cache_key,
    )


async def _build_chart_only_context(
    storage: StorageProtocol,
    chart: ChartRecord,
    config,
    design_override: dict | None = None,
) -> RenderContext:
    chart_fit_payload = await storage.load_chart_fit(chart.chart_id)
    layout = await storage.load_chart_layout_base(chart.chart_id) or {"overrides": {}}
    chart_occluders = layout.get("chart_occluders") if isinstance(layout, dict) else None
    meta = _chart_only_meta(chart_fit_payload)
    font_scale = max(0.1, meta.ring_outer / CHART_ONLY_FONT_BASE_RADIUS)
    design = _design_from_layout(layout, design_override)
    settings = _build_settings(meta, config, design, font_scale=font_scale)
    overrides = _overrides_from_layout(layout)
    chart_fit = _chart_fit_from_payload(chart_fit_payload)
    cache_key = _cache_key(
        "chart_only",
        chart.chart_id,
        _chart_record_payload(chart),
        chart_fit_payload,
        layout,
    )
    return RenderContext(
        chart=_build_chart(chart),
        settings=settings,
        overrides=overrides,
        chart_fit=chart_fit,
        frame_circle=None,
        meta=meta,
        design=design,
        chart_occluders=chart_occluders,
        image_path=None,
        cache_key=cache_key,
    )


def _chart_only_radius() -> float:
    config = load_config()
    return min(config.canvas_width, config.canvas_height) * 0.4


CHART_ONLY_MIN_CANVAS = 4096
CHART_ONLY_FONT_BASE_RADIUS = 465.0
CHART_ONLY_RING_INNER_RATIO = 0.34 / 0.45


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
            "ring_inner": radius * CHART_ONLY_RING_INNER_RATIO,
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
    rx_norm = raw.get("rxNorm")
    ry_norm = raw.get("ryNorm")
    if not isinstance(cx_norm, (int, float)):
        return None
    if not isinstance(cy_norm, (int, float)):
        return None
    if r_norm is not None and not isinstance(r_norm, (int, float)):
        return None
    if rx_norm is not None and not isinstance(rx_norm, (int, float)):
        return None
    if ry_norm is not None and not isinstance(ry_norm, (int, float)):
        return None
    if r_norm is None and (rx_norm is None or ry_norm is None):
        return None
    r_value = float(r_norm) if r_norm is not None else None
    rx_value = float(rx_norm) if rx_norm is not None else None
    ry_value = float(ry_norm) if ry_norm is not None else None
    if r_value is None:
        assert rx_value is not None and ry_value is not None
        r_value = min(rx_value, ry_value)
    if rx_value is None:
        rx_value = r_value
    if ry_value is None:
        ry_value = r_value
    width, height = image_size
    return FrameCircle(
        cx=cx_norm * width,
        cy=cy_norm * height,
        rx=rx_value * width,
        ry=ry_value * height,
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
    design_override: dict | None = None,
) -> RenderResult:
    config = load_config()
    context = await _build_frame_render_context(
        storage,
        chart,
        frame_id,
        config,
        design_override=design_override,
    )
    cache_key = _cache_key(
        "svg",
        context.cache_key,
        glyph_glow,
        glyph_outline_color,
        config.embed_frame_data_uri,
        design_override,
    )
    cached = _SVG_CACHE.get(cache_key)
    if cached:
        return cached
    result = _render_chart_svg_from_context(
        context,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        embed_frame_data_uri=config.embed_frame_data_uri,
    )
    _cache_set(_SVG_CACHE, cache_key, result)
    return result


async def render_chart_only_svg(
    storage: StorageProtocol,
    chart: ChartRecord,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_override: dict | None = None,
) -> RenderResult:
    config = load_config()
    context = await _build_chart_only_context(
        storage,
        chart,
        config,
        design_override=design_override,
    )
    cache_key = _cache_key(
        "svg",
        context.cache_key,
        glyph_glow,
        glyph_outline_color,
        design_override,
    )
    cached = _SVG_CACHE.get(cache_key)
    if cached:
        return cached
    result = _render_chart_svg_from_context(
        context,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        embed_frame_data_uri=config.embed_frame_data_uri,
    )
    _cache_set(_SVG_CACHE, cache_key, result)
    return result


def _position_for_element(element: AutoLayoutElement, dr: float, dt: float) -> tuple[float, float]:
    dx, dy = polar_offset_to_xy(dr, dt, element.theta_deg)
    return element.base_x + dx, element.base_y + dy


def _overlaps_by_distance(
    element: AutoLayoutElement,
    dr: float,
    other: AutoLayoutElement,
    other_dr: float,
    min_gap_px: float,
    ring_radius: float,
    radius_scale: float,
) -> bool:
    x, y = _position_for_element(element, dr, 0.0)
    ox, oy = _position_for_element(other, other_dr, 0.0)
    radius = max(element.width, element.height) / 2 * radius_scale
    other_radius = max(other.width, other.height) / 2 * radius_scale
    min_distance = radius + other_radius + min_gap_px
    if ring_radius > 0:
        angle_delta = abs((element.theta_deg - other.theta_deg + 180.0) % 360.0 - 180.0)
        angle_threshold = math.degrees(min_distance / ring_radius)
        if angle_delta > angle_threshold:
            return False
    tolerance = max(3.0, min_gap_px * 0.5)
    return math.hypot(x - ox, y - oy) < (min_distance - tolerance)


def _required_inward_shift(
    element: AutoLayoutElement,
    current_dr: float,
    other: AutoLayoutElement,
    other_dr: float,
    min_gap_px: float,
    ring_radius: float,
    radius_scale: float,
) -> float | None:
    if not _overlaps_by_distance(
        element,
        current_dr,
        other,
        other_dr,
        min_gap_px,
        ring_radius,
        radius_scale,
    ):
        return None
    base_x, base_y = _position_for_element(element, 0.0, 0.0)
    ox, oy = _position_for_element(other, other_dr, 0.0)
    radius = max(element.width, element.height) / 2 * radius_scale
    other_radius = max(other.width, other.height) / 2 * radius_scale
    min_distance = radius + other_radius + min_gap_px
    dx = base_x - ox
    dy = base_y - oy
    ux, uy = polar_offset_to_xy(1.0, 0.0, element.theta_deg)
    b = dx * ux + dy * uy
    c = dx * dx + dy * dy - min_distance * min_distance
    discriminant = b * b - c
    if discriminant <= 0:
        return current_dr - 1.0
    root = math.sqrt(discriminant)
    r1 = -b - root
    if r1 >= current_dr:
        return current_dr - 1.0
    return r1


def _compute_auto_layout_overrides_from_meta(
    meta: FrameMeta,
    chart: ChartRecord,
    config: AppConfig,
    min_gap_px: int,
    max_iter: int,
) -> dict[str, dict[str, float]]:
    design = _design_from_layout(None)
    settings = _build_settings(meta, config, design)
    chart_data = _build_chart(chart)
    glyph_font_base = 60.0
    glyph_font = glyph_font_base * settings.font_scale

    elements: list[AutoLayoutElement] = []
    for planet in chart_data.planets:
        angle = longitude_to_angle(planet.longitude)
        glyph_pos = polar_to_cartesian(
            meta.chart_center_x,
            meta.chart_center_y,
            settings.radius * settings.planet_ring_ratio,
            angle,
        )
        glyph_width = glyph_font * 0.95
        glyph_height = glyph_font * 0.95
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

    overrides: dict[str, dict[str, float]] = {}
    dr_min = -120.0
    max_inward_shift = -0.4 * glyph_font
    gap_ratio = min_gap_px / glyph_font_base if min_gap_px > 0 else 0.0
    gap_px = glyph_font * gap_ratio
    ring_radius = settings.radius * settings.planet_ring_ratio
    radius_scale = 0.85

    dr_values = {element.element_id: 0.0 for element in elements}

    placed: list[AutoLayoutElement] = []
    for element in elements:
        current_dr = dr_values[element.element_id]
        required_dr = current_dr
        for other in placed:
            candidate = _required_inward_shift(
                element,
                required_dr,
                other,
                dr_values[other.element_id],
                gap_px,
                ring_radius,
                radius_scale,
            )
            if candidate is not None:
                required_dr = min(required_dr, candidate)
        dr_floor = max(dr_min, max_inward_shift)
        if required_dr < dr_floor:
            required_dr = dr_floor
        dr_values[element.element_id] = required_dr
        placed.append(element)

    for element in elements:
        dr = dr_values[element.element_id]
        if dr != 0.0:
            overrides[element.element_id] = {"dr": dr, "dt": 0.0}

    return overrides


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

    return _compute_auto_layout_overrides_from_meta(
        meta,
        chart,
        config,
        min_gap_px,
        max_iter,
    )


async def compute_auto_layout_overrides_chart_only(
    storage: StorageProtocol,
    chart: ChartRecord,
    min_gap_px: int = 0,
    max_iter: int = 200,
) -> dict[str, dict[str, float]]:
    config = load_config()
    chart_fit = await storage.load_chart_fit(chart.chart_id)
    meta = _chart_only_meta(chart_fit)
    return _compute_auto_layout_overrides_from_meta(
        meta,
        chart,
        config,
        min_gap_px,
        max_iter,
    )


async def render_chart_png(
    storage: StorageProtocol,
    chart: ChartRecord,
    frame_id: str,
    max_size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_override: dict | None = None,
) -> bytes:
    config = load_config()
    context = await _build_frame_render_context(
        storage,
        chart,
        frame_id,
        config,
        design_override=design_override,
    )
    cache_key = _cache_key(
        "png",
        context.cache_key,
        max_size,
        glyph_glow,
        glyph_outline_color,
        config.embed_frame_data_uri,
        design_override,
    )
    cached = _PNG_CACHE.get(cache_key)
    if cached:
        return cached
    result = _render_chart_svg_from_context(
        context,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        embed_frame_data_uri=config.embed_frame_data_uri,
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
    _cache_set(_PNG_CACHE, cache_key, png_bytes)
    return png_bytes


async def render_chart_only_png(
    storage: StorageProtocol,
    chart: ChartRecord,
    max_size: int | None = None,
    glyph_glow: bool = False,
    glyph_outline_color: str | None = None,
    design_override: dict | None = None,
) -> bytes:
    config = load_config()
    context = await _build_chart_only_context(
        storage,
        chart,
        config,
        design_override=design_override,
    )
    cache_key = _cache_key(
        "png",
        context.cache_key,
        max_size,
        glyph_glow,
        glyph_outline_color,
        design_override,
    )
    cached = _PNG_CACHE.get(cache_key)
    if cached:
        return cached
    result = _render_chart_svg_from_context(
        context,
        glyph_glow=glyph_glow,
        glyph_outline_color=glyph_outline_color,
        embed_frame_data_uri=config.embed_frame_data_uri,
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
    _cache_set(_PNG_CACHE, cache_key, png_bytes)
    return png_bytes


class StorageProtocol(Protocol):
    async def load_template_meta(self, frame_id: str) -> dict: ...
    async def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None: ...
    async def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None: ...
    async def load_chart_fit(self, chart_id: str) -> dict | None: ...
    async def load_chart_layout_base(self, chart_id: str) -> dict | None: ...
    async def template_image_path(self, frame_id: str) -> Path: ...
    async def template_meta_path(self, frame_id: str) -> Path: ...
