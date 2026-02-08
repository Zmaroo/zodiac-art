"""Geocoding provider interface and implementations."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Protocol

import httpx


@dataclass(frozen=True)
class PlaceCandidate:
    provider: str
    provider_place_id: str | None
    display_name: str
    lat: float
    lon: float
    raw: dict


class Geocoder(Protocol):
    async def search(self, query: str, limit: int = 5) -> list[PlaceCandidate]:
        ...


class NominatimGeocoder:
    """OSM Nominatim geocoder (dev only)."""

    def __init__(self, user_agent: str = "zodiac_art/1.0 (local dev)") -> None:
        self._user_agent = user_agent
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def search(self, query: str, limit: int = 5) -> list[PlaceCandidate]:
        await self._rate_limit()
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": limit,
                },
                headers={"User-Agent": self._user_agent},
            )
        response.raise_for_status()
        data = response.json()
        results: list[PlaceCandidate] = []
        for entry in data:
            results.append(
                PlaceCandidate(
                    provider="osm_nominatim",
                    provider_place_id=str(entry.get("place_id")) if entry.get("place_id") else None,
                    display_name=str(entry.get("display_name")),
                    lat=float(entry.get("lat")),
                    lon=float(entry.get("lon")),
                    raw=entry,
                )
            )
        return results

    async def _rate_limit(self) -> None:
        async with self._lock:
            now = asyncio.get_event_loop().time()
            elapsed = now - self._last_call
            if elapsed < 1.0:
                await asyncio.sleep(1.0 - elapsed)
            self._last_call = asyncio.get_event_loop().time()
