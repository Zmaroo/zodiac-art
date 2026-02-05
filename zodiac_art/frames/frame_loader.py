"""Frame loading and validation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from zodiac_art.utils.file_utils import load_json


@dataclass(frozen=True)
class FrameConfig:
    """Configuration describing frame alignment."""

    frame_path: Path
    canvas_width: int
    canvas_height: int
    chart_center_x: float
    chart_center_y: float
    ring_outer: float
    ring_inner: float
    rotation_deg: float


def load_frame(frame_dir: Path, frame_name: str) -> FrameConfig:
    """Load frame PNG and JSON metadata."""

    json_path = frame_dir / f"{frame_name}.json"
    png_path = frame_dir / f"{frame_name}.png"

    if not png_path.exists():
        raise FileNotFoundError(f"Frame PNG not found: {png_path}")

    data = load_json(json_path)
    canvas = data.get("canvas")
    chart = data.get("chart")
    if not canvas or not chart:
        raise ValueError("Frame metadata missing required 'canvas' or 'chart'.")

    center = chart.get("center")
    if not center:
        raise ValueError("Frame metadata missing chart center.")

    return FrameConfig(
        frame_path=png_path,
        canvas_width=int(canvas["width"]),
        canvas_height=int(canvas["height"]),
        chart_center_x=float(center["x"]),
        chart_center_y=float(center["y"]),
        ring_outer=float(chart["ring_outer"]),
        ring_inner=float(chart["ring_inner"]),
        rotation_deg=float(chart.get("rotation_deg", 0.0)),
    )
