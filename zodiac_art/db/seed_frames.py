"""Seed built-in frames into the database."""

from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import uuid4

import asyncpg
from dotenv import load_dotenv
from PIL import Image

from zodiac_art.api.frames_store import (
    PostgresFrameStore,
    prepare_frame_files,
    write_template_metadata,
)
from zodiac_art.config import PROJECT_ROOT, build_database_url
from zodiac_art.utils.file_utils import load_json


async def _seed_frames() -> None:
    load_dotenv(override=False)
    database_url = build_database_url()
    if not database_url:
        raise RuntimeError("Database is not configured. Set DATABASE_URL or PG* vars.")

    frames_dir = PROJECT_ROOT / "zodiac_art" / "frames"
    if not frames_dir.exists():
        raise RuntimeError("No frames directory found to seed.")

    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=2)
    store = PostgresFrameStore(pool)
    try:
        for frame_dir in sorted(frames_dir.iterdir(), key=lambda path: path.name):
            if not frame_dir.is_dir():
                continue
            meta_path = frame_dir / "metadata.json"
            if not meta_path.exists():
                continue
            template_metadata = load_json(meta_path)
            image_path = _find_frame_image(frame_dir)
            with Image.open(image_path) as image:
                width, height = image.size
                existing_id = await _lookup_builtin_id(pool, frame_dir.name)
                frame_id = existing_id or str(uuid4())
                file_info = prepare_frame_files(frame_id, image)
            write_template_metadata(frame_id, template_metadata)
            await store.upsert_builtin_frame(
                frame_id=frame_id,
                name=frame_dir.name,
                tags=[],
                width=width,
                height=height,
                image_path=file_info["image_path"],
                thumb_path=file_info["thumb_256"],
                template_metadata_json=template_metadata,
                thumbnails=[
                    (256, file_info["thumb_256"]),
                    (512, file_info["thumb_512"]),
                ],
            )
    finally:
        await pool.close()

    print("Seeded built-in frames.")


async def _lookup_builtin_id(pool: asyncpg.Pool, name: str) -> str | None:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM frames WHERE owner_user_id IS NULL AND name = $1",
            name,
        )
    if not row:
        return None
    return str(row["id"])


def _find_frame_image(frame_dir: Path) -> Path:
    from zodiac_art.frames.frame_loader import SUPPORTED_IMAGE_EXTENSIONS

    candidates = [frame_dir / f"frame{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]
    existing = [path for path in candidates if path.exists()]
    if not existing:
        raise FileNotFoundError(f"Frame image not found for {frame_dir.name}.")
    if len(existing) > 1:
        names = ", ".join(path.name for path in existing)
        raise ValueError(f"Multiple frame images found for {frame_dir.name}: {names}")
    return existing[0]


def main() -> None:
    asyncio.run(_seed_frames())


if __name__ == "__main__":
    main()
