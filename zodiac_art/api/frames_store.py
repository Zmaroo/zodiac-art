"""Frame library storage helpers."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Iterable
from uuid import UUID

import asyncpg
from PIL import Image

from zodiac_art.config import PROJECT_ROOT, STORAGE_ROOT
from zodiac_art.frames.frame_loader import SUPPORTED_IMAGE_EXTENSIONS
from zodiac_art.utils.file_utils import load_json


@dataclass(frozen=True)
class FrameRecord:
    frame_id: str
    owner_user_id: str | None
    name: str
    tags: list[str]
    width: int
    height: int
    image_path: str
    thumb_path: str
    template_metadata_json: dict


def _row_to_frame(row: asyncpg.Record) -> FrameRecord:
    data = row["template_metadata_json"]
    if isinstance(data, str):
        template_metadata_json = json.loads(data)
    else:
        template_metadata_json = dict(data)
    return FrameRecord(
        frame_id=str(row["id"]),
        owner_user_id=str(row["owner_user_id"]) if row["owner_user_id"] else None,
        name=row["name"],
        tags=list(row["tags"] or []),
        width=int(row["width"]),
        height=int(row["height"]),
        image_path=row["image_path"],
        thumb_path=row["thumb_path"],
        template_metadata_json=template_metadata_json,
    )


class PostgresFrameStore:
    """Postgres-backed frame library."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

    @staticmethod
    def _validate_uuid(frame_id: str) -> UUID:
        return UUID(frame_id)

    async def list_frames(
        self,
        tag: str | None = None,
        owner_user_id: str | None = None,
        limit: int = 200,
    ) -> list[FrameRecord]:
        query = (
            "SELECT id, owner_user_id, name, tags, width, height, image_path, thumb_path, "
            "template_metadata_json FROM frames"
        )
        args: list[object] = []
        clauses: list[str] = []
        if tag:
            clauses.append("$1 = ANY(tags)")
            args.append(tag)
        if owner_user_id:
            clauses.append(f"owner_user_id = ${len(args) + 1}")
            args.append(UUID(owner_user_id))
        if clauses:
            query = f"{query} WHERE {' AND '.join(clauses)}"
        query = f"{query} ORDER BY created_at DESC LIMIT ${len(args) + 1}"
        args.append(limit)
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        return [_row_to_frame(row) for row in rows]

    async def get_frame(self, frame_id: str) -> FrameRecord | None:
        try:
            frame_uuid = self._validate_uuid(frame_id)
        except ValueError:
            return None
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, owner_user_id, name, tags, width, height, image_path, thumb_path,
                       template_metadata_json
                FROM frames
                WHERE id = $1
                """,
                frame_uuid,
            )
        if not row:
            return None
        return _row_to_frame(row)

    async def upsert_builtin_frame(
        self,
        frame_id: str,
        name: str,
        tags: list[str],
        width: int,
        height: int,
        image_path: str,
        thumb_path: str,
        template_metadata_json: dict,
        thumbnails: list[tuple[int, str]],
    ) -> FrameRecord:
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO frames (
                    id, owner_user_id, name, tags, width, height, image_path, thumb_path,
                    template_metadata_json
                ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    tags = EXCLUDED.tags,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    image_path = EXCLUDED.image_path,
                    thumb_path = EXCLUDED.thumb_path,
                    template_metadata_json = EXCLUDED.template_metadata_json
                """,
                UUID(frame_id),
                name,
                tags,
                width,
                height,
                image_path,
                thumb_path,
                json.dumps(template_metadata_json),
            )
            for size, path in thumbnails:
                await conn.execute(
                    """
                    INSERT INTO frame_thumbnails (frame_id, size, path)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (frame_id, size)
                    DO UPDATE SET path = EXCLUDED.path
                    """,
                    UUID(frame_id),
                    size,
                    path,
                )
        return FrameRecord(
            frame_id=frame_id,
            owner_user_id=None,
            name=name,
            tags=tags,
            width=width,
            height=height,
            image_path=image_path,
            thumb_path=thumb_path,
            template_metadata_json=template_metadata_json,
        )

    async def create_frame(
        self,
        frame_id: str,
        owner_user_id: str | None,
        name: str,
        tags: list[str],
        width: int,
        height: int,
        image_path: str,
        thumb_path: str,
        template_metadata_json: dict,
        thumbnails: list[tuple[int, str]],
    ) -> FrameRecord:
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO frames (
                    id, owner_user_id, name, tags, width, height, image_path, thumb_path,
                    template_metadata_json
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                UUID(frame_id),
                UUID(owner_user_id) if owner_user_id else None,
                name,
                tags,
                width,
                height,
                image_path,
                thumb_path,
                json.dumps(template_metadata_json),
            )
            for size, path in thumbnails:
                await conn.execute(
                    """
                    INSERT INTO frame_thumbnails (frame_id, size, path)
                    VALUES ($1, $2, $3)
                    """,
                    UUID(frame_id),
                    size,
                    path,
                )
        return FrameRecord(
            frame_id=frame_id,
            owner_user_id=owner_user_id,
            name=name,
            tags=tags,
            width=width,
            height=height,
            image_path=image_path,
            thumb_path=thumb_path,
            template_metadata_json=template_metadata_json,
        )


class FileFrameStore:
    """Filesystem-backed frame listing for legacy presets."""

    def __init__(self, frames_dir: Path | None = None) -> None:
        self.frames_dir = frames_dir or PROJECT_ROOT / "zodiac_art" / "frames"

    async def list_frames(
        self,
        tag: str | None = None,
        owner_user_id: str | None = None,
        limit: int = 200,
    ) -> list[FrameRecord]:
        if not self.frames_dir.exists():
            return []
        records: list[FrameRecord] = []
        for child in sorted(self.frames_dir.iterdir(), key=lambda path: path.name):
            if not child.is_dir():
                continue
            meta_path = child / "metadata.json"
            if not meta_path.exists():
                continue
            image_path = _find_frame_image(child)
            template_meta = load_json(meta_path)
            width = int(template_meta.get("canvas", {}).get("width", 0))
            height = int(template_meta.get("canvas", {}).get("height", 0))
            records.append(
                FrameRecord(
                    frame_id=child.name,
                    owner_user_id=None,
                    name=child.name,
                    tags=[],
                    width=width,
                    height=height,
                    image_path=f"frames/{child.name}/{image_path.name}",
                    thumb_path=f"frames/{child.name}/{image_path.name}",
                    template_metadata_json=template_meta,
                )
            )
        return records[:limit]

    async def get_frame(self, frame_id: str) -> FrameRecord | None:
        frame_dir = self.frames_dir / frame_id
        meta_path = frame_dir / "metadata.json"
        if not meta_path.exists():
            return None
        image_path = _find_frame_image(frame_dir)
        template_meta = load_json(meta_path)
        width = int(template_meta.get("canvas", {}).get("width", 0))
        height = int(template_meta.get("canvas", {}).get("height", 0))
        return FrameRecord(
            frame_id=frame_id,
            owner_user_id=None,
            name=frame_id,
            tags=[],
            width=width,
            height=height,
            image_path=f"frames/{frame_id}/{image_path.name}",
            thumb_path=f"frames/{frame_id}/{image_path.name}",
            template_metadata_json=template_meta,
        )


def normalize_tags(raw: str) -> list[str]:
    if not raw:
        return []
    seen: set[str] = set()
    tags: list[str] = []
    for entry in raw.split(","):
        tag = entry.strip()
        if not tag:
            continue
        tag = tag.lower()
        if tag in seen:
            continue
        seen.add(tag)
        tags.append(tag)
    return tags


def default_template_metadata(width: int, height: int) -> dict:
    center_x = width / 2
    center_y = height / 2
    return {
        "canvas": {"width": width, "height": height},
        "chart": {
            "center": {"x": center_x, "y": center_y},
            "ring_outer": int(width * 0.45),
            "ring_inner": int(width * 0.34),
            "rotation_deg": 0,
        },
    }


def validate_frame_image(image: Image.Image) -> tuple[int, int]:
    width, height = image.size
    if width != height:
        raise ValueError("Frame image must be square.")
    if width < 1024:
        raise ValueError("Frame image must be at least 1024px.")
    return width, height


def prepare_frame_files(frame_id: str, image: Image.Image) -> dict:
    storage_root = STORAGE_ROOT
    frame_dir = storage_root / "frames" / frame_id
    frame_dir.mkdir(parents=True, exist_ok=True)

    image_path = frame_dir / "original.png"
    thumb_256 = frame_dir / "thumb_256.png"
    thumb_512 = frame_dir / "thumb_512.png"

    rgba = image.convert("RGBA")
    rgba.save(image_path, format="PNG")

    _write_thumbnail(rgba, thumb_256, 256)
    _write_thumbnail(rgba, thumb_512, 512)

    return {
        "image_path": _relative_storage_path(image_path),
        "thumb_256": _relative_storage_path(thumb_256),
        "thumb_512": _relative_storage_path(thumb_512),
    }


def write_template_metadata(frame_id: str, template_metadata: dict) -> Path:
    frame_dir = STORAGE_ROOT / "frames" / frame_id
    frame_dir.mkdir(parents=True, exist_ok=True)
    target = frame_dir / "template_metadata.json"
    target.write_text(json.dumps(template_metadata, indent=2), encoding="utf-8")
    return target


def _write_thumbnail(image: Image.Image, target: Path, size: int) -> None:
    thumb = image.copy()
    try:
        resample = Image.Resampling.LANCZOS
    except AttributeError:
        resample = Image.LANCZOS
    thumb.thumbnail((size, size), resample)
    thumb.save(target, format="PNG")


def _relative_storage_path(path: Path) -> str:
    return str(path.relative_to(STORAGE_ROOT))


def _find_frame_image(frame_dir: Path) -> Path:
    candidates = [frame_dir / f"frame{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]
    existing = [path for path in candidates if path.exists()]
    if not existing:
        raise FileNotFoundError(f"Frame image not found for {frame_dir.name}.")
    if len(existing) > 1:
        names = ", ".join(path.name for path in existing)
        raise ValueError(f"Multiple frame images found for {frame_dir.name}: {names}")
    return existing[0]
