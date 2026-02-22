"""Helpers for chart input normalization."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from zodiac_art.geo.timezone import resolve_timezone, to_utc_iso


def normalize_chart_name(name: str | None) -> str:
    if name:
        cleaned = name.strip()
        if cleaned:
            return cleaned
    now = datetime.now(timezone.utc)
    return f"Chart {now.strftime('%Y-%m-%d %H:%M')}"


def build_chart_payload(payload, name_override: str | None = None) -> dict:
    if payload.birth_place_id:
        raise HTTPException(status_code=400, detail="birth_place_id is not supported")
    latitude = payload.latitude
    longitude = payload.longitude
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="Latitude and longitude are required")
    timezone_name = resolve_timezone(latitude, longitude)
    birth_datetime_utc = None
    if timezone_name:
        try:
            birth_datetime_utc = to_utc_iso(payload.birth_date, payload.birth_time, timezone_name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    name = normalize_chart_name(name_override if name_override is not None else payload.name)
    return {
        "name": name,
        "birth_date": payload.birth_date,
        "birth_time": payload.birth_time,
        "latitude": latitude,
        "longitude": longitude,
        "default_frame_id": payload.default_frame_id,
        "birth_place_text": None,
        "birth_place_id": None,
        "timezone": timezone_name,
        "birth_datetime_utc": birth_datetime_utc,
    }
