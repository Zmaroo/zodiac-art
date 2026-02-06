"""Application configuration defaults."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = PROJECT_ROOT / "assets"
GLYPH_FONT_PATH = ASSETS_DIR / "fonts" / "NotoSansSymbols2-Regular.ttf"
LABEL_FONT_PATH: Path | None = None


@dataclass(frozen=True)
class AppConfig:
    """Configuration values for the Zodiac Art Generator."""

    glyph_mode: str = "path"
    frame_dir: Path = Path("frames")
    output_dir: Path = Path("output")
    canvas_width: int = 4500
    canvas_height: int = 5400
    sign_ring_outer_ratio: float = 1.0
    sign_ring_inner_ratio: float = 0.85
    planet_ring_ratio: float = 0.75
    label_ring_ratio: float = 0.92
    planet_label_offset_ratio: float = 0.08
    sweph_path: str | None = None


def load_config() -> AppConfig:
    """Load configuration, applying environment overrides."""
    config = AppConfig()
    sweph_path = os.environ.get("SWEPH_PATH")
    if sweph_path:
        return AppConfig(
            glyph_mode=config.glyph_mode,
            frame_dir=config.frame_dir,
            output_dir=config.output_dir,
            canvas_width=config.canvas_width,
            canvas_height=config.canvas_height,
            sign_ring_outer_ratio=config.sign_ring_outer_ratio,
            sign_ring_inner_ratio=config.sign_ring_inner_ratio,
            planet_ring_ratio=config.planet_ring_ratio,
            label_ring_ratio=config.label_ring_ratio,
            planet_label_offset_ratio=config.planet_label_offset_ratio,
            sweph_path=sweph_path,
        )
    return config
