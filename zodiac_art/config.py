"""Application configuration defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus

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
    embed_frame_data_uri: bool = True
    render_cache_max: int = 32


def load_config() -> AppConfig:
    """Load configuration, applying environment overrides."""
    config = AppConfig()
    sweph_path = os.environ.get("SWEPH_PATH")
    glyph_mode = os.environ.get("GLYPH_MODE", config.glyph_mode)
    frame_dir = Path(os.environ.get("FRAME_DIR", str(config.frame_dir)))
    output_dir = Path(os.environ.get("OUTPUT_DIR", str(config.output_dir)))
    canvas_width = _env_int("CANVAS_WIDTH", config.canvas_width)
    canvas_height = _env_int("CANVAS_HEIGHT", config.canvas_height)
    sign_ring_outer_ratio = _env_float("SIGN_RING_OUTER_RATIO", config.sign_ring_outer_ratio)
    sign_ring_inner_ratio = _env_float("SIGN_RING_INNER_RATIO", config.sign_ring_inner_ratio)
    planet_ring_ratio = _env_float("PLANET_RING_RATIO", config.planet_ring_ratio)
    label_ring_ratio = _env_float("LABEL_RING_RATIO", config.label_ring_ratio)
    planet_label_offset_ratio = _env_float(
        "PLANET_LABEL_OFFSET_RATIO",
        config.planet_label_offset_ratio,
    )
    embed_frame_data_uri = _env_bool("EMBED_FRAME_DATA_URI", config.embed_frame_data_uri)
    render_cache_max = _env_int("RENDER_CACHE_MAX", config.render_cache_max)
    return AppConfig(
        glyph_mode=glyph_mode,
        frame_dir=frame_dir,
        output_dir=output_dir,
        canvas_width=canvas_width,
        canvas_height=canvas_height,
        sign_ring_outer_ratio=sign_ring_outer_ratio,
        sign_ring_inner_ratio=sign_ring_inner_ratio,
        planet_ring_ratio=planet_ring_ratio,
        label_ring_ratio=label_ring_ratio,
        planet_label_offset_ratio=planet_label_offset_ratio,
        sweph_path=sweph_path,
        embed_frame_data_uri=embed_frame_data_uri,
        render_cache_max=render_cache_max,
    )


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


def get_dev_tools_enabled() -> bool:
    value = os.environ.get("ZODIAC_DEV_TOOLS", "0").strip().lower()
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


def get_cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return ["http://localhost:5173", "http://127.0.0.1:5173"]


def get_redis_url() -> str | None:
    value = os.environ.get("REDIS_URL")
    if not value:
        return None
    return value.strip() or None


def get_session_ttl_seconds() -> int:
    raw = os.environ.get("CHART_SESSION_TTL_SECONDS", "604800")
    try:
        return max(60, int(raw))
    except ValueError:
        return 604800


def _env_int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value


def _env_float(key: str, default: float) -> float:
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return value


def _env_bool(key: str, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    return default
