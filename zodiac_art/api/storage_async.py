"""Async wrappers for storage backends."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Iterable

from zodiac_art.api.storage import ChartRecord, FileStorage


class AsyncFileStorage:
    """Async adapter for FileStorage."""

    def __init__(self, storage: FileStorage) -> None:
        self._storage = storage

    async def list_frames(self) -> list[str]:
        return await asyncio.to_thread(self._storage.list_frames)

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
        return await asyncio.to_thread(
            self._storage.create_chart,
            user_id,
            name,
            birth_date,
            birth_time,
            latitude,
            longitude,
            default_frame_id,
            birth_place_text,
            birth_place_id,
            timezone,
            birth_datetime_utc,
        )

    async def get_chart(self, chart_id: str) -> ChartRecord:
        return await asyncio.to_thread(self._storage.load_chart, chart_id)

    async def load_chart(self, chart_id: str) -> ChartRecord:
        return await asyncio.to_thread(self._storage.load_chart, chart_id)

    async def load_chart_for_user(self, chart_id: str, user_id: str) -> ChartRecord | None:
        record = await asyncio.to_thread(self._storage.load_chart, chart_id)
        if record.user_id and record.user_id != user_id:
            return None
        return record

    async def list_charts(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ChartRecord]:
        return await asyncio.to_thread(self._storage.list_charts, user_id, limit, offset)

    async def chart_exists(self, chart_id: str) -> bool:
        return await asyncio.to_thread(self._storage.chart_exists, chart_id)

    async def chart_exists_for_user(self, chart_id: str, user_id: str) -> bool:
        record = await self.load_chart_for_user(chart_id, user_id)
        return record is not None

    async def metadata_exists(self, chart_id: str, frame_id: str) -> bool:
        return await asyncio.to_thread(self._storage.metadata_exists, chart_id, frame_id)

    async def layout_exists(self, chart_id: str, frame_id: str) -> bool:
        return await asyncio.to_thread(self._storage.layout_exists, chart_id, frame_id)

    async def chart_fit_exists(self, chart_id: str) -> bool:
        return await asyncio.to_thread(self._storage.chart_fit_exists, chart_id)

    async def chart_layout_exists(self, chart_id: str) -> bool:
        return await asyncio.to_thread(self._storage.chart_layout_exists, chart_id)

    async def load_template_meta(self, frame_id: str) -> dict:
        return await asyncio.to_thread(self._storage.load_template_meta, frame_id)

    async def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None:
        return await asyncio.to_thread(self._storage.load_chart_meta, chart_id, frame_id)

    async def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None:
        return await asyncio.to_thread(self._storage.load_chart_layout, chart_id, frame_id)

    async def load_chart_fit(self, chart_id: str) -> dict | None:
        return await asyncio.to_thread(self._storage.load_chart_fit, chart_id)

    async def load_chart_layout_base(self, chart_id: str) -> dict | None:
        return await asyncio.to_thread(self._storage.load_chart_layout_base, chart_id)

    async def get_frame_metadata(self, chart_id: str, frame_id: str) -> dict:
        template_meta = await asyncio.to_thread(self._storage.load_template_meta, frame_id)
        override_meta = await asyncio.to_thread(self._storage.load_chart_meta, chart_id, frame_id)
        if override_meta:
            template_meta.update(override_meta)
        return template_meta

    async def save_frame_metadata(self, chart_id: str, frame_id: str, meta: dict) -> None:
        await asyncio.to_thread(self._storage.save_chart_meta, chart_id, frame_id, meta)

    async def get_layout(self, chart_id: str, frame_id: str) -> dict | None:
        return await asyncio.to_thread(self._storage.load_chart_layout, chart_id, frame_id)

    async def save_layout(self, chart_id: str, frame_id: str, layout: dict) -> None:
        await asyncio.to_thread(self._storage.save_chart_layout, chart_id, frame_id, layout)

    async def save_chart_meta(self, chart_id: str, frame_id: str, meta: dict) -> None:
        await asyncio.to_thread(self._storage.save_chart_meta, chart_id, frame_id, meta)

    async def save_chart_layout(self, chart_id: str, frame_id: str, layout: dict) -> None:
        await asyncio.to_thread(self._storage.save_chart_layout, chart_id, frame_id, layout)

    async def save_chart_fit(self, chart_id: str, chart_fit: dict) -> None:
        await asyncio.to_thread(self._storage.save_chart_fit, chart_id, chart_fit)

    async def save_chart_layout_base(self, chart_id: str, layout: dict) -> None:
        await asyncio.to_thread(self._storage.save_chart_layout_base, chart_id, layout)

    async def template_image_path(self, frame_id: str) -> Path:
        return await asyncio.to_thread(self._storage.template_image_path, frame_id)

    async def template_meta_path(self, frame_id: str) -> Path:
        return await asyncio.to_thread(self._storage.template_meta_path, frame_id)

    async def iter_frame_dirs(self) -> Iterable[Path]:
        return await asyncio.to_thread(self._storage.iter_frame_dirs)
