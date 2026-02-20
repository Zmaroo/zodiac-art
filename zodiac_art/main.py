"""CLI entry point for Zodiac Art Generator."""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime

from zodiac_art.api.rendering import render_chart_svg
from zodiac_art.api.storage import FileStorage
from zodiac_art.api.storage_async import AsyncFileStorage
from zodiac_art.astro.chart_builder import build_chart
from zodiac_art.astro.ephemeris import calculate_ephemeris
from zodiac_art.compositor.compositor import compose_svg, export_artwork
from zodiac_art.config import load_config
from zodiac_art.frames.debug_overlay import generate_debug_overlay
from zodiac_art.frames.frame_loader import load_frame
from zodiac_art.frames.layout import load_layout
from zodiac_art.frames.registry import list_frames
from zodiac_art.renderer.svg_chart import (
    ChartFit,
    ElementOverride,
    RenderSettings,
    SvgChartRenderer,
)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Zodiac Art Generator")
    parser.add_argument("--birth-date", type=str, help="Birth date YYYY-MM-DD")
    parser.add_argument("--birth-time", type=str, help="Birth time HH:MM")
    parser.add_argument("--latitude", type=float, help="Latitude")
    parser.add_argument("--longitude", type=float, help="Longitude")
    parser.add_argument("--frame", type=str, default="default", help="Frame name")
    parser.add_argument("--chart-id", type=str, help="Chart id to load")
    parser.add_argument(
        "--output-name",
        type=str,
        default="zodiac_art",
        help="Output file base name",
    )
    parser.add_argument("--list-frames", action="store_true", help="List available frames")
    parser.add_argument(
        "--debug-frame",
        type=str,
        help="Generate debug overlay for a frame id",
    )
    return parser.parse_args(argv)


def _parse_datetime(date_str: str, time_str: str) -> datetime:
    if not date_str or not time_str:
        raise ValueError("Birth date and time are required.")
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")


def _build_renderer_settings(frame_meta) -> RenderSettings:
    config = load_config()
    if frame_meta.ring_outer <= 0:
        raise ValueError("Frame ring outer radius must be positive.")
    inner_ratio = frame_meta.ring_inner / frame_meta.ring_outer
    return RenderSettings(
        width=frame_meta.canvas_width,
        height=frame_meta.canvas_height,
        center_x=frame_meta.chart_center_x,
        center_y=frame_meta.chart_center_y,
        radius=frame_meta.ring_outer,
        sign_ring_inner_ratio=inner_ratio,
        sign_ring_outer_ratio=1.0,
        planet_ring_ratio=config.planet_ring_ratio,
        label_ring_ratio=config.label_ring_ratio,
        planet_label_offset_ratio=config.planet_label_offset_ratio,
        font_scale=1.0,
    )


def run_pipeline(
    birth_date: str,
    birth_time: str,
    latitude: float,
    longitude: float,
    frame_name: str,
    output_name: str,
) -> None:
    config = load_config()
    if latitude is None or longitude is None:
        raise ValueError("Latitude and longitude are required.")
    birth_datetime = _parse_datetime(birth_date, birth_time)

    frame_asset = load_frame(frame_name)
    layout = load_layout(frame_asset.frame_dir)
    ephemeris = calculate_ephemeris(birth_datetime, latitude, longitude)
    chart = build_chart(
        ephemeris.planet_longitudes,
        ephemeris.house_cusps,
        ephemeris.ascendant,
        ephemeris.midheaven,
    )

    settings = _build_renderer_settings(frame_asset.meta)
    renderer = SvgChartRenderer(settings)
    chart_fit = ChartFit(
        dx=frame_asset.meta.chart_fit_dx,
        dy=frame_asset.meta.chart_fit_dy,
        scale=frame_asset.meta.chart_fit_scale,
        rotation_deg=frame_asset.meta.chart_fit_rotation_deg,
    )
    overrides: dict[str, ElementOverride] = {}
    for key, value in layout.overrides.items():
        overrides[key] = ElementOverride(
            dx=value.get("dx", 0.0),
            dy=value.get("dy", 0.0),
            dr=value.get("dr"),
            dt=value.get("dt"),
            color=value.get("color"),
        )
    chart_svg = renderer.render(chart, global_transform=chart_fit, overrides=overrides)
    final_svg = compose_svg(chart_svg, frame_asset)
    output = export_artwork(final_svg, config.output_dir, output_name)

    print(f"SVG output: {output.svg_path}")
    print(f"PNG output: {output.png_path}")


def run_chart_id_pipeline(chart_id: str, frame_name: str | None, output_name: str) -> None:
    storage = FileStorage()
    if not storage.chart_exists(chart_id):
        raise ValueError(f"Chart id not found: {chart_id}")
    record = storage.load_chart(chart_id)
    frame_id = frame_name
    if frame_id == "default" and record.default_frame_id:
        frame_id = record.default_frame_id
    if not frame_id:
        raise ValueError("Frame id is required when chart has no default frame.")
    async_storage = AsyncFileStorage(storage)
    result = asyncio.run(render_chart_svg(async_storage, record, frame_id))
    config = load_config()
    output = export_artwork(result.svg, config.output_dir, output_name)
    print(f"SVG output: {output.svg_path}")
    print(f"PNG output: {output.png_path}")


def example_run() -> None:
    run_pipeline(
        birth_date="1990-04-12",
        birth_time="08:45",
        latitude=40.7128,
        longitude=-74.0060,
        frame_name="default",
        output_name="example_zodiac_art",
    )


def main(argv: list[str]) -> None:
    args = _parse_args(argv)
    try:
        if args.chart_id:
            run_chart_id_pipeline(args.chart_id, args.frame, args.output_name)
            return
        if args.list_frames:
            frames = list_frames()
            if not frames:
                print("No frames found.")
            else:
                for entry in frames:
                    print(entry.frame_id)
            return
        if args.debug_frame:
            config = load_config()
            output_path = config.output_dir / f"{args.debug_frame}_debug.png"
            generate_debug_overlay(args.debug_frame, output_path)
            print(f"Debug overlay written to: {output_path}")
            return
        if not args.birth_date:
            example_run()
            return
        run_pipeline(
            birth_date=args.birth_date,
            birth_time=args.birth_time,
            latitude=args.latitude,
            longitude=args.longitude,
            frame_name=args.frame,
            output_name=args.output_name,
        )
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
