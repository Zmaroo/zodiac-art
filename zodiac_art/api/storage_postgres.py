"""Postgres-backed storage for chart state."""

from __future__ import annotations

import json
from datetime import datetime
from datetime import timezone as utc_timezone
from pathlib import Path
from typing import Iterable
from uuid import UUID, uuid4

import asyncpg

from zodiac_art.api.storage import ChartRecord
from zodiac_art.config import PROJECT_ROOT, STORAGE_ROOT
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

    async def _frame_row(self, frame_id: str) -> asyncpg.Record | None:
        try:
            frame_uuid = self._validate_uuid(frame_id)
        except ValueError:
            return None
        async with self.pool.acquire() as conn:
            return await conn.fetchrow(
                """
                SELECT id, image_path, thumb_path, template_metadata_json
                FROM frames
                WHERE id = $1
                """,
                frame_uuid,
            )

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
        frame_ids: list[str] = []
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("SELECT id FROM frames ORDER BY created_at DESC")
        frame_ids.extend([str(row["id"]) for row in rows])
        if self.frames_dir.exists():
            for child in sorted(self.frames_dir.iterdir(), key=lambda path: path.name):
                if child.is_dir() and (child / "metadata.json").exists():
                    if child.name not in frame_ids:
                        frame_ids.append(child.name)
        return frame_ids

    async def create_chart(
        self,
        user_id: str | None,
        name: str | None,
        birth_date: str,
        birth_time: str,
        latitude: float,
        longitude: float,
        default_frame_id: str | None,
        birth_place_text: str | None = None,
        birth_place_id: str | None = None,
        timezone: str | None = None,
        birth_datetime_utc: str | None = None,
    ) -> ChartRecord:
        utc_value = None
        if birth_datetime_utc:
            try:
                parsed = datetime.fromisoformat(birth_datetime_utc)
            except ValueError as exc:
                raise ValueError("Invalid birth_datetime_utc") from exc
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=utc_timezone.utc)
            utc_value = parsed
        chart_id = uuid4()
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO charts (
                    id, user_id, name, birth_date, birth_time, latitude, longitude,
                    default_frame_id, birth_place_text, birth_place_id, timezone, birth_datetime_utc
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                """,
                chart_id,
                UUID(user_id) if user_id else None,
                name,
                birth_date,
                birth_time,
                latitude,
                longitude,
                default_frame_id,
                birth_place_text,
                UUID(birth_place_id) if birth_place_id else None,
                timezone,
                utc_value,
            )
        return ChartRecord(
            chart_id=str(chart_id),
            user_id=user_id,
            name=name,
            birth_date=birth_date,
            birth_time=birth_time,
            latitude=latitude,
            longitude=longitude,
            default_frame_id=default_frame_id,
            birth_place_text=birth_place_text,
            birth_place_id=birth_place_id,
            timezone=timezone,
            birth_datetime_utc=birth_datetime_utc,
        )

    async def get_chart(self, chart_id: str) -> ChartRecord:
        return await self.load_chart(chart_id)

    async def load_chart(self, chart_id: str) -> ChartRecord:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id, name, birth_date, birth_time, latitude, longitude,
                       default_frame_id, created_at, updated_at, birth_place_text,
                       birth_place_id, timezone, birth_datetime_utc
                FROM charts
                WHERE id = $1
                """,
                chart_uuid,
            )
        if not row:
            raise FileNotFoundError("Chart not found")
        return ChartRecord(
            chart_id=str(row["id"]),
            user_id=str(row["user_id"]) if row["user_id"] else None,
            name=row["name"],
            birth_date=row["birth_date"],
            birth_time=row["birth_time"],
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            default_frame_id=row["default_frame_id"],
            birth_place_text=row["birth_place_text"],
            birth_place_id=str(row["birth_place_id"]) if row["birth_place_id"] else None,
            timezone=row["timezone"],
            birth_datetime_utc=_format_ts(row["birth_datetime_utc"]),
            created_at=_format_ts(row["created_at"]),
            updated_at=_format_ts(row["updated_at"]),
        )

    async def load_chart_for_user(self, chart_id: str, user_id: str) -> ChartRecord | None:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, user_id, name, birth_date, birth_time, latitude, longitude,
                       default_frame_id, created_at, updated_at, birth_place_text,
                       birth_place_id, timezone, birth_datetime_utc
                FROM charts
                WHERE id = $1 AND user_id = $2
                """,
                chart_uuid,
                UUID(user_id),
            )
        if not row:
            return None
        return ChartRecord(
            chart_id=str(row["id"]),
            user_id=str(row["user_id"]),
            name=row["name"],
            birth_date=row["birth_date"],
            birth_time=row["birth_time"],
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            default_frame_id=row["default_frame_id"],
            birth_place_text=row["birth_place_text"],
            birth_place_id=str(row["birth_place_id"]) if row["birth_place_id"] else None,
            timezone=row["timezone"],
            birth_datetime_utc=_format_ts(row["birth_datetime_utc"]),
            created_at=_format_ts(row["created_at"]),
            updated_at=_format_ts(row["updated_at"]),
        )

    async def chart_exists(self, chart_id: str) -> bool:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                "SELECT 1 FROM charts WHERE id = $1",
                chart_uuid,
            )
        return row is not None

    async def chart_exists_for_user(self, chart_id: str, user_id: str) -> bool:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                "SELECT 1 FROM charts WHERE id = $1 AND user_id = $2",
                chart_uuid,
                UUID(user_id),
            )
        return row is not None

    async def list_charts(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ChartRecord]:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, user_id, name, birth_date, birth_time, latitude, longitude,
                       default_frame_id, created_at, updated_at, birth_place_text,
                       birth_place_id, timezone, birth_datetime_utc
                FROM charts
                WHERE user_id = $1
                ORDER BY updated_at DESC, created_at DESC
                LIMIT $2
                OFFSET $3
                """,
                UUID(user_id),
                limit,
                max(0, offset),
            )
        return [
            ChartRecord(
                chart_id=str(row["id"]),
                user_id=str(row["user_id"]),
                name=row["name"],
                birth_date=row["birth_date"],
                birth_time=row["birth_time"],
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                default_frame_id=row["default_frame_id"],
                birth_place_text=row["birth_place_text"],
                birth_place_id=str(row["birth_place_id"]) if row["birth_place_id"] else None,
                timezone=row["timezone"],
                birth_datetime_utc=_format_ts(row["birth_datetime_utc"]),
                created_at=_format_ts(row["created_at"]),
                updated_at=_format_ts(row["updated_at"]),
            )
            for row in rows
        ]

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
        row = await self._frame_row(frame_id)
        if row:
            data = row["template_metadata_json"]
            if isinstance(data, str):
                return json.loads(data)
            return dict(data)
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

    async def load_chart_fit(self, chart_id: str) -> dict | None:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                """
                SELECT chart_fit_json
                FROM charts
                WHERE id = $1
                """,
                chart_uuid,
            )
        if row is None:
            return None
        if isinstance(row, str):
            return json.loads(row)
        return dict(row)

    async def load_chart_layout_base(self, chart_id: str) -> dict | None:
        chart_uuid = self._validate_uuid(chart_id)
        async with self.pool.acquire() as conn:
            row = await conn.fetchval(
                """
                SELECT layout_json
                FROM charts
                WHERE id = $1
                """,
                chart_uuid,
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
            await conn.execute(
                "UPDATE charts SET updated_at = NOW() WHERE id = $1",
                chart_uuid,
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
            await conn.execute(
                "UPDATE charts SET updated_at = NOW() WHERE id = $1",
                chart_uuid,
            )

    async def save_chart_fit(self, chart_id: str, chart_fit: dict) -> None:
        chart_uuid = self._validate_uuid(chart_id)
        payload = json.dumps(chart_fit)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE charts
                SET chart_fit_json = $2::jsonb,
                    updated_at = NOW()
                WHERE id = $1
                """,
                chart_uuid,
                payload,
            )

    async def save_chart_layout_base(self, chart_id: str, layout: dict) -> None:
        chart_uuid = self._validate_uuid(chart_id)
        payload = json.dumps(layout)
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE charts
                SET layout_json = $2::jsonb,
                    updated_at = NOW()
                WHERE id = $1
                """,
                chart_uuid,
                payload,
            )

    async def template_image_path(self, frame_id: str) -> Path:
        row = await self._frame_row(frame_id)
        if row:
            return STORAGE_ROOT / row["image_path"]
        return self._template_image_path(frame_id)

    async def template_meta_path(self, frame_id: str) -> Path:
        row = await self._frame_row(frame_id)
        if row:
            image_path = STORAGE_ROOT / row["image_path"]
            return image_path.parent / "template_metadata.json"
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


def _format_ts(value) -> str | None:
    if value is None:
        return None
    try:
        return value.isoformat()
    except AttributeError:
        return str(value)
