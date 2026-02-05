"""Compositor for chart and frame assets."""

from __future__ import annotations

import base64
from dataclasses import dataclass
from pathlib import Path
import cairosvg

from zodiac_art.frames.frame_loader import FrameConfig


@dataclass(frozen=True)
class CompositeOutput:
    """Output paths for composed artwork."""

    svg_path: Path
    png_path: Path


def _encode_png_to_data_uri(png_path: Path) -> str:
    data = png_path.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _strip_xml_declaration(svg_text: str) -> str:
    stripped = svg_text.lstrip()
    if stripped.startswith("<?xml"):
        lines = stripped.splitlines()
        return "\n".join(lines[1:])
    return svg_text


def compose_svg(chart_svg: str, frame_config: FrameConfig) -> str:
    """Compose frame PNG with chart SVG into a single SVG."""
    chart_body = _strip_xml_declaration(chart_svg)
    frame_data_uri = _encode_png_to_data_uri(frame_config.frame_path)
    return (
        f"<svg xmlns='http://www.w3.org/2000/svg' "
        f"width='{frame_config.canvas_width}' height='{frame_config.canvas_height}'>"
        f"<image href='{frame_data_uri}' x='0' y='0' "
        f"width='{frame_config.canvas_width}' height='{frame_config.canvas_height}' />"
        f"<g transform='rotate({frame_config.rotation_deg} {frame_config.chart_center_x} {frame_config.chart_center_y})'>"
        f"{chart_body}"
        "</g>"
        "</svg>"
    )


def export_artwork(
    final_svg: str,
    output_dir: Path,
    output_name: str,
) -> CompositeOutput:
    """Write SVG and PNG outputs to disk."""

    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = output_dir / f"{output_name}.svg"
    png_path = output_dir / f"{output_name}.png"

    svg_path.write_text(final_svg, encoding="utf-8")
    cairosvg.svg2png(bytestring=final_svg.encode("utf-8"), write_to=str(png_path))
    return CompositeOutput(svg_path=svg_path, png_path=png_path)
