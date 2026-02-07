"""Rendering helpers for the API layer."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Protocol

import cairosvg
from PIL import Image

from zodiac_art.astro.chart_builder import build_chart
from zodiac_art.astro.ephemeris import calculate_ephemeris
from zodiac_art.compositor.compositor import compose_svg
from zodiac_art.frames.frame_loader import FrameAsset
from zodiac_art.frames.validation import validate_meta
from zodiac_art.config import load_config
from zodiac_art.renderer.geometry import longitude_to_angle, polar_offset_to_xy, polar_to_cartesian
from zodiac_art.renderer.svg_chart import ChartFit, ElementOverride, RenderSettings, SvgChartRenderer

from zodiac_art.api.storage import ChartRecord


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


def _build_settings(meta) -> RenderSettings:
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
    )


def _build_chart(record: ChartRecord):
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
    overrides = {}
    for key, value in layout.get("overrides", {}).items():
        if not isinstance(value, dict):
            continue
        overrides[key] = ElementOverride(
            dx=value.get("dx", 0.0),
            dy=value.get("dy", 0.0),
            dr=value.get("dr"),
            dt=value.get("dt"),
        )

    chart_fit = ChartFit(
        dx=meta.chart_fit_dx,
        dy=meta.chart_fit_dy,
        scale=meta.chart_fit_scale,
        rotation_deg=meta.chart_fit_rotation_deg,
    )

    settings = _build_settings(meta)
    renderer = SvgChartRenderer(settings)
    chart_svg = renderer.render(_build_chart(chart), global_transform=chart_fit, overrides=overrides)
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
        label_pos = polar_to_cartesian(
            meta.chart_center_x,
            meta.chart_center_y,
            settings.radius * settings.label_ring_ratio,
            angle,
        )
        glyph_pos = polar_to_cartesian(
            meta.chart_center_x,
            meta.chart_center_y,
            settings.radius * settings.planet_ring_ratio,
            angle,
        )
        label_font = 28.0
        glyph_font = 60.0
        label_width = label_font * 0.6 * max(1, len(planet.name))
        label_height = label_font * 1.1
        glyph_width = glyph_font * 0.9
        glyph_height = glyph_font * 0.9
        elements.append(
            AutoLayoutElement(
                element_id=f"planet.{planet.name}.label",
                theta_deg=angle,
                base_x=label_pos[0],
                base_y=label_pos[1],
                width=label_width,
                height=label_height,
            )
        )
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
    dt_step = 6.0
    dt_max = 120.0
    dr_step = -8.0

    for element in elements:
        dr = 0.0
        dt = 0.0
        attempts = 0
        t_index = 0
        while attempts < max_iter:
            bbox = _bbox_for_element(element, dr, dt, min_gap_px)
            if not any(_overlaps(bbox, other) for other in accepted):
                accepted.append(bbox)
                if dr != 0.0 or dt != 0.0:
                    overrides[element.element_id] = {"dr": dr, "dt": dt}
                break
            attempts += 1
            t_index += 1
            direction = 1 if t_index % 2 == 1 else -1
            multiplier = (t_index + 1) // 2
            dt = direction * multiplier * dt_step
            if abs(dt) > dt_max:
                dt = 0.0
                t_index = 0
                dr += dr_step

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
class StorageProtocol(Protocol):
    async def load_template_meta(self, frame_id: str) -> dict: ...
    async def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None: ...
    async def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None: ...
    async def template_image_path(self, frame_id: str) -> Path: ...
    async def template_meta_path(self, frame_id: str) -> Path: ...
