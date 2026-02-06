"""Glyph-to-path helpers for SVG rendering."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Final, cast
from xml.sax.saxutils import escape

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

from zodiac_art.config import ASSETS_DIR, GLYPH_FONT_PATH

_FALLBACK_FILL: Final[str] = "#000"


@dataclass(frozen=True)
class GlyphPath:
    """Path data and bounds for a glyph."""

    d: str
    bbox: tuple[float, float, float, float]
    units_per_em: int


@lru_cache(maxsize=1)
def _load_font() -> TTFont:
    if not GLYPH_FONT_PATH.exists():
        raise FileNotFoundError(f"Glyph font not found: {GLYPH_FONT_PATH}")
    return TTFont(str(GLYPH_FONT_PATH))


@lru_cache(maxsize=1)
def _load_fallback_font() -> TTFont | None:
    fallback_path = ASSETS_DIR / "fonts" / "NotoSansSymbols-VariableFont_wght.ttf"
    if not fallback_path.exists():
        return None
    return TTFont(str(fallback_path))


@lru_cache(maxsize=1)
def _glyph_map() -> dict[int, str]:
    return _load_font().getBestCmap() or {}


@lru_cache(maxsize=1)
def _fallback_glyph_map() -> dict[int, str]:
    font = _load_fallback_font()
    if not font:
        return {}
    return font.getBestCmap() or {}


@lru_cache(maxsize=1)
def _glyph_set():
    return _load_font().getGlyphSet()


@lru_cache(maxsize=1)
def _fallback_glyph_set():
    font = _load_fallback_font()
    if not font:
        return None
    return font.getGlyphSet()


_GLYPH_CACHE: dict[str, GlyphPath | None] = {}


def _build_glyph_path(
    glyph_name: str,
    glyph_set,
    units_per_em: int,
) -> GlyphPath | None:
    glyph = glyph_set[glyph_name]
    pen = SVGPathPen(glyph_set)
    glyph.draw(pen)
    d = pen.getCommands()
    bounds_pen = BoundsPen(glyph_set)
    glyph.draw(bounds_pen)
    bbox = bounds_pen.bounds
    if not d or bbox is None:
        return None
    return GlyphPath(d=d, bbox=bbox, units_per_em=units_per_em)


def get_glyph_path(char: str) -> GlyphPath | None:
    """Return SVG path data and bbox for a glyph char."""

    if char in _GLYPH_CACHE:
        return _GLYPH_CACHE[char]

    cmap = _glyph_map()
    glyph_name = cmap.get(ord(char))
    if glyph_name:
        font = _load_font()
        units_per_em = int(cast(Any, font["head"]).unitsPerEm)
        path = _build_glyph_path(glyph_name, _glyph_set(), units_per_em)
        _GLYPH_CACHE[char] = path
        return path

    fallback_cmap = _fallback_glyph_map()
    fallback_name = fallback_cmap.get(ord(char))
    if fallback_name:
        fallback_font = _load_fallback_font()
        fallback_set = _fallback_glyph_set()
        if fallback_font and fallback_set:
            units_per_em = int(cast(Any, fallback_font["head"]).unitsPerEm)
            path = _build_glyph_path(fallback_name, fallback_set, units_per_em)
            _GLYPH_CACHE[char] = path
            return path

    _GLYPH_CACHE[char] = None
    return None


def glyph_path_data(
    char: str,
    x: float,
    y: float,
    size_px: float,
) -> tuple[str, str] | None:
    """Return (path_d, transform) for a glyph centered at (x, y)."""

    glyph = get_glyph_path(char)
    if not glyph:
        return None

    scale = size_px / glyph.units_per_em
    xmin, ymin, xmax, ymax = glyph.bbox
    cx = (xmin + xmax) / 2
    cy = (ymin + ymax) / 2
    transform = (
        f"translate({x:.3f} {y:.3f}) "
        f"scale({scale:.6f} {-scale:.6f}) "
        f"translate({-cx:.3f} {-cy:.3f})"
    )
    return glyph.d, transform


def glyph_path_element(
    char: str,
    x: float,
    y: float,
    size_px: float,
    fill: str = _FALLBACK_FILL,
) -> str:
    """Return an SVG <path> element string or <text> fallback."""

    data = glyph_path_data(char, x, y, size_px)
    if data:
        d, transform = data
        return (
            f"<path d=\"{d}\" transform=\"{transform}\" "
            f"fill=\"{fill}\" />"
        )

    fallback = escape(char)
    return (
        f"<text x=\"{x:.3f}\" y=\"{y:.3f}\" "
        f"text-anchor=\"middle\" alignment-baseline=\"middle\" "
        f"font-size=\"{size_px:.2f}\" fill=\"{fill}\">"
        f"{fallback}</text>"
    )
