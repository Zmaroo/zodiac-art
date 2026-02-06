"""Layout overrides loader."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from zodiac_art.utils.file_utils import load_json


@dataclass(frozen=True)
class LayoutOverrides:
    """Per-element overrides keyed by element id."""

    overrides: dict[str, dict[str, float]]


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

    parsed: dict[str, dict[str, float]] = {}
    for key, value in overrides.items():
        if not isinstance(key, str):
            raise ValueError("Layout override keys must be strings.")
        if not isinstance(value, dict):
            raise ValueError(f"Layout override for {key} must be an object.")
        dx = value.get("dx", 0.0)
        dy = value.get("dy", 0.0)
        if not isinstance(dx, (int, float)) or not isinstance(dy, (int, float)):
            raise ValueError(f"Layout override for {key} requires numeric dx/dy.")
        parsed[key] = {"dx": float(dx), "dy": float(dy)}

    return LayoutOverrides(overrides=parsed)
