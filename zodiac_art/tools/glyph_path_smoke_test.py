"""Glyph path smoke test."""

from __future__ import annotations

from zodiac_art.config import ASSETS_DIR
from zodiac_art.renderer.glyph_paths import glyph_path_element


def main() -> None:
    glyphs = "☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓"
    output_dir = ASSETS_DIR.parent / "out"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "glyph_paths.svg"

    x = 40.0
    y = 90.0
    size = 64.0
    elements: list[str] = []
    for char in glyphs.split():
        elements.append(glyph_path_element(char, x, y, size))
        x += size * 0.9

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="200">'
        '<rect width="100%" height="100%" fill="white" />'
        f"{''.join(elements)}"
        "</svg>"
    )
    output_path.write_text(svg, encoding="utf-8")
    print(f"OK: wrote {output_path}")


if __name__ == "__main__":
    main()
