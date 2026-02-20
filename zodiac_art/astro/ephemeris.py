"""Ephemeris calculations using pyswisseph."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

import swisseph as swe

from zodiac_art.config import load_config
from zodiac_art.utils.math_utils import normalize_degrees, validate_lat_lon

PLANET_IDS: dict[str, int] = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mercury": swe.MERCURY,
    "Venus": swe.VENUS,
    "Mars": swe.MARS,
    "Jupiter": swe.JUPITER,
    "Saturn": swe.SATURN,
    "Uranus": swe.URANUS,
    "Neptune": swe.NEPTUNE,
    "Pluto": swe.PLUTO,
}


@dataclass(frozen=True)
class EphemerisData:
    """Raw ephemeris results."""

    planet_longitudes: dict[str, float]
    house_cusps: list[float]
    ascendant: float
    midheaven: float


def _init_ephemeris() -> None:
    config = load_config()
    if config.sweph_path:
        swe.set_ephe_path(config.sweph_path)


def _to_utc_datetime(birth_datetime: datetime) -> datetime:
    if birth_datetime.tzinfo is None:
        return birth_datetime.replace(tzinfo=timezone.utc)
    return birth_datetime.astimezone(timezone.utc)


def _julian_day(birth_datetime: datetime) -> float:
    utc_dt = _to_utc_datetime(birth_datetime)
    return swe.julday(
        utc_dt.year,
        utc_dt.month,
        utc_dt.day,
        utc_dt.hour + (utc_dt.minute / 60.0) + (utc_dt.second / 3600.0),
    )


def calculate_ephemeris(
    birth_datetime: datetime,
    latitude: float,
    longitude: float,
) -> EphemerisData:
    """Calculate planet positions and houses for a birth event."""

    if birth_datetime is None:
        raise ValueError("Birth datetime is required.")

    validate_lat_lon(latitude, longitude)
    _init_ephemeris()

    try:
        jd = _julian_day(birth_datetime)
        planet_longitudes: dict[str, float] = {}
        for name, planet_id in PLANET_IDS.items():
            position, _ = swe.calc_ut(jd, planet_id)
            planet_longitudes[name] = normalize_degrees(position[0])

        house_cusps, ascmc = swe.houses(jd, latitude, longitude, b"P")
        ascendant = normalize_degrees(ascmc[0])
        midheaven = normalize_degrees(ascmc[1])

        if len(house_cusps) == 13:
            raw_cusps = house_cusps[1:13]
        else:
            raw_cusps = house_cusps

        cusps = [normalize_degrees(cusp) for cusp in raw_cusps]
        return EphemerisData(
            planet_longitudes=planet_longitudes,
            house_cusps=cusps,
            ascendant=ascendant,
            midheaven=midheaven,
        )
    except swe.SwissEphException as exc:
        raise RuntimeError(f"Ephemeris calculation failed: {exc}") from exc
