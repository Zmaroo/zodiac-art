"""Debug overlay tool for frame alignment."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from zodiac_art.config import load_config
from zodiac_art.frames.frame_loader import FrameAsset, load_frame


def _draw_crosshair(draw: ImageDraw.ImageDraw, center: tuple[float, float]) -> None:
    cx, cy = center
    size = 40
    draw.line((cx - size, cy, cx + size, cy), fill=(255, 0, 0, 255), width=3)
    draw.line((cx, cy - size, cx, cy + size), fill=(255, 0, 0, 255), width=3)


def _draw_ring(
    draw: ImageDraw.ImageDraw,
    center: tuple[float, float],
    radius: float,
    color: tuple[int, int, int, int],
) -> None:
    cx, cy = center
    bounds = (cx - radius, cy - radius, cx + radius, cy + radius)
    draw.ellipse(bounds, outline=color, width=4)


def _draw_label(
    draw: ImageDraw.ImageDraw,
    meta: FrameAsset,
) -> None:
    font = ImageFont.load_default()
    text = (
        f"Frame: {meta.frame_id}\n"
        f"Canvas: {meta.meta.canvas_width}x{meta.meta.canvas_height}\n"
        f"Center: ({meta.meta.chart_center_x:.2f}, {meta.meta.chart_center_y:.2f})\n"
        f"Ring outer: {meta.meta.ring_outer:.2f}\n"
        f"Ring inner: {meta.meta.ring_inner:.2f}\n"
        f"Rotation: {meta.meta.rotation_deg:.2f} deg"
    )
    padding = 8
    bbox = draw.multiline_textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = 16
    y = 16
    draw.rectangle(
        (x - padding, y - padding, x + width + padding, y + height + padding),
        fill=(0, 0, 0, 160),
    )
    draw.multiline_text((x, y), text, fill=(255, 255, 255, 255), font=font)


def generate_debug_overlay(
    frame_id: str,
    output_path: Path,
    show_labels: bool = True,
) -> Path:
    """Generate a debug overlay preview for a frame."""

    asset = load_frame(frame_id)
    image = asset.image or Image.open(asset.image_path)
    base = image.convert("RGBA")
    draw = ImageDraw.Draw(base)

    center = (asset.meta.chart_center_x, asset.meta.chart_center_y)
    _draw_crosshair(draw, center)
    _draw_ring(draw, center, asset.meta.ring_outer, (0, 255, 0, 255))
    _draw_ring(draw, center, asset.meta.ring_inner, (0, 128, 255, 255))

    if show_labels:
        _draw_label(draw, asset)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    base.save(output_path, format="PNG")
    return output_path


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Frame debug overlay generator")
    parser.add_argument("--frame", required=True, type=str, help="Frame id")
    parser.add_argument("--out", type=str, help="Output PNG path")
    parser.add_argument("--no-labels", action="store_true", help="Disable text labels")
    parser.add_argument("--show", action="store_true", help="Open output after writing")
    return parser.parse_args(argv)


def main(argv: list[str]) -> None:
    args = _parse_args(argv)
    config = load_config()
    output_path = (
        Path(args.out)
        if args.out
        else config.output_dir / f"{args.frame}_debug.png"
    )
    result = generate_debug_overlay(
        frame_id=args.frame,
        output_path=output_path,
        show_labels=not args.no_labels,
    )
    print(f"Debug overlay written to: {result}")
    if args.show:
        Image.open(result).show()


if __name__ == "__main__":
    import sys

    main(sys.argv[1:])
