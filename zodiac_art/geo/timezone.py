"""Timezone helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from timezonefinder import TimezoneFinder


def resolve_timezone(lat: float, lon: float) -> str | None:
    finder = TimezoneFinder()
    return finder.timezone_at(lat=lat, lng=lon)


def to_utc_iso(birth_date: str, birth_time: str, tz_name: str) -> str:
    local_naive = datetime.fromisoformat(f"{birth_date}T{birth_time}")
    try:
        tz = ZoneInfo(tz_name)
    except Exception as exc:
        raise ValueError(f"Invalid timezone: {tz_name}") from exc

    aware0 = local_naive.replace(tzinfo=tz, fold=0)
    aware1 = local_naive.replace(tzinfo=tz, fold=1)

    if aware0.utcoffset() != aware1.utcoffset():
        raise ValueError("Ambiguous local time due to DST. Please adjust time.")

    roundtrip = aware0.astimezone(timezone.utc).astimezone(tz)
    if roundtrip.replace(tzinfo=None) != local_naive:
        raise ValueError("Non-existent local time due to DST. Please adjust time.")

    utc_dt = aware0.astimezone(timezone.utc)
    return utc_dt.isoformat()
