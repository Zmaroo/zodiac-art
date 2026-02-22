from __future__ import annotations

import asyncio
import json

from zodiac_art.api.session_storage import (
    ChartSession,
    RedisSessionStore,
    SessionStorageAdapter,
    session_to_chart_record,
)


class FakeConnectionPool:
    async def disconnect(self) -> None:
        return None


class FakeRedis:
    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.expire_calls: list[tuple[str, int]] = []
        self.connection_pool = FakeConnectionPool()

    async def get(self, key: str) -> str | None:
        return self.store.get(key)

    async def set(self, key: str, value: str, ex: int | None = None) -> None:
        self.store[key] = value
        if ex is not None:
            self.expire_calls.append((key, ex))

    async def expire(self, key: str, ttl: int) -> None:
        self.expire_calls.append((key, ttl))

    async def close(self) -> None:
        return None


class FakeStorage:
    async def list_frames(self) -> list[str]:
        return ["frame_a"]

    async def load_template_meta(self, frame_id: str) -> dict:
        return {"frame": frame_id}

    async def template_image_path(self, frame_id: str):
        return f"/tmp/{frame_id}.png"

    async def template_meta_path(self, frame_id: str):
        return f"/tmp/{frame_id}.json"


def test_session_round_trip():
    async def run() -> None:
        redis = FakeRedis()
        store = RedisSessionStore(redis, ttl_seconds=60)
        payload = {
            "name": "Draft",
            "birth_date": "1990-04-12",
            "birth_time": "08:45",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "default_frame_id": "default",
            "timezone": "America/New_York",
            "birth_datetime_utc": "1990-04-12T12:45:00+00:00",
        }
        session = await store.create_session(payload, user_id="user-1")
        loaded = await store.load_session(session.session_id)

        assert loaded is not None
        assert loaded.payload["chart"]["name"] == "Draft"
        assert redis.expire_calls

        record = session_to_chart_record(ChartSession(loaded.session_id, loaded.payload))
        assert record.birth_date == "1990-04-12"
        assert record.latitude == 40.7128

        adapter = SessionStorageAdapter(FakeStorage(), store, session.session_id)
        await adapter.save_chart_meta(session.session_id, "frame_a", {"foo": "bar"})
        await adapter.save_chart_layout(session.session_id, "frame_a", {"overrides": {}})
        await adapter.save_chart_fit(session.session_id, {"dx": 1.0, "dy": 2.0})
        await adapter.save_chart_layout_base(session.session_id, {"overrides": {"a": {"dx": 1}}})

        meta = await adapter.load_chart_meta(session.session_id, "frame_a")
        layout = await adapter.load_chart_layout(session.session_id, "frame_a")
        fit = await adapter.load_chart_fit(session.session_id)
        base_layout = await adapter.load_chart_layout_base(session.session_id)

        assert meta == {"foo": "bar"}
        assert layout == {"overrides": {}}
        assert fit == {"dx": 1.0, "dy": 2.0}
        assert base_layout == {"overrides": {"a": {"dx": 1}}}

        await store.close()

    asyncio.run(run())


def test_session_update_missing_returns_none():
    async def run() -> None:
        redis = FakeRedis()
        store = RedisSessionStore(redis, ttl_seconds=60)

        def updater(payload: dict) -> dict:
            payload["updated"] = True
            return payload

        assert await store.update_session("missing", updater) is None
        await store.close()

    asyncio.run(run())


def test_session_payload_is_json():
    async def run() -> None:
        redis = FakeRedis()
        store = RedisSessionStore(redis, ttl_seconds=60)
        payload = {
            "name": "Draft",
            "birth_date": "1990-04-12",
            "birth_time": "08:45",
            "latitude": 40.7128,
            "longitude": -74.0060,
        }
        session = await store.create_session(payload, user_id=None)
        raw = redis.store[f"chart_session:{session.session_id}"]
        assert isinstance(raw, str)
        decoded = json.loads(raw)
        assert decoded["chart"]["birth_date"] == "1990-04-12"
        await store.close()

    asyncio.run(run())
