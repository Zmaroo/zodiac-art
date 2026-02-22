"""Redis-backed chart session storage."""

from __future__ import annotations

import inspect
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

from zodiac_art.api.storage import ChartRecord

SESSION_VERSION = 1


@dataclass(frozen=True)
class ChartSession:
    session_id: str
    payload: dict


def session_to_chart_record(session: ChartSession) -> ChartRecord:
    chart = session.payload.get("chart", {})
    return ChartRecord(
        chart_id=session.session_id,
        user_id=session.payload.get("user_id"),
        name=chart.get("name"),
        birth_date=str(chart.get("birth_date")),
        birth_time=str(chart.get("birth_time")),
        latitude=float(chart.get("latitude", 0.0)),
        longitude=float(chart.get("longitude", 0.0)),
        default_frame_id=chart.get("default_frame_id"),
        birth_place_text=chart.get("birth_place_text"),
        birth_place_id=chart.get("birth_place_id"),
        timezone=chart.get("timezone"),
        birth_datetime_utc=chart.get("birth_datetime_utc"),
        created_at=session.payload.get("created_at"),
        updated_at=session.payload.get("updated_at"),
    )


class RedisSessionStore:
    """Redis-backed storage for chart sessions."""

    def __init__(self, client, ttl_seconds: int = 604800) -> None:
        self._client = client
        self._ttl_seconds = ttl_seconds

    async def close(self) -> None:
        result = self._client.close()
        if inspect.isawaitable(result):
            await result
        await self._client.connection_pool.disconnect()

    def _key(self, session_id: str) -> str:
        return f"chart_session:{session_id}"

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    async def create_session(self, chart_payload: dict, user_id: str | None) -> ChartSession:
        session_id = str(uuid4())
        now = self._now()
        payload = {
            "v": SESSION_VERSION,
            "chart": chart_payload,
            "frames": {},
            "user_id": user_id,
            "created_at": now,
            "updated_at": now,
        }
        await self._save(session_id, payload)
        return ChartSession(session_id=session_id, payload=payload)

    async def load_session(self, session_id: str, touch: bool = True) -> ChartSession | None:
        data = await self._client.get(self._key(session_id))
        if not data:
            return None
        payload = json.loads(data)
        if touch:
            await self._client.expire(self._key(session_id), self._ttl_seconds)
        return ChartSession(session_id=session_id, payload=payload)

    async def save_session(self, session_id: str, payload: dict) -> None:
        await self._save(session_id, payload)

    async def update_session(
        self,
        session_id: str,
        updater: Callable[[dict], dict],
    ) -> ChartSession | None:
        session = await self.load_session(session_id, touch=False)
        if not session:
            return None
        payload = updater(session.payload)
        payload["updated_at"] = self._now()
        await self._save(session_id, payload)
        return ChartSession(session_id=session_id, payload=payload)

    async def _save(self, session_id: str, payload: dict) -> None:
        encoded = json.dumps(payload)
        await self._client.set(self._key(session_id), encoded, ex=self._ttl_seconds)


class SessionStorageAdapter:
    """Storage adapter that reads/writes chart state from a session."""

    def __init__(self, base_storage, session_store: RedisSessionStore, session_id: str) -> None:
        self._base_storage = base_storage
        self._session_store = session_store
        self._session_id = session_id

    def _assert_session(self, chart_id: str) -> None:
        if chart_id != self._session_id:
            raise ValueError("Session adapter used with mismatched chart_id")

    async def list_frames(self) -> list[str]:
        return await self._base_storage.list_frames()

    async def metadata_exists(self, chart_id: str, frame_id: str) -> bool:
        self._assert_session(chart_id)
        session = await self._session_store.load_session(chart_id)
        if not session:
            return False
        frames = session.payload.get("frames", {})
        return bool(frames.get(frame_id, {}).get("meta"))

    async def layout_exists(self, chart_id: str, frame_id: str) -> bool:
        self._assert_session(chart_id)
        session = await self._session_store.load_session(chart_id)
        if not session:
            return False
        frames = session.payload.get("frames", {})
        return bool(frames.get(frame_id, {}).get("layout"))

    async def load_template_meta(self, frame_id: str) -> dict:
        return await self._base_storage.load_template_meta(frame_id)

    async def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None:
        self._assert_session(chart_id)
        session = await self._session_store.load_session(chart_id)
        if not session:
            return None
        frames = session.payload.get("frames", {})
        return frames.get(frame_id, {}).get("meta")

    async def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None:
        self._assert_session(chart_id)
        session = await self._session_store.load_session(chart_id)
        if not session:
            return None
        frames = session.payload.get("frames", {})
        return frames.get(frame_id, {}).get("layout")

    async def load_chart_fit(self, chart_id: str) -> dict | None:
        self._assert_session(chart_id)
        session = await self._session_store.load_session(chart_id)
        if not session:
            return None
        return session.payload.get("chart_fit")

    async def load_chart_layout_base(self, chart_id: str) -> dict | None:
        self._assert_session(chart_id)
        session = await self._session_store.load_session(chart_id)
        if not session:
            return None
        return session.payload.get("layout_base")

    async def save_chart_meta(self, chart_id: str, frame_id: str, meta: dict) -> None:
        self._assert_session(chart_id)

        def updater(payload: dict) -> dict:
            frames = payload.setdefault("frames", {})
            frame_state = frames.setdefault(frame_id, {})
            frame_state["meta"] = meta
            return payload

        if await self._session_store.update_session(chart_id, updater) is None:
            raise FileNotFoundError("Chart session not found")

    async def save_chart_layout(self, chart_id: str, frame_id: str, layout: dict) -> None:
        self._assert_session(chart_id)

        def updater(payload: dict) -> dict:
            frames = payload.setdefault("frames", {})
            frame_state = frames.setdefault(frame_id, {})
            frame_state["layout"] = layout
            return payload

        if await self._session_store.update_session(chart_id, updater) is None:
            raise FileNotFoundError("Chart session not found")

    async def save_chart_fit(self, chart_id: str, chart_fit: dict) -> None:
        self._assert_session(chart_id)

        def updater(payload: dict) -> dict:
            payload["chart_fit"] = chart_fit
            return payload

        if await self._session_store.update_session(chart_id, updater) is None:
            raise FileNotFoundError("Chart session not found")

    async def save_chart_layout_base(self, chart_id: str, layout: dict) -> None:
        self._assert_session(chart_id)

        def updater(payload: dict) -> dict:
            payload["layout_base"] = layout
            return payload

        if await self._session_store.update_session(chart_id, updater) is None:
            raise FileNotFoundError("Chart session not found")

    async def template_image_path(self, frame_id: str):
        return await self._base_storage.template_image_path(frame_id)

    async def template_meta_path(self, frame_id: str):
        return await self._base_storage.template_meta_path(frame_id)
