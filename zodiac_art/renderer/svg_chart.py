"""SVG chart renderer."""

from __future__ import annotations

from dataclasses import dataclass

import svgwrite
from svgwrite.base import BaseElement
from svgwrite.container import Group
from svgwrite.filters import Filter

from zodiac_art.config import load_config
from zodiac_art.models.chart_models import Chart
from zodiac_art.renderer.geometry import (
    arc_path,
    longitude_to_angle,
    polar_offset_to_xy,
    polar_to_cartesian,
)
from zodiac_art.renderer.glyph_paths import glyph_path_data
from zodiac_art.renderer.glyphs import get_planet_glyph, get_zodiac_glyph


@dataclass(frozen=True)
class RenderSettings:
    """Settings for SVG chart rendering."""

    width: int
    height: int
    center_x: float
    center_y: float
    radius: float
    sign_ring_inner_ratio: float
    sign_ring_outer_ratio: float
    planet_ring_ratio: float
    label_ring_ratio: float
    planet_label_offset_ratio: float
    font_scale: float
    glyph_mode: str


@dataclass(frozen=True)
class ChartFit:
    """Global chart transform overrides."""

    dx: float
    dy: float
    scale: float
    rotation_deg: float


@dataclass(frozen=True)
class ElementOverride:
    """Per-element translation override."""

    dx: float
    dy: float
    dr: float | None = None
    dt: float | None = None
    color: str | None = None


@dataclass(frozen=True)
class FrameCircle:
    """Frame inner-circle for clipping."""

    cx: float
    cy: float
    r: float


class SvgChartRenderer:
    """Render a Chart into an SVG string."""

    def __init__(
        self,
        settings: RenderSettings,
    ) -> None:
        self.settings = settings

    def render(
        self,
        chart: Chart,
        global_transform: ChartFit | None = None,
        overrides: dict[str, ElementOverride] | None = None,
        frame_circle: FrameCircle | None = None,
        glyph_glow: bool = False,
        glyph_outline_color: str | None = None,
    ) -> str:
        """Render the chart into an SVG string."""

        dwg = svgwrite.Drawing(
            size=(self.settings.width, self.settings.height),
            profile="full",
            debug=False,
        )
        dwg.viewbox(0, 0, self.settings.width, self.settings.height)

        glyph_mode = self.settings.glyph_mode
        glow_filter = None
        if glyph_glow:
            glow_filter = Filter(id="glyphGlow", x="-50%", y="-50%", width="200%", height="200%")
            glow_filter.feGaussianBlur(in_="SourceGraphic", stdDeviation=3, result="blur")
            glow_filter.feMerge(["blur", "SourceGraphic"])
            dwg.defs.add(glow_filter)

        def apply_glyph_effects(group: Group) -> None:
            if glow_filter is not None:
                group.update({"filter": "url(#glyphGlow)"})

        def apply_outline(element: BaseElement) -> None:
            if outline_attrs:
                element.update(outline_attrs)
                element.update({"data-fill-only": "true"})

        center = (self.settings.center_x, self.settings.center_y)
        outer_radius = self.settings.radius * self.settings.sign_ring_outer_ratio
        inner_radius = self.settings.radius * self.settings.sign_ring_inner_ratio
        planet_radius = self.settings.radius * self.settings.planet_ring_ratio
        label_radius = self.settings.radius * self.settings.label_ring_ratio
        font_scale = max(0.1, self.settings.font_scale)
        outline_width = max(1.2, 2.0 * font_scale)
        outline_attrs = {}
        if glyph_outline_color:
            outline_attrs = {
                "stroke": glyph_outline_color,
                "stroke-width": outline_width,
                "stroke-linejoin": "round",
                "stroke-linecap": "round",
                "paint-order": "stroke fill",
                "vector-effect": "non-scaling-stroke",
            }

        if overrides is None:
            overrides = {}

        chart_fit = global_transform or ChartFit(dx=0, dy=0, scale=1.0, rotation_deg=0.0)
        chart_transform = (
            f"translate({chart_fit.dx:.3f} {chart_fit.dy:.3f}) "
            f"translate({center[0]:.3f} {center[1]:.3f}) "
            f"rotate({chart_fit.rotation_deg:.3f}) "
            f"scale({chart_fit.scale:.6f}) "
            f"translate({-center[0]:.3f} {-center[1]:.3f})"
        )
        chart_group = dwg.g(id="chartRoot", transform=chart_transform)
        if frame_circle:
            clip_id = "frameClip"
            clip = dwg.clipPath(id=clip_id, clipPathUnits="userSpaceOnUse")
            clip.add(dwg.circle(center=(frame_circle.cx, frame_circle.cy), r=frame_circle.r))
            dwg.defs.add(clip)
            chart_group.update({"clip-path": f"url(#{clip_id})"})

        background_override = overrides.get("chart.background")
        background_color = background_override.color if background_override else None
        chart_group.add(
            dwg.circle(
                center=center,
                r=outer_radius,
                fill=background_color or "none",
                stroke="none",
                **{"data-fill-only": "true", "id": "chart.background"},
            )
        )

        angle_offset = 180.0 - longitude_to_angle(chart.ascendant)

        zodiac_signs = [
            "Aries",
            "Taurus",
            "Gemini",
            "Cancer",
            "Leo",
            "Virgo",
            "Libra",
            "Scorpio",
            "Sagittarius",
            "Capricorn",
            "Aquarius",
            "Pisces",
        ]

        lines_group = dwg.g(id="chart.lines")
        for index, house in enumerate(chart.houses):
            start_angle = longitude_to_angle(house.cusp_longitude) + angle_offset
            end_longitude = chart.houses[(index + 1) % 12].cusp_longitude
            end_angle = longitude_to_angle(end_longitude) + angle_offset
            lines_group.add(
                dwg.path(
                    d=arc_path(center[0], center[1], outer_radius, start_angle, end_angle),
                    fill="none",
                    stroke="#1f1f1f",
                    stroke_width=3,
                    **{"data-stroke-only": "true"},
                )
            )
            lines_group.add(
                dwg.path(
                    d=arc_path(center[0], center[1], inner_radius, start_angle, end_angle),
                    fill="none",
                    stroke="#1f1f1f",
                    stroke_width=3,
                    **{"data-stroke-only": "true"},
                )
            )
        for index, house in enumerate(chart.houses):
            angle = longitude_to_angle(house.cusp_longitude) + angle_offset
            line_end = polar_to_cartesian(center[0], center[1], inner_radius, angle)
            house_id = f"house.{index + 1}.line"
            line_group = dwg.g(id=house_id)
            line_group.add(
                dwg.line(
                    start=center,
                    end=line_end,
                    stroke="#3a3a3a",
                    stroke_width=2,
                    **{"data-stroke-only": "true"},
                )
            )
            lines_group.add(line_group)
        chart_group.add(lines_group)

        sign_radius = label_radius * 0.98
        asc_radius = inner_radius * 0.90
        asc_size = 56 * font_scale
        asc_angle = longitude_to_angle(chart.ascendant) + angle_offset
        asc_pos = polar_to_cartesian(center[0], center[1], asc_radius, asc_angle)
        asc_group = dwg.g(id="asc.marker")
        apply_glyph_effects(asc_group)
        asc_group.update({"data-theta": f"{asc_angle:.3f}"})
        asc_override = overrides.get("asc.marker")
        asc_color = asc_override.color if asc_override else "#000"
        if asc_override:
            dx, dy = _resolve_override(asc_override, asc_angle)
            asc_group.translate(dx, dy)
        if glyph_mode == "path":
            path_data = glyph_path_data("↑", asc_pos[0], asc_pos[1], asc_size)
            if path_data:
                d, transform = path_data
                asc_path = dwg.path(d=d, fill=asc_color, transform=transform)
                apply_outline(asc_path)
                asc_group.add(asc_path)
            else:
                asc_text = dwg.text(
                    "↑",
                    insert=asc_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=asc_size,
                    font_family="serif",
                    fill=asc_color,
                )
                apply_outline(asc_text)
                asc_group.add(asc_text)
        else:
            asc_text = dwg.text(
                "↑",
                insert=asc_pos,
                text_anchor="middle",
                alignment_baseline="middle",
                font_size=asc_size,
                font_family="serif",
                fill=asc_color,
            )
            apply_outline(asc_text)
            asc_group.add(asc_text)
        chart_group.add(asc_group)
        for index, sign in enumerate(zodiac_signs):
            longitude = index * 30 + 15
            mid_angle = longitude_to_angle(longitude) + angle_offset
            label_pos = polar_to_cartesian(center[0], center[1], sign_radius, mid_angle)
            glyph = get_zodiac_glyph(sign)
            sign_id = f"sign.{sign}"
            sign_override = overrides.get(sign_id)
            sign_group = dwg.g(id=sign_id)
            apply_glyph_effects(sign_group)
            sign_group.update({"data-theta": f"{mid_angle:.3f}"})
            sign_color = sign_override.color if sign_override else "#000"
            if sign_override:
                dx, dy = _resolve_override(sign_override, mid_angle)
                sign_group.translate(dx, dy)
            if glyph_mode == "path":
                path_data = glyph_path_data(glyph, label_pos[0], label_pos[1], 56 * font_scale)
                if path_data:
                    d, transform = path_data
                    sign_path = dwg.path(d=d, fill=sign_color, transform=transform)
                    apply_outline(sign_path)
                    sign_group.add(sign_path)
                else:
                    sign_text = dwg.text(
                        glyph,
                        insert=label_pos,
                        text_anchor="middle",
                        alignment_baseline="middle",
                        font_size=56 * font_scale,
                        font_family="serif",
                        fill=sign_color,
                    )
                    apply_outline(sign_text)
                    sign_group.add(sign_text)
            else:
                sign_text = dwg.text(
                    glyph,
                    insert=label_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=56 * font_scale,
                    font_family="serif",
                    fill=sign_color,
                )
                apply_outline(sign_text)
                sign_group.add(sign_text)
            chart_group.add(sign_group)

        for planet in chart.planets:
            angle = longitude_to_angle(planet.longitude) + angle_offset
            planet_pos = polar_to_cartesian(center[0], center[1], planet_radius, angle)
            planet_glyph = get_planet_glyph(planet.name)
            planet_glyph_id = f"planet.{planet.name}.glyph"
            glyph_override = overrides.get(planet_glyph_id)
            glyph_group = dwg.g(id=planet_glyph_id)
            apply_glyph_effects(glyph_group)
            glyph_group.update({"data-theta": f"{angle:.3f}"})
            glyph_color = glyph_override.color if glyph_override else "#000"
            if glyph_override:
                dx, dy = _resolve_override(glyph_override, angle)
                glyph_group.translate(dx, dy)
            if glyph_mode == "path":
                path_data = glyph_path_data(
                    planet_glyph,
                    planet_pos[0],
                    planet_pos[1],
                    60 * font_scale,
                )
                if path_data:
                    d, transform = path_data
                    glyph_path = dwg.path(d=d, fill=glyph_color, transform=transform)
                    apply_outline(glyph_path)
                    glyph_group.add(glyph_path)
                else:
                    glyph_text = dwg.text(
                        planet_glyph,
                        insert=planet_pos,
                        text_anchor="middle",
                        alignment_baseline="middle",
                        font_size=60 * font_scale,
                        font_family="serif",
                        fill=glyph_color,
                    )
                    apply_outline(glyph_text)
                    glyph_group.add(glyph_text)
            else:
                glyph_text = dwg.text(
                    planet_glyph,
                    insert=planet_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=60 * font_scale,
                    font_family="serif",
                    fill=glyph_color,
                )
                apply_outline(glyph_text)
                glyph_group.add(glyph_text)
            chart_group.add(glyph_group)

        dwg.add(chart_group)
        return dwg.tostring()


def _resolve_override(override: ElementOverride, theta_deg: float) -> tuple[float, float]:
    if override.dr is not None or override.dt is not None:
        dx, dy = polar_offset_to_xy(override.dr or 0.0, override.dt or 0.0, theta_deg)
        return dx, dy
    return override.dx, override.dy


def default_render_settings(radius: float, center_x: float, center_y: float) -> RenderSettings:
    """Build default render settings from config."""

    config = load_config()
    return RenderSettings(
        width=config.canvas_width,
        height=config.canvas_height,
        center_x=center_x,
        center_y=center_y,
        radius=radius,
        sign_ring_inner_ratio=config.sign_ring_inner_ratio,
        sign_ring_outer_ratio=config.sign_ring_outer_ratio,
        planet_ring_ratio=config.planet_ring_ratio,
        label_ring_ratio=config.label_ring_ratio,
        planet_label_offset_ratio=config.planet_label_offset_ratio,
        font_scale=1.0,
        glyph_mode=config.glyph_mode,
    )
