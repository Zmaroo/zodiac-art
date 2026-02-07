"""Postgres-backed storage for chart state."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable
from uuid import UUID, uuid4

import asyncpg

from zodiac_art.api.storage import ChartRecord
from zodiac_art.config import PROJECT_ROOT
from zodiac_art.frames.frame_loader import SUPPORTED_IMAGE_EXTENSIONS
from zodiac_art.utils.file_utils import load_json


class PostgresStorage:
    """Postgres storage for chart state."""

    def __init__(self, pool: asyncpg.Pool, frames_dir: Path | None = None) -> None:
        self.pool = pool
        self.frames_dir = frames_dir or PROJECT_ROOT / "zodiac_art" / "frames"

    @staticmethod
    def _validate_uuid(chart_id: str) -> UUID:
        return UUID(chart_id)

    def _template_frame_dir(self, frame_id: str) -> Path:
        return self.frames_dir / frame_id

    def _template_meta_path(self, frame_id: str) -> Path:
        return self._template_frame_dir(frame_id) / "metadata.json"

    def _template_image_path(self, frame_id: str) -> Path:
        frame_dir = self._template_frame_dir(frame_id)
        candidates = [frame_dir / f"frame{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]
        existing = [path for path in candidates if path.exists()]
        if not existing:
            raise FileNotFoundError(f"Frame image not found for {frame_id}.")
        if len(existing) > 1:
            names = ", ".join(path.name for path in existing)
            raise ValueError(f"Multiple frame images found for {frame_id}: {names}")
        return existing[0]

    async def list_frames(self) -> list[str]:
        if not self.frames_dir.exists():
            return []
        frame_ids: list[str] = []
        for child in sorted(self.frames_dir.iterdir(), key=lambda path: path.name):
            if child.is_dir() and (child / "metadata.json").exists():
                frame_ids.append(child.name)
        return frame_ids

    async def create_chart(
        self,
        birth_date: str,
        birth_time: str,
        latitude: float,
        longitude: float,
        default_frame_id: str | None,
    ) -> ChartRecord:
        chart_id = uuid4()
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO charts (
                    id, birth_date, birth_time, latitude, longitude, default_frame_id
                ) VALUES ($1, $2, $3, $4, $5, $6)
                """,
                chart_id,
                birth_date,
                birth_time,
                latitude,
                longitude,
                default_frame_id,
            )
        return ChartRecord(
            chart_id=str(chart_id),
            birth_date=birth_date,
            birth_time=birth_time,
            latitude=latitude,
            longitude=longitude,
            default_frame_id=default_frame_id,
        )

    async def get_chart(self, chart_id: str) -> ChartRecord:
        return await self.load_chart(chart_id)

    async def load_chart(self, chart_id: str) -> ChartRecord:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, birth_date, birth_time, latitude, longitude, default_frame_id
                FROM charts
                WHERE id = $1
                """,
                chart_uuid,
            )
        if not row:
            raise FileNotFoundError("Chart not found")
        return ChartRecord(
            chart_id=str(row["id"]),
            birth_date=row["birth_date"],
            birth_time=row["birth_time"],
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            default_frame_id=row["default_frame_id"],
        )

    async def chart_exists(self, chart_id: str) -> bool:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                "SELECT 1 FROM charts WHERE id = $1",
                chart_uuid,
            )
        return row is not None

    async def metadata_exists(self, chart_id: str, frame_id: str) -> bool:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                """
                SELECT metadata_json IS NOT NULL
                FROM chart_frames
                WHERE chart_id = $1 AND frame_id = $2
                """,
                chart_uuid,
                frame_id,
            )
        return bool(row)

    async def layout_exists(self, chart_id: str, frame_id: str) -> bool:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                """
                SELECT layout_json IS NOT NULL
                FROM chart_frames
                WHERE chart_id = $1 AND frame_id = $2
                """,
                chart_uuid,
                frame_id,
            )
        return bool(row)

    async def load_template_meta(self, frame_id: str) -> dict:
        return load_json(self._template_meta_path(frame_id))

    async def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                """
                SELECT metadata_json
                FROM chart_frames
                WHERE chart_id = $1 AND frame_id = $2
                """,
                chart_uuid,
                frame_id,
            )
        if row is None:
            return None
        if isinstance(row, str):
            return json.loads(row)
        return dict(row)

    async def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                """
                SELECT layout_json
                FROM chart_frames
                WHERE chart_id = $1 AND frame_id = $2
                """,
                chart_uuid,
                frame_id,
            )
        if row is None:
            return None
        if isinstance(row, str):
            return json.loads(row)
        return dict(row)

    async def get_frame_metadata(self, chart_id: str, frame_id: str) -> dict:
        template_meta = await self.load_template_meta(frame_id)
        override_meta = await self.load_chart_meta(chart_id, frame_id)
        return _merge_dicts(template_meta, override_meta)

    async def save_frame_metadata(self, chart_id: str, frame_id: str, meta: dict) -> None:
        await self.save_chart_meta(chart_id, frame_id, meta)

    async def get_layout(self, chart_id: str, frame_id: str) -> dict | None:
        return await self.load_chart_layout(chart_id, frame_id)

    async def save_layout(self, chart_id: str, frame_id: str, layout: dict) -> None:
        await self.save_chart_layout(chart_id, frame_id, layout)

    async def save_chart_meta(self, chart_id: str, frame_id: str, meta: dict) -> None:
        chart_uuid = self._validate_uuid(chart_id)
        payload = json.dumps(meta)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO chart_frames (chart_id, frame_id, metadata_json)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (chart_id, frame_id)
                DO UPDATE SET metadata_json = EXCLUDED.metadata_json,
                              updated_at = NOW()
                """,
                chart_uuid,
                frame_id,
                payload,
            )

    async def save_chart_layout(self, chart_id: str, frame_id: str, layout: dict) -> None:
        chart_uuid = self._validate_uuid(chart_id)
        payload = json.dumps(layout)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO chart_frames (chart_id, frame_id, layout_json)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (chart_id, frame_id)
                DO UPDATE SET layout_json = EXCLUDED.layout_json,
                              updated_at = NOW()
                """,
                chart_uuid,
                frame_id,
                payload,
            )

    async def template_image_path(self, frame_id: str) -> Path:
        return self._template_image_path(frame_id)

    async def template_meta_path(self, frame_id: str) -> Path:
        return self._template_meta_path(frame_id)

    async def iter_frame_dirs(self) -> Iterable[Path]:
        if not self.frames_dir.exists():
            return []
        return sorted(
            [path for path in self.frames_dir.iterdir() if path.is_dir()],
            key=lambda path: path.name,
        )


def _merge_dicts(base: dict, override: dict | None) -> dict:
    if override is None:
        return base
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge_dicts(merged[key], value)
        else:
            merged[key] = value
    return merged
