"""Geometry helpers for SVG rendering."""

from __future__ import annotations

import math
from zodiac_art.utils.math_utils import normalize_degrees


def longitude_to_angle(longitude_deg: float) -> float:
    """Convert ecliptic longitude to SVG angle degrees.

    0 degrees Aries is placed at the top of the chart.
    """

    return normalize_degrees(longitude_deg - 90.0)


def polar_to_cartesian(
    center_x: float,
    center_y: float,
    radius: float,
    angle_deg: float,
) -> tuple[float, float]:
    """Convert polar coordinates to Cartesian SVG coordinates."""

    angle_rad = math.radians(angle_deg)
    x = center_x + radius * math.cos(angle_rad)
    y = center_y + radius * math.sin(angle_rad)
    return x, y


def arc_path(
    center_x: float,
    center_y: float,
    radius: float,
    start_angle: float,
    end_angle: float,
) -> str:
    """Create an SVG arc path string."""

    start = polar_to_cartesian(center_x, center_y, radius, end_angle)
    end = polar_to_cartesian(center_x, center_y, radius, start_angle)
    large_arc = 1 if (end_angle - start_angle) % 360 > 180 else 0
    return (
        f"M {start[0]:.2f} {start[1]:.2f} "
        f"A {radius:.2f} {radius:.2f} 0 {large_arc} 0 {end[0]:.2f} {end[1]:.2f}"
    )
