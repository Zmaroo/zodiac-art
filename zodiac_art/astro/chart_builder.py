"""Build structured chart objects from raw ephemeris data."""

from __future__ import annotations

from zodiac_art.models.chart_models import Chart, House, PlanetPlacement
from zodiac_art.utils.math_utils import normalize_degrees


SIGNS = [
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


def _longitude_to_sign(longitude: float) -> str:
    index = int(normalize_degrees(longitude) // 30)
    return SIGNS[index]


def _find_house(longitude: float, house_cusps: list[float]) -> int:
    lon = normalize_degrees(longitude)
    for index in range(12):
        start = house_cusps[index]
        end = house_cusps[(index + 1) % 12]
        if start <= end:
            if start <= lon < end:
                return index + 1
        else:
            if lon >= start or lon < end:
                return index + 1
    return 12


def build_chart(
    planet_longitudes: dict[str, float],
    house_cusps: list[float],
    ascendant: float,
    midheaven: float,
) -> Chart:
    """Create a chart dataclass from ephemeris results."""

    if not planet_longitudes:
        raise ValueError("Planet longitudes are required.")
    if len(house_cusps) != 12:
        raise ValueError("House cusps must contain 12 values.")

    houses = [
        House(
            number=index + 1,
            cusp_longitude=house_cusps[index],
            sign=_longitude_to_sign(house_cusps[index]),
        )
        for index in range(12)
    ]

    planets = []
    for name, longitude in planet_longitudes.items():
        planets.append(
            PlanetPlacement(
                name=name,
                longitude=longitude,
                sign=_longitude_to_sign(longitude),
                house=_find_house(longitude, house_cusps),
            )
        )

    return Chart(
        planets=planets,
        houses=houses,
        ascendant=normalize_degrees(ascendant),
        midheaven=normalize_degrees(midheaven),
    )
