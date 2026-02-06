"""SVG chart renderer."""

from __future__ import annotations

from dataclasses import dataclass
import svgwrite

from zodiac_art.config import load_config
from zodiac_art.models.chart_models import Chart
from zodiac_art.renderer.geometry import arc_path, longitude_to_angle, polar_to_cartesian
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
    ) -> str:
        """Render the chart into an SVG string."""

        dwg = svgwrite.Drawing(
            size=(self.settings.width, self.settings.height),
            profile="full",
        )
        dwg.viewbox(0, 0, self.settings.width, self.settings.height)

        glyph_mode = load_config().glyph_mode

        center = (self.settings.center_x, self.settings.center_y)
        outer_radius = self.settings.radius * self.settings.sign_ring_outer_ratio
        inner_radius = self.settings.radius * self.settings.sign_ring_inner_ratio
        planet_radius = self.settings.radius * self.settings.planet_ring_ratio
        label_radius = self.settings.radius * self.settings.label_ring_ratio
        label_offset = self.settings.radius * self.settings.planet_label_offset_ratio

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

        for index, house in enumerate(chart.houses):
            start_angle = longitude_to_angle(house.cusp_longitude)
            end_longitude = chart.houses[(index + 1) % 12].cusp_longitude
            end_angle = longitude_to_angle(end_longitude)
            chart_group.add(
                dwg.path(
                    d=arc_path(center[0], center[1], outer_radius, start_angle, end_angle),
                    fill="none",
                    stroke="#1f1f1f",
                    stroke_width=3,
                )
            )
            chart_group.add(
                dwg.path(
                    d=arc_path(center[0], center[1], inner_radius, start_angle, end_angle),
                    fill="none",
                    stroke="#1f1f1f",
                    stroke_width=3,
                )
            )
            mid_angle = longitude_to_angle((house.cusp_longitude + end_longitude) / 2)
            label_pos = polar_to_cartesian(center[0], center[1], label_radius, mid_angle)
            glyph = get_zodiac_glyph(house.sign)
            sign_id = f"sign.{house.sign}"
            sign_override = overrides.get(sign_id)
            sign_group = dwg.g(id=sign_id)
            if sign_override:
                sign_group.translate(sign_override.dx, sign_override.dy)
            if glyph_mode == "path":
                path_data = glyph_path_data(glyph, label_pos[0], label_pos[1], 56)
                if path_data:
                    d, transform = path_data
                    sign_group.add(dwg.path(d=d, fill="#000", transform=transform))
                else:
                    sign_group.add(
                        dwg.text(
                            glyph,
                            insert=label_pos,
                            text_anchor="middle",
                            alignment_baseline="middle",
                            font_size=56,
                            font_family="serif",
                        )
                    )
            else:
                sign_group.add(
                    dwg.text(
                        glyph,
                        insert=label_pos,
                        text_anchor="middle",
                        alignment_baseline="middle",
                        font_size=56,
                        font_family="serif",
                    )
                )
            chart_group.add(sign_group)

        for index, house in enumerate(chart.houses):
            angle = longitude_to_angle(house.cusp_longitude)
            line_end = polar_to_cartesian(center[0], center[1], inner_radius, angle)
            house_id = f"house.{index + 1}.line"
            line_group = dwg.g(id=house_id)
            line_group.add(
                dwg.line(
                    start=center,
                    end=line_end,
                    stroke="#3a3a3a",
                    stroke_width=2,
                )
            )
            chart_group.add(line_group)

        for planet in chart.planets:
            angle = longitude_to_angle(planet.longitude)
            planet_pos = polar_to_cartesian(center[0], center[1], planet_radius, angle)
            label_pos = polar_to_cartesian(
                center[0], center[1], planet_radius + label_offset, angle
            )
            planet_glyph = get_planet_glyph(planet.name)
            planet_glyph_id = f"planet.{planet.name}.glyph"
            glyph_override = overrides.get(planet_glyph_id)
            glyph_group = dwg.g(id=planet_glyph_id)
            if glyph_override:
                glyph_group.translate(glyph_override.dx, glyph_override.dy)
            if glyph_mode == "path":
                path_data = glyph_path_data(planet_glyph, planet_pos[0], planet_pos[1], 60)
                if path_data:
                    d, transform = path_data
                    glyph_group.add(dwg.path(d=d, fill="#000", transform=transform))
                else:
                    glyph_group.add(
                        dwg.text(
                            planet_glyph,
                            insert=planet_pos,
                            text_anchor="middle",
                            alignment_baseline="middle",
                            font_size=60,
                            font_family="serif",
                        )
                    )
            else:
                glyph_group.add(
                    dwg.text(
                        planet_glyph,
                        insert=planet_pos,
                        text_anchor="middle",
                        alignment_baseline="middle",
                        font_size=60,
                        font_family="serif",
                    )
                )
            chart_group.add(glyph_group)

            planet_label_id = f"planet.{planet.name}.label"
            label_override = overrides.get(planet_label_id)
            label_group = dwg.g(id=planet_label_id)
            if label_override:
                label_group.translate(label_override.dx, label_override.dy)
            label_group.add(
                dwg.text(
                    planet.name,
                    insert=label_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=28,
                    font_family="serif",
                )
            )
            chart_group.add(label_group)

        dwg.add(chart_group)
        return dwg.tostring()


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
    )
