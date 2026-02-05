"""Glyph mappings for zodiac signs and planets."""

from __future__ import annotations

from zodiac_art.config import load_config


ZODIAC_GLYPHS_UNICODE: dict[str, str] = {
    "Aries": "♈",
    "Taurus": "♉",
    "Gemini": "♊",
    "Cancer": "♋",
    "Leo": "♌",
    "Virgo": "♍",
    "Libra": "♎",
    "Scorpio": "♏",
    "Sagittarius": "♐",
    "Capricorn": "♑",
    "Aquarius": "♒",
    "Pisces": "♓",
}

PLANET_GLYPHS_UNICODE: dict[str, str] = {
    "Sun": "☉",
    "Moon": "☾",
    "Mercury": "☿",
    "Venus": "♀",
    "Mars": "♂",
    "Jupiter": "♃",
    "Saturn": "♄",
    "Uranus": "♅",
    "Neptune": "♆",
    "Pluto": "♇",
}

ZODIAC_GLYPHS_ASCII = {key: key.upper() for key in ZODIAC_GLYPHS_UNICODE}
PLANET_GLYPHS_ASCII = {key: key.upper() for key in PLANET_GLYPHS_UNICODE}


def get_zodiac_glyph(sign: str) -> str:
    """Return a glyph for the sign based on config."""

    config = load_config()
    if config.glyph_mode == "ascii":
        return ZODIAC_GLYPHS_ASCII.get(sign, sign.upper())
    return ZODIAC_GLYPHS_UNICODE.get(sign, sign)


def get_planet_glyph(planet: str) -> str:
    """Return a glyph for the planet based on config."""

    config = load_config()
    if config.glyph_mode == "ascii":
        return PLANET_GLYPHS_ASCII.get(planet, planet.upper())
    return PLANET_GLYPHS_UNICODE.get(planet, planet)
