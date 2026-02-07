"""Auto-layout smoke test."""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from zodiac_art.api.rendering import compute_auto_layout_overrides
from zodiac_art.api.storage import FileStorage
from zodiac_art.api.storage_async import AsyncFileStorage
from zodiac_art.frames.validation import validate_meta
from zodiac_art.renderer.geometry import longitude_to_angle, polar_offset_to_xy, polar_to_cartesian


@dataclass(frozen=True)
class _Element:
    element_id: str
    theta_deg: float
    base_x: float
    base_y: float
    width: float
    height: float


def _bbox(element: _Element, dr: float, dt: float) -> tuple[float, float, float, float]:
    dx, dy = polar_offset_to_xy(dr, dt, element.theta_deg)
    x = element.base_x + dx
    y = element.base_y + dy
    return (x - element.width / 2, y - element.height / 2, x + element.width / 2, y + element.height / 2)


def _overlaps(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    return not (a[2] <= b[0] or a[0] >= b[2] or a[3] <= b[1] or a[1] >= b[3])


def _build_elements(chart, center_x: float, center_y: float, planet_radius: float, label_radius: float) -> list[_Element]:
    elements: list[_Element] = []
    for planet in chart.planets:
        angle = longitude_to_angle(planet.longitude)
        label_pos = polar_to_cartesian(center_x, center_y, label_radius, angle)
        glyph_pos = polar_to_cartesian(center_x, center_y, planet_radius, angle)
        label_font = 28.0
        glyph_font = 60.0
        label_width = label_font * 0.6 * max(1, len(planet.name))
        label_height = label_font * 1.1
        glyph_width = glyph_font * 0.9
        glyph_height = glyph_font * 0.9
        elements.append(
            _Element(
                element_id=f"planet.{planet.name}.label",
                theta_deg=angle,
                base_x=label_pos[0],
                base_y=label_pos[1],
                width=label_width,
                height=label_height,
            )
        )
        elements.append(
            _Element(
                element_id=f"planet.{planet.name}.glyph",
                theta_deg=angle,
                base_x=glyph_pos[0],
                base_y=glyph_pos[1],
                width=glyph_width,
                height=glyph_height,
            )
        )
    return elements


def _count_overlaps(elements: list[_Element], overrides: dict[str, dict[str, float]]) -> int:
    boxes: list[tuple[float, float, float, float]] = []
    count = 0
    for element in elements:
        override = overrides.get(element.element_id, {})
        dr = float(override.get("dr", 0.0))
        dt = float(override.get("dt", 0.0))
        box = _bbox(element, dr, dt)
        for other in boxes:
            if _overlaps(box, other):
                count += 1
                break
        boxes.append(box)
    return count


async def _run() -> None:
    parser = argparse.ArgumentParser(description="Auto layout smoke test")
    parser.add_argument("--chart-id", required=True)
    parser.add_argument("--frame", required=True)
    args = parser.parse_args()

    storage = FileStorage()
    record = storage.load_chart(args.chart_id)
    template_meta = storage.load_template_meta(args.frame)
    override_meta = storage.load_chart_meta(args.chart_id, args.frame)
    if override_meta:
        template_meta.update(override_meta)
    image_path = storage.template_image_path(args.frame)
    with Image.open(image_path) as image:
        image_size = image.size
    meta = validate_meta(template_meta, image_size)
    from zodiac_art.api.rendering import _build_chart, _build_settings

    settings = _build_settings(meta)
    chart = _build_chart(record)
    elements = _build_elements(
        chart,
        meta.chart_center_x,
        meta.chart_center_y,
        settings.radius * settings.planet_ring_ratio,
        settings.radius * settings.label_ring_ratio,
    )
    base_overrides: dict[str, dict[str, float]] = {}
    before = _count_overlaps(elements, base_overrides)
    async_storage = AsyncFileStorage(storage)
    overrides = await compute_auto_layout_overrides(async_storage, record, args.frame)
    after = _count_overlaps(elements, overrides)
    print(f"Overlaps before: {before}")
    print(f"Overlaps after: {after}")

    output_dir = Path("output")
    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = output_dir / "auto_layout_debug.svg"
    rects = []
    for element in elements:
        override = overrides.get(element.element_id, {})
        dr = float(override.get("dr", 0.0))
        dt = float(override.get("dt", 0.0))
        left, top, right, bottom = _bbox(element, dr, dt)
        rects.append(
            f"<rect x='{left:.1f}' y='{top:.1f}' width='{right-left:.1f}' height='{bottom-top:.1f}' "
            "fill='none' stroke='rgba(255,0,0,0.6)' stroke-width='1' />"
        )
    svg = (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{meta.canvas_width}' height='{meta.canvas_height}'>"
        "<rect width='100%' height='100%' fill='white' />"
        + "".join(rects)
        + "</svg>"
    )
    svg_path.write_text(svg, encoding="utf-8")
    print(f"Wrote {svg_path}")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
