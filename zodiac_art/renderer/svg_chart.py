"""SVG chart renderer."""

from __future__ import annotations

from dataclasses import dataclass
import svgwrite

from zodiac_art.config import load_config
from zodiac_art.models.chart_models import Chart
from zodiac_art.renderer.geometry import arc_path, longitude_to_angle, polar_to_cartesian
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


class SvgChartRenderer:
    """Render a Chart into an SVG string."""

    def __init__(
        self,
        settings: RenderSettings,
    ) -> None:
        self.settings = settings

    def render(self, chart: Chart) -> str:
        """Render the chart into an SVG string."""

        dwg = svgwrite.Drawing(
            size=(self.settings.width, self.settings.height),
            profile="full",
        )
        dwg.viewbox(0, 0, self.settings.width, self.settings.height)

        center = (self.settings.center_x, self.settings.center_y)
        outer_radius = self.settings.radius * self.settings.sign_ring_outer_ratio
        inner_radius = self.settings.radius * self.settings.sign_ring_inner_ratio
        planet_radius = self.settings.radius * self.settings.planet_ring_ratio
        label_radius = self.settings.radius * self.settings.label_ring_ratio
        label_offset = self.settings.radius * self.settings.planet_label_offset_ratio

        for index, house in enumerate(chart.houses):
            start_angle = longitude_to_angle(house.cusp_longitude)
            end_longitude = chart.houses[(index + 1) % 12].cusp_longitude
            end_angle = longitude_to_angle(end_longitude)
            dwg.add(
                dwg.path(
                    d=arc_path(center[0], center[1], outer_radius, start_angle, end_angle),
                    fill="none",
                    stroke="#1f1f1f",
                    stroke_width=3,
                )
            )
            dwg.add(
                dwg.path(
                    d=arc_path(center[0], center[1], inner_radius, start_angle, end_angle),
                    fill="none",
                    stroke="#1f1f1f",
                    stroke_width=3,
                )
            )

            mid_angle = longitude_to_angle((house.cusp_longitude + end_longitude) / 2)
            label_pos = polar_to_cartesian(center[0], center[1], label_radius, mid_angle)
            dwg.add(
                dwg.text(
                    get_zodiac_glyph(house.sign),
                    insert=label_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=56,
                    font_family="serif",
                )
            )

        for house in chart.houses:
            angle = longitude_to_angle(house.cusp_longitude)
            line_end = polar_to_cartesian(center[0], center[1], inner_radius, angle)
            dwg.add(
                dwg.line(
                    start=center,
                    end=line_end,
                    stroke="#3a3a3a",
                    stroke_width=2,
                )
            )

        for planet in chart.planets:
            angle = longitude_to_angle(planet.longitude)
            planet_pos = polar_to_cartesian(center[0], center[1], planet_radius, angle)
            label_pos = polar_to_cartesian(
                center[0], center[1], planet_radius + label_offset, angle
            )
            dwg.add(
                dwg.text(
                    get_planet_glyph(planet.name),
                    insert=planet_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=60,
                    font_family="serif",
                )
            )
            dwg.add(
                dwg.text(
                    planet.name,
                    insert=label_pos,
                    text_anchor="middle",
                    alignment_baseline="middle",
                    font_size=28,
                    font_family="serif",
                )
            )

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
