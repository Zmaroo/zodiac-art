"""Simple font rendering smoke test."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from zodiac_art.config import ASSETS_DIR, GLYPH_FONT_PATH


def main() -> None:
    root_dir = ASSETS_DIR.parent
    output_dir = root_dir / "out"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "font_test.png"
    try:
        primary_font = ImageFont.truetype(str(GLYPH_FONT_PATH), size=64)
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            f"Failed to load glyph font at {GLYPH_FONT_PATH}."
        ) from exc

    fallback_path = ASSETS_DIR / "fonts" / "NotoSansSymbols2-Regular.ttf"
    fallback_font = (
        ImageFont.truetype(str(fallback_path), size=64)
        if fallback_path.exists()
        else None
    )

    def mask_bytes(font: ImageFont.FreeTypeFont, text: str) -> bytes:
        return bytes(font.getmask(text))  # type: ignore[arg-type]

    missing_mask = mask_bytes(primary_font, "\ufffd")

    def choose_font(text: str) -> ImageFont.FreeTypeFont:
        if mask_bytes(primary_font, text) != missing_mask:
            return primary_font
        return fallback_font or primary_font

    text = "☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓"
    image = Image.new("RGBA", (1600, 200), (255, 255, 255, 255))
    draw = ImageDraw.Draw(image)
    x = 24
    y = 60
    for char in text:
        font = choose_font(char)
        draw.text((x, y), char, fill=(0, 0, 0, 255), font=font)
        x += int(font.getlength(char))
    image.save(output_path)
    print(f"OK: wrote {output_path}")


if __name__ == "__main__":
    main()
