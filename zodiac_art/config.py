"""Application configuration defaults."""

from __future__ import annotations

from dataclasses import dataclass
import os
from urllib.parse import quote_plus
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = PROJECT_ROOT / "assets"
STORAGE_ROOT = PROJECT_ROOT / "storage"
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


def build_database_url() -> str | None:
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return database_url
    env_keys = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]
    if not any(os.environ.get(key) for key in env_keys):
        return None
    host = os.environ.get("PGHOST", "127.0.0.1")
    port = os.environ.get("PGPORT", "5432")
    user = os.environ.get("PGUSER")
    password = os.environ.get("PGPASSWORD")
    database = os.environ.get("PGDATABASE", "zodiac_art")
    if user:
        auth = quote_plus(user)
        if password:
            auth = f"{auth}:{quote_plus(password)}"
        return f"postgresql://{auth}@{host}:{port}/{database}"
    return f"postgresql://{host}:{port}/{database}"


def get_dev_mode() -> bool:
    value = os.environ.get("DEV_MODE", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def get_jwt_secret() -> str | None:
    return os.environ.get("JWT_SECRET")


def get_jwt_expires_seconds() -> int:
    raw = os.environ.get("JWT_EXPIRES_SECONDS", "604800")
    try:
        return int(raw)
    except ValueError:
        return 604800


def get_admin_email() -> str | None:
    value = os.environ.get("ADMIN_EMAIL")
    if not value:
        return None
    return value.strip().lower() or None
