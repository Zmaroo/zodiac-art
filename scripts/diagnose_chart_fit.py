"""Diagnose chart_fit persistence via the HTTP API.

Usage:
  ZODIAC_API_BASE_URL=http://127.0.0.1:8000 \
  ZODIAC_API_EMAIL=you@example.com \
  ZODIAC_API_PASSWORD=secret \
  python scripts/diagnose_chart_fit.py

Or provide a token directly:
  ZODIAC_API_TOKEN=... python scripts/diagnose_chart_fit.py
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip() or default


def _request_json(
    base_url: str,
    method: str,
    path: str,
    payload: dict | None = None,
    token: str | None = None,
) -> Any:
    url = f"{base_url}{path}"
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = Request(url=url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"HTTP {exc.code} {method} {path} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Request failed: {method} {path} {exc.reason}") from exc
    if not body:
        return None
    return json.loads(body)


def _login(base_url: str, email: str, password: str) -> str:
    payload = {"email": email, "password": password}
    data = _request_json(base_url, "POST", "/api/auth/login", payload)
    token = data.get("token") if isinstance(data, dict) else None
    if not token:
        raise RuntimeError("Login failed: no token in response")
    return token


def _pick_frame(base_url: str, token: str) -> dict:
    frames = _request_json(base_url, "GET", "/api/frames", token=token)
    if not isinstance(frames, list) or not frames:
        raise RuntimeError("No frames returned by /api/frames")
    return frames[0]


def _get_frame_detail(base_url: str, token: str, frame_id: str) -> dict:
    detail = _request_json(base_url, "GET", f"/api/frames/{frame_id}", token=token)
    if not isinstance(detail, dict):
        raise RuntimeError("Frame detail response invalid")
    return detail


def _create_chart(base_url: str, token: str, frame_id: str) -> str:
    payload = {
        "name": f"diagnose-chart-fit-{int(time.time())}",
        "birth_date": "1990-04-12",
        "birth_time": "08:45",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "default_frame_id": frame_id,
    }
    data = _request_json(base_url, "POST", "/api/charts", payload, token=token)
    chart_id = data.get("chart_id") if isinstance(data, dict) else None
    if not chart_id:
        raise RuntimeError("Create chart failed: no chart_id in response")
    return chart_id


def _summarize_fit(fit: dict | None) -> str:
    if not isinstance(fit, dict):
        return "none"
    return f"dx={fit.get('dx')} dy={fit.get('dy')} scale={fit.get('scale')}"


def main() -> int:
    base_url = _env("ZODIAC_API_BASE_URL", "http://127.0.0.1:8000")
    token = _env("ZODIAC_API_TOKEN")
    if not token:
        email = _env("ZODIAC_API_EMAIL")
        password = _env("ZODIAC_API_PASSWORD")
        if not email or not password:
            raise RuntimeError("Set ZODIAC_API_TOKEN or ZODIAC_API_EMAIL and ZODIAC_API_PASSWORD.")
        token = _login(base_url, email, password)

    frame = _pick_frame(base_url, token)
    frame_id = frame.get("id")
    if not frame_id:
        raise RuntimeError("Frame list missing id")
    frame_detail = _get_frame_detail(base_url, token, frame_id)
    template_meta = frame_detail.get("template_metadata_json")
    if not isinstance(template_meta, dict):
        raise RuntimeError("Frame detail missing template_metadata_json")

    chart_id = _create_chart(base_url, token, frame_id)

    chart_fit = {"dx": 33.5, "dy": -21.25, "scale": 1.19, "rotation_deg": 0.0}
    layout_payload = {"version": 1, "overrides": {}, "chart_fit": chart_fit}
    _request_json(
        base_url,
        "PUT",
        f"/api/charts/{chart_id}/frames/{frame_id}/layout",
        layout_payload,
        token=token,
    )

    meta_payload = dict(template_meta)
    meta_payload["chart_fit"] = chart_fit
    _request_json(
        base_url,
        "PUT",
        f"/api/charts/{chart_id}/frames/{frame_id}/metadata",
        meta_payload,
        token=token,
    )

    loaded_layout = _request_json(
        base_url,
        "GET",
        f"/api/charts/{chart_id}/frames/{frame_id}/layout",
        token=token,
    )
    loaded_meta = _request_json(
        base_url,
        "GET",
        f"/api/charts/{chart_id}/frames/{frame_id}/metadata",
        token=token,
    )

    loaded_layout_fit = loaded_layout.get("chart_fit") if isinstance(loaded_layout, dict) else None
    loaded_meta_fit = loaded_meta.get("chart_fit") if isinstance(loaded_meta, dict) else None

    print(f"chart_id={chart_id} frame_id={frame_id}")
    print(f"saved_chart_fit={_summarize_fit(chart_fit)}")
    print(f"layout_chart_fit={_summarize_fit(loaded_layout_fit)}")
    print(f"metadata_chart_fit={_summarize_fit(loaded_meta_fit)}")

    if loaded_layout_fit != chart_fit or loaded_meta_fit != chart_fit:
        print("Mismatch detected: chart_fit did not persist correctly.")
        return 2

    print("chart_fit persisted correctly in layout and metadata.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001
        print(str(exc))
        raise SystemExit(1)
