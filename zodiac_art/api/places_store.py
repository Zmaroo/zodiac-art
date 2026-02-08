"""Places cache storage."""

from __future__ import annotations

import json
from dataclasses import dataclass
from uuid import UUID, uuid4

import asyncpg


@dataclass(frozen=True)
class PlaceRecord:
    place_id: str
    display_name: str
    lat: float
    lon: float
    timezone: str | None
    provider: str
    provider_place_id: str | None
    raw: dict


class PlacesStore:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

    async def upsert_place(
        self,
        query_text: str,
        provider: str,
        provider_place_id: str | None,
        display_name: str,
        lat: float,
        lon: float,
        timezone: str | None,
        raw: dict,
    ) -> PlaceRecord:
        async with self.pool.acquire() as conn:
            if provider_place_id:
                row = await conn.fetchrow(
                    """
                    INSERT INTO places (
                        id, query_text, provider, provider_place_id, display_name,
                        lat, lon, timezone, raw
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (provider, provider_place_id)
                    DO UPDATE SET
                        query_text = EXCLUDED.query_text,
                        display_name = EXCLUDED.display_name,
                        lat = EXCLUDED.lat,
                        lon = EXCLUDED.lon,
                        timezone = EXCLUDED.timezone,
                        raw = EXCLUDED.raw
                    RETURNING id, display_name, lat, lon, timezone, provider, provider_place_id, raw
                    """,
                    uuid4(),
                    query_text,
                    provider,
                    provider_place_id,
                    display_name,
                    lat,
                    lon,
                    timezone,
                    json.dumps(raw),
                )
            else:
                row = await conn.fetchrow(
                    """
                    INSERT INTO places (
                        id, query_text, provider, provider_place_id, display_name,
                        lat, lon, timezone, raw
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id, display_name, lat, lon, timezone, provider, provider_place_id, raw
                    """,
                    uuid4(),
                    query_text,
                    provider,
                    None,
                    display_name,
                    lat,
                    lon,
                    timezone,
                    json.dumps(raw),
                )
        return _row_to_place(row)

    async def get_place(self, place_id: str) -> PlaceRecord | None:
        try:
            place_uuid = UUID(place_id)
        except ValueError:
            return None
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, display_name, lat, lon, timezone, provider, provider_place_id, raw
                FROM places
                WHERE id = $1
                """,
                place_uuid,
            )
        if not row:
            return None
        return _row_to_place(row)


def _row_to_place(row: asyncpg.Record) -> PlaceRecord:
    raw = row["raw"]
    if isinstance(raw, str):
        raw_data = json.loads(raw)
    else:
        raw_data = dict(raw)
    return PlaceRecord(
        place_id=str(row["id"]),
        display_name=row["display_name"],
        lat=float(row["lat"]),
        lon=float(row["lon"]),
        timezone=row["timezone"],
        provider=row["provider"],
        provider_place_id=row["provider_place_id"],
        raw=raw_data,
    )
