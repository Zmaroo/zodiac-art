"""Frame loading and validation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from zodiac_art.frames.validation import validate_meta
from zodiac_art.utils.file_utils import load_json

SUPPORTED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


@dataclass(frozen=True)
class FrameMeta:
    """Alignment metadata for a frame."""

    canvas_width: int
    canvas_height: int
    chart_center_x: float
    chart_center_y: float
    ring_outer: float
    ring_inner: float
    rotation_deg: float
    chart_fit_dx: float
    chart_fit_dy: float
    chart_fit_scale: float
    chart_fit_rotation_deg: float


@dataclass(frozen=True)
class FrameAsset:
    """Frame asset bundle with metadata and paths."""

    frame_id: str
    frame_dir: Path
    image_path: Path
    metadata_path: Path
    meta: FrameMeta
    image: Image.Image | None = None


def _frames_root() -> Path:
    return Path(__file__).resolve().parent


def _find_frame_image(frame_dir: Path) -> Path:
    candidates = [frame_dir / f"frame{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]
    existing = [path for path in candidates if path.exists()]
    if not existing:
        supported = ", ".join(f"frame{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS)
        raise FileNotFoundError(
            f"Frame image not found in {frame_dir}. Expected one of: {supported}"
        )
    if len(existing) > 1:
        names = ", ".join(path.name for path in existing)
        raise ValueError(f"Multiple frame images found in {frame_dir}. Keep only one: {names}")
    return existing[0]


def _load_image(image_path: Path) -> Image.Image:
    with Image.open(image_path) as image:
        image.load()
        return image.copy()


def load_frame(frame_id: str) -> FrameAsset:
    """Load a frame asset folder by id."""

    frame_dir = _frames_root() / frame_id
    if not frame_dir.exists():
        raise FileNotFoundError(f"Frame '{frame_id}' not found. Expected folder: {frame_dir}")
    if not frame_dir.is_dir():
        raise NotADirectoryError(f"Frame path is not a directory: {frame_dir}")

    image_path = _find_frame_image(frame_dir).resolve()
    metadata_path = (frame_dir / "metadata.json").resolve()
    try:
        data = load_json(metadata_path)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Invalid JSON in frame metadata: {metadata_path}. Ensure metadata.json is valid JSON."
        ) from exc

    image = _load_image(image_path)
    meta = validate_meta(data, image.size)
    return FrameAsset(
        frame_id=frame_id,
        frame_dir=frame_dir.resolve(),
        image_path=image_path,
        metadata_path=metadata_path,
        meta=meta,
        image=image,
    )


def discover_frames() -> list[FrameAsset]:
    """Load all frames available in the registry."""

    from zodiac_art.frames.registry import list_frames

    assets: list[FrameAsset] = []
    for entry in list_frames():
        assets.append(load_frame(entry.frame_id))
    return assets
