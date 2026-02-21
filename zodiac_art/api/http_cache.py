"""HTTP cache helpers."""

from __future__ import annotations

import hashlib

from fastapi import Request


def cache_control_header(profile: str) -> str:
    if profile == "saved":
        return "private, max-age=600"
    return "private, max-age=30, stale-while-revalidate=30"


def format_etag(value: str) -> str:
    return f'"{value}"'


def compute_etag(payload: str | bytes) -> str:
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def etag_matches(request: Request, expected: str) -> bool:
    raw = request.headers.get("if-none-match")
    if not raw:
        return False
    if raw.strip() == "*":
        return True
    for item in raw.split(","):
        token = item.strip()
        if token.startswith("W/"):
            token = token[2:]
        token = token.strip()
        if token.startswith('"') and token.endswith('"'):
            token = token[1:-1]
        if token == expected:
            return True
    return False


def render_cache_headers(profile: str, etag: str | None = None) -> dict[str, str]:
    headers = {"Cache-Control": cache_control_header(profile)}
    if etag:
        headers["ETag"] = format_etag(etag)
    return headers
