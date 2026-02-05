"""Math utilities used across the project."""

from __future__ import annotations

from math import fmod


def normalize_degrees(value: float) -> float:
    """Normalize an angle to the range [0, 360)."""

    result = fmod(value, 360.0)
    return result + 360.0 if result < 0 else result


def validate_lat_lon(latitude: float, longitude: float) -> None:
    """Validate geographic coordinates."""

    if not -90.0 <= latitude <= 90.0:
        raise ValueError("Latitude must be between -90 and 90.")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError("Longitude must be between -180 and 180.")
