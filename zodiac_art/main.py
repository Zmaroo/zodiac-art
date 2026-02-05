"""CLI entry point for Zodiac Art Generator."""

from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

from zodiac_art.astro.chart_builder import build_chart
from zodiac_art.astro.ephemeris import calculate_ephemeris
from zodiac_art.compositor.compositor import compose_svg, export_artwork
from zodiac_art.config import load_config
from zodiac_art.frames.frame_loader import load_frame
from zodiac_art.renderer.svg_chart import RenderSettings, SvgChartRenderer


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Zodiac Art Generator")
    parser.add_argument("--birth-date", type=str, help="Birth date YYYY-MM-DD")
    parser.add_argument("--birth-time", type=str, help="Birth time HH:MM")
    parser.add_argument("--latitude", type=float, help="Latitude")
    parser.add_argument("--longitude", type=float, help="Longitude")
    parser.add_argument("--frame", type=str, default="default", help="Frame name")
    parser.add_argument("--output-name", type=str, default="zodiac_art", help="Output file base name")
    return parser.parse_args(argv)


def _parse_datetime(date_str: str, time_str: str) -> datetime:
    if not date_str or not time_str:
        raise ValueError("Birth date and time are required.")
    return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")


def _build_renderer_settings(frame_config) -> RenderSettings:
    config = load_config()
    if frame_config.ring_outer <= 0:
        raise ValueError("Frame ring outer radius must be positive.")
    inner_ratio = frame_config.ring_inner / frame_config.ring_outer
    return RenderSettings(
        width=frame_config.canvas_width,
        height=frame_config.canvas_height,
        center_x=frame_config.chart_center_x,
        center_y=frame_config.chart_center_y,
        radius=frame_config.ring_outer,
        sign_ring_inner_ratio=inner_ratio,
        sign_ring_outer_ratio=1.0,
        planet_ring_ratio=config.planet_ring_ratio,
        label_ring_ratio=config.label_ring_ratio,
        planet_label_offset_ratio=config.planet_label_offset_ratio,
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

    frame_config = load_frame(config.frame_dir, frame_name)
    ephemeris = calculate_ephemeris(birth_datetime, latitude, longitude)
    chart = build_chart(
        ephemeris.planet_longitudes,
        ephemeris.house_cusps,
        ephemeris.ascendant,
        ephemeris.midheaven,
    )

    renderer = SvgChartRenderer(_build_renderer_settings(frame_config))
    chart_svg = renderer.render(chart)
    final_svg = compose_svg(chart_svg, frame_config)
    output = export_artwork(final_svg, config.output_dir, output_name)

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
