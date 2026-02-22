"""Backfill frame metadata from detected openings."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

from zodiac_art.api.frames_store import template_metadata_from_opening
from zodiac_art.config import STORAGE_ROOT, load_config
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
    return parser.parse_args()


def _frame_dirs(storage_root: Path) -> list[Path]:
    frames_dir = storage_root / "frames"
    if not frames_dir.exists():
        return []
    return sorted([path for path in frames_dir.iterdir() if path.is_dir()])


def main() -> int:
    args = _parse_args()
    config = load_config()
    processed = 0
    skipped = 0
    failed = 0

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
                metadata = template_metadata_from_opening(
                    image,
                    config.sign_ring_inner_ratio,
                )
                validate_meta(metadata, image.size)
                (frame_dir / "template_metadata.json").write_text(
                    json.dumps(metadata, indent=2),
                    encoding="utf-8",
                )
            processed += 1
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"Failed {frame_dir.name}: {exc}")

    print(f"Backfill complete. processed={processed} skipped={skipped} failed={failed}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
