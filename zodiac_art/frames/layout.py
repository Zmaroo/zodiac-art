"""Layout overrides loader."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from zodiac_art.utils.file_utils import load_json


@dataclass(frozen=True)
class LayoutOverrides:
    """Per-element overrides keyed by element id."""

    overrides: dict[str, dict[str, float | str]]


def load_layout(frame_dir: Path) -> LayoutOverrides:
    """Load layout.json overrides from a frame directory if present."""

    layout_path = frame_dir / "layout.json"
    if not layout_path.exists():
        return LayoutOverrides(overrides={})

    data = load_json(layout_path)
    if not isinstance(data, dict):
        raise ValueError(f"Layout file must be an object: {layout_path}")
    overrides = data.get("overrides", {})
    if not isinstance(overrides, dict):
        raise ValueError(f"Layout overrides must be an object: {layout_path}")

    parsed: dict[str, dict[str, float | str]] = {}
    for key, value in overrides.items():
        if not isinstance(key, str):
            raise ValueError("Layout override keys must be strings.")
        if not isinstance(value, dict):
            raise ValueError(f"Layout override for {key} must be an object.")
        parsed_entry: dict[str, float | str] = {}
        if "dx" in value or "dy" in value:
            dx = value.get("dx", 0.0)
            dy = value.get("dy", 0.0)
            if not isinstance(dx, (int, float)) or not isinstance(dy, (int, float)):
                raise ValueError(f"Layout override for {key} requires numeric dx/dy.")
            parsed_entry["dx"] = float(dx)
            parsed_entry["dy"] = float(dy)
        if "dr" in value or "dt" in value:
            dr = value.get("dr", 0.0)
            dt = value.get("dt", 0.0)
            if not isinstance(dr, (int, float)) or not isinstance(dt, (int, float)):
                raise ValueError(f"Layout override for {key} requires numeric dr/dt.")
            parsed_entry["dr"] = float(dr)
            parsed_entry["dt"] = float(dt)
        if "color" in value:
            color = value.get("color")
            if not isinstance(color, str):
                raise ValueError(f"Layout override for {key} requires color string.")
            parsed_entry["color"] = color
        if not parsed_entry:
            parsed_entry = {"dx": 0.0, "dy": 0.0}
        parsed[key] = parsed_entry

    return LayoutOverrides(overrides=parsed)
