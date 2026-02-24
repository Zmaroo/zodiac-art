"""Compositor for chart and frame assets."""

from __future__ import annotations

import base64
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from zodiac_art.frames.frame_loader import FrameAsset, FrameMeta


@dataclass(frozen=True)
class CompositeOutput:
    """Output paths for composed artwork."""

    svg_path: Path
    png_path: Path


def _encode_image_to_data_uri(image_path: Path) -> str:
    data = image_path.read_bytes()
    encoded = base64.b64encode(data).decode("ascii")
    suffix = image_path.suffix.lower()
    mime_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }.get(suffix, "application/octet-stream")
    return f"data:{mime_type};base64,{encoded}"


def _strip_xml_declaration(svg_text: str) -> str:
    stripped = svg_text.lstrip()
    if stripped.startswith("<?xml"):
        lines = stripped.splitlines()
        return "\n".join(lines[1:])
    return svg_text


def _background_image_layer(
    image_path: Path,
    meta: FrameMeta,
    embed_data_uri: bool,
    scale: float,
    dx: float,
    dy: float,
    clip_id: str = "chartBackgroundImageClip",
) -> tuple[str, str]:
    href = _encode_image_to_data_uri(image_path) if embed_data_uri else image_path.as_posix()
    defs_markup = (
        f"<clipPath id='{clip_id}'>"
        f"<circle cx='{meta.chart_center_x}' cy='{meta.chart_center_y}' r='{meta.ring_outer}' />"
        "</clipPath>"
    )
    layer_markup = (
        f"<g clip-path='url(#{clip_id})'>"
        f"<image href='{href}' x='{dx:.3f}' y='{dy:.3f}' "
        f"width='{meta.canvas_width * scale:.3f}' height='{meta.canvas_height * scale:.3f}' />"
        "</g>"
    )
    return defs_markup, layer_markup


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _remove_child_by_id(root: ET.Element, element_id: str) -> ET.Element | None:
    for parent in root.iter():
        for child in list(parent):
            if child.get("id") == element_id:
                parent.remove(child)
                return child
    return None


def _extract_chart_layers(chart_svg: str) -> tuple[str, str | None, str | None]:
    try:
        root = ET.fromstring(chart_svg)
    except ET.ParseError:
        return "", None, _strip_xml_declaration(chart_svg)
    defs_markup = ""
    for child in list(root):
        if _local_name(child.tag) == "defs":
            defs_markup = ET.tostring(child, encoding="unicode")
            break
    chart_root = None
    for element in root.iter():
        if element.get("id") == "chartRoot":
            chart_root = element
            break
    if chart_root is None:
        return defs_markup, None, _strip_xml_declaration(chart_svg)
    background = _remove_child_by_id(chart_root, "chart.background")
    chart_markup = ET.tostring(chart_root, encoding="unicode")
    if background is None:
        return defs_markup, None, chart_markup
    background_markup = ET.tostring(background, encoding="unicode")
    transform = chart_root.get("transform")
    clip_path = chart_root.get("clip-path")
    wrapper_attrs = []
    if transform:
        wrapper_attrs.append(f"transform='{transform}'")
    if clip_path:
        wrapper_attrs.append(f"clip-path='{clip_path}'")
    if wrapper_attrs:
        background_markup = f"<g {' '.join(wrapper_attrs)}>{background_markup}</g>"
    return defs_markup, background_markup, chart_markup


def compose_svg(
    chart_svg: str,
    frame_asset: FrameAsset | None,
    embed_frame_data_uri: bool = True,
    layer_order: tuple[str, ...] | None = None,
    layer_opacity: dict[str, float] | None = None,
    background_image_path: Path | None = None,
    background_image_transform: tuple[float, float, float] | None = None,
    meta_override: FrameMeta | None = None,
) -> str:
    """Compose frame PNG with chart SVG into a single SVG."""
    if layer_order is None:
        layer_order = ("background", "frame", "chart")
    meta = frame_asset.meta if frame_asset else meta_override
    if meta is None:
        raise ValueError("Frame metadata is required to compose SVG layers.")
    defs_markup, background_markup, chart_markup = _extract_chart_layers(chart_svg)
    if chart_markup is None:
        chart_markup = _strip_xml_declaration(chart_svg)
    frame_markup = None
    if frame_asset is not None:
        frame_href = (
            _encode_image_to_data_uri(frame_asset.image_path)
            if embed_frame_data_uri
            else frame_asset.image_path.as_posix()
        )
        frame_markup = (
            f"<image href='{frame_href}' x='0' y='0' "
            f"width='{meta.canvas_width}' height='{meta.canvas_height}' />"
        )
    rotate_group = f"rotate({meta.rotation_deg} {meta.chart_center_x} {meta.chart_center_y})"
    if layer_opacity is None:
        layer_opacity = {}
    background_image_defs = ""
    background_image_markup = None
    if background_image_path is not None:
        scale, dx, dy = background_image_transform or (1.0, 0.0, 0.0)
        background_image_defs, background_image_markup = _background_image_layer(
            background_image_path,
            meta,
            embed_frame_data_uri,
            scale,
            dx,
            dy,
        )
    layer_map = {
        "background": background_markup,
        "chart_background_image": background_image_markup,
        "frame": frame_markup,
        "chart": chart_markup,
    }
    layer_blocks: list[str] = []
    for key in layer_order:
        layer = layer_map.get(key)
        if not layer:
            continue
        if key in {"background", "chart", "chart_background_image"}:
            layer = f"<g transform='{rotate_group}'>{layer}</g>"
        opacity = layer_opacity.get(key)
        if opacity is not None and 0 <= opacity <= 1 and opacity != 1:
            layer = f"<g opacity='{opacity:.3f}'>{layer}</g>"
        layer_blocks.append(layer)
    if background_image_defs:
        if defs_markup:
            defs_markup = defs_markup.replace("</defs>", f"{background_image_defs}</defs>")
        else:
            defs_markup = f"<defs>{background_image_defs}</defs>"
    return (
        f"<svg xmlns='http://www.w3.org/2000/svg' "
        f"width='{meta.canvas_width}' height='{meta.canvas_height}'>"
        f"{defs_markup}"
        f"{''.join(layer_blocks)}"
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
    import cairosvg

    cairosvg.svg2png(bytestring=final_svg.encode("utf-8"), write_to=str(png_path))
    return CompositeOutput(svg_path=svg_path, png_path=png_path)
