"""Backfill frame metadata from detected openings."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image

from zodiac_art.api.frames_store import template_metadata_from_opening
from zodiac_art.config import STORAGE_ROOT, build_database_url
from zodiac_art.frames.validation import validate_meta


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Backfill frame metadata from openings.")
    parser.add_argument(
        "--storage-root",
        type=Path,
        default=STORAGE_ROOT,
        help="Root storage directory (default: storage)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing template_metadata.json files",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit the number of frames processed (0 = no limit)",
    )
    parser.add_argument(
        "--skip-db",
        action="store_true",
        help="Skip updating Postgres frame metadata",
    )
    return parser.parse_args()


def _frame_dirs(storage_root: Path) -> list[Path]:
    frames_dir = storage_root / "frames"
    if not frames_dir.exists():
        return []
    return sorted([path for path in frames_dir.iterdir() if path.is_dir()])


async def _update_db(entries: list[tuple[str, dict]]) -> None:
    database_url = build_database_url()
    if not database_url:
        return
    import asyncpg

    conn = await asyncpg.connect(database_url)
    try:
        for frame_id, metadata in entries:
            await conn.execute(
                """
                UPDATE frames
                SET template_metadata_json = $2::jsonb
                WHERE id = $1
                """,
                frame_id,
                json.dumps(metadata),
            )
    finally:
        await conn.close()


def main() -> int:
    load_dotenv(override=False)
    args = _parse_args()
    processed = 0
    skipped = 0
    failed = 0
    db_updates: list[tuple[str, dict]] = []

    for frame_dir in _frame_dirs(args.storage_root):
        if args.limit and processed >= args.limit:
            break
        image_path = frame_dir / "original.png"
        if not image_path.exists():
            skipped += 1
            continue
        metadata_path = frame_dir / "template_metadata.json"
        if metadata_path.exists() and not args.force:
            skipped += 1
            continue
        try:
            with Image.open(image_path) as image:
                image.load()
                metadata = template_metadata_from_opening(image)
                validate_meta(metadata, image.size)
                (frame_dir / "template_metadata.json").write_text(
                    json.dumps(metadata, indent=2),
                    encoding="utf-8",
                )
                if not args.skip_db:
                    db_updates.append((frame_dir.name, metadata))
            processed += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"Failed {frame_dir.name}: {exc}")

    if db_updates:
        try:
            asyncio.run(_update_db(db_updates))
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"Failed updating database: {exc}")

    print(f"Backfill complete. processed={processed} skipped={skipped} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
