"""Frame registry discovery utilities."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from zodiac_art.utils.file_utils import load_json

THUMBNAIL_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


@dataclass(frozen=True)
class FrameRegistryEntry:
    """Registry entry describing an available frame."""

    frame_id: str
    thumbnail_path: Path | None
    tags: tuple[str, ...]


def _frames_root() -> Path:
    return Path(__file__).resolve().parent


def _resolve_thumbnail(path_value: str | None) -> Path | None:
    if not path_value:
        return None
    path = Path(path_value)
    if path.is_absolute():
        return path
    return (_frames_root() / path).resolve()


def _parse_index(data: object) -> list[FrameRegistryEntry]:
    if isinstance(data, dict):
        frames = data.get("frames")
    else:
        frames = data
    if not isinstance(frames, list):
        raise ValueError("Frame index must contain a list under 'frames'.")

    entries: list[FrameRegistryEntry] = []
    for item in frames:
        if not isinstance(item, dict):
            raise ValueError("Frame index entries must be objects.")
        frame_id = item.get("id")
        if not isinstance(frame_id, str) or not frame_id:
            raise ValueError("Frame index entries require a non-empty 'id'.")
        thumbnail = _resolve_thumbnail(item.get("thumbnail"))
        tags_raw = item.get("tags", [])
        if not isinstance(tags_raw, list) or not all(
            isinstance(tag, str) for tag in tags_raw
        ):
            raise ValueError("Frame index 'tags' must be a list of strings.")
        entries.append(
            FrameRegistryEntry(
                frame_id=frame_id,
                thumbnail_path=thumbnail,
                tags=tuple(tags_raw),
            )
        )
    return entries


def _find_thumbnail(frame_dir: Path) -> Path | None:
    for ext in THUMBNAIL_EXTENSIONS:
        candidate = frame_dir / f"thumbnail{ext}"
        if candidate.exists():
            return candidate.resolve()
        candidate = frame_dir / f"thumb{ext}"
        if candidate.exists():
            return candidate.resolve()
    return None


def _discover_frames() -> list[FrameRegistryEntry]:
    frames_root = _frames_root()
    entries: list[FrameRegistryEntry] = []
    for child in sorted(frames_root.iterdir(), key=lambda path: path.name):
        if not child.is_dir() or child.name.startswith("__"):
            continue
        metadata_path = child / "metadata.json"
        if not metadata_path.exists():
            continue
        entries.append(
            FrameRegistryEntry(
                frame_id=child.name,
                thumbnail_path=_find_thumbnail(child),
                tags=(),
            )
        )
    return entries


def list_frames() -> list[FrameRegistryEntry]:
    """Return available frames from index or discovery."""

    index_path = _frames_root() / "index.json"
    if index_path.exists():
        data = load_json(index_path)
        return _parse_index(data)
    return _discover_frames()
