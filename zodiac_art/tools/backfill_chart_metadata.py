"""Backfill chart metadata with template frame geometry."""

from __future__ import annotations

import argparse
import asyncio
import json

from dotenv import load_dotenv

from zodiac_art.config import build_database_url


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill chart metadata geometry from frame templates.",
    )
    parser.add_argument(
        "--frame-id",
        type=str,
        default=None,
        help="Limit updates to a specific frame id",
    )
    return parser.parse_args()


async def _load_templates(conn, frame_id: str | None) -> dict[str, dict]:
    if frame_id:
        rows = await conn.fetch(
            "SELECT id, template_metadata_json FROM frames WHERE id = $1",
            frame_id,
        )
    else:
        rows = await conn.fetch("SELECT id, template_metadata_json FROM frames")
    templates: dict[str, dict] = {}
    for row in rows:
        data = row["template_metadata_json"]
        if isinstance(data, str):
            data = json.loads(data)
        templates[str(row["id"])] = dict(data)
    return templates


def _merge_chart_metadata(chart_meta: dict, template_meta: dict) -> dict:
    merged = dict(chart_meta)
    merged["canvas"] = template_meta.get("canvas")
    merged["chart"] = template_meta.get("chart")
    return merged


async def _update_charts(conn, templates: dict[str, dict], frame_id: str | None) -> int:
    if frame_id:
        rows = await conn.fetch(
            """
            SELECT chart_id, frame_id, metadata_json
            FROM chart_frames
            WHERE frame_id = $1 AND metadata_json IS NOT NULL
            """,
            frame_id,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT chart_id, frame_id, metadata_json
            FROM chart_frames
            WHERE metadata_json IS NOT NULL
            """
        )
    updated = 0
    for row in rows:
        frame_key = str(row["frame_id"])
        template_meta = templates.get(frame_key)
        if not template_meta:
            continue
        data = row["metadata_json"]
        if isinstance(data, str):
            data = json.loads(data)
        chart_meta = dict(data)
        merged = _merge_chart_metadata(chart_meta, template_meta)
        await conn.execute(
            """
            UPDATE chart_frames
            SET metadata_json = $3::jsonb
            WHERE chart_id = $1 AND frame_id = $2
            """,
            row["chart_id"],
            row["frame_id"],
            json.dumps(merged),
        )
        updated += 1
    return updated


async def _run(frame_id: str | None) -> int:
    database_url = build_database_url()
    if not database_url:
        print("DATABASE_URL not set; skipping.")
        return 1
    import asyncpg

    conn = await asyncpg.connect(database_url)
    try:
        templates = await _load_templates(conn, frame_id)
        updated = await _update_charts(conn, templates, frame_id)
        print(f"Updated {updated} chart frame metadata records.")
        return 0
    finally:
        await conn.close()


def main() -> int:
    load_dotenv(override=False)
    args = _parse_args()
    return asyncio.run(_run(args.frame_id))


if __name__ == "__main__":
    raise SystemExit(main())
