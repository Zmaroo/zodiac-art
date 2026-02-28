"""MCP server for local dev tools."""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP  # type: ignore[import-not-found]

load_dotenv(override=False)


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Invalid integer for {name}: {value}") from exc


def _env_str(name: str, default: str) -> str:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _mcp_host() -> str:
    return _env_str("MCP_HOST", "127.0.0.1")


def _mcp_port() -> int:
    return _env_int("MCP_PORT", 7331)


def _mcp_transport() -> str:
    return _env_str("MCP_TRANSPORT", "stdio")


mcp = FastMCP("zodiac-tools", host=_mcp_host(), port=_mcp_port())


def _api_base() -> str:
    return os.environ.get("ZODIAC_API_BASE_URL", "http://127.0.0.1:8000")


_token_cache: str | None = None


def _get_token() -> str:
    global _token_cache
    if _token_cache:
        return _token_cache
    token = os.environ.get("ZODIAC_API_TOKEN")
    if token:
        _token_cache = token.strip()
        return _token_cache
    email = os.environ.get("ZODIAC_API_EMAIL")
    password = os.environ.get("ZODIAC_API_PASSWORD")
    if not email or not password:
        raise RuntimeError("Set ZODIAC_API_TOKEN or ZODIAC_API_EMAIL and ZODIAC_API_PASSWORD")
    payload = {"email": email, "password": password}
    data = _request_json("POST", "/api/auth/login", payload, token=None)
    token_value = data.get("token") if isinstance(data, dict) else None
    if not token_value:
        raise RuntimeError("Login failed: no token in response")
    _token_cache = token_value
    return token_value


def _request_json(method: str, path: str, payload: dict | None, token: str | None) -> Any:
    url = f"{_api_base()}{path}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(url=url, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"HTTP {exc.code} {method} {path} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Request failed: {method} {path} {exc.reason}") from exc
    if not body:
        return None
    return json.loads(body)


@mcp.tool()
def list_frames() -> Any:
    token = _get_token()
    return _request_json("GET", "/api/frames", payload=None, token=token)


@mcp.tool()
def list_charts() -> Any:
    token = _get_token()
    return _request_json("GET", "/api/charts", payload=None, token=token)


@mcp.tool()
def get_chart(chart_id: str) -> Any:
    token = _get_token()
    return _request_json("GET", f"/api/charts/{chart_id}", payload=None, token=token)


@mcp.tool()
def get_frame(frame_id: str) -> Any:
    token = _get_token()
    return _request_json("GET", f"/api/frames/{frame_id}", payload=None, token=token)


@mcp.tool()
def create_chart(
    name: str,
    birth_date: str,
    birth_time: str,
    latitude: float,
    longitude: float,
    default_frame_id: str | None = None,
) -> Any:
    token = _get_token()
    payload = {
        "name": name,
        "birth_date": birth_date,
        "birth_time": birth_time,
        "latitude": latitude,
        "longitude": longitude,
        "default_frame_id": default_frame_id,
    }
    return _request_json("POST", "/api/charts", payload=payload, token=token)


@mcp.tool()
def create_chart_with_frame(
    name: str,
    birth_date: str,
    birth_time: str,
    latitude: float,
    longitude: float,
    frame_id: str,
) -> Any:
    return create_chart(
        name=name,
        birth_date=birth_date,
        birth_time=birth_time,
        latitude=latitude,
        longitude=longitude,
        default_frame_id=frame_id,
    )


@mcp.tool()
def duplicate_chart(
    chart_id: str,
    frame_id: str | None = None,
    name_suffix: str = "copy",
) -> Any:
    token = _get_token()
    payload: dict[str, Any] = {
        "chart_id": chart_id,
        "name_suffix": name_suffix,
    }
    if frame_id is not None:
        payload["frame_id"] = frame_id
    return _request_json("POST", "/api/dev/tools/chart/duplicate", payload=payload, token=token)


@mcp.tool()
def seed_test_chart(
    name: str | None = None,
    birth_date: str = "1990-04-12",
    birth_time: str = "08:45",
    latitude: float = 40.7128,
    longitude: float = -74.0060,
    default_frame_id: str | None = None,
) -> Any:
    token = _get_token()
    payload: dict[str, Any] = {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "latitude": latitude,
        "longitude": longitude,
    }
    if name is not None:
        payload["name"] = name
    if default_frame_id is not None:
        payload["default_frame_id"] = default_frame_id
    return _request_json("POST", "/api/dev/tools/chart/seed", payload=payload, token=token)


@mcp.tool()
def get_layout(chart_id: str, frame_id: str) -> Any:
    token = _get_token()
    path = f"/api/dev/tools/layout?chart_id={chart_id}&frame_id={frame_id}"
    return _request_json("GET", path, payload=None, token=token)


@mcp.tool()
def set_chart_fit(
    chart_id: str,
    frame_id: str,
    dx: float,
    dy: float,
    scale: float,
    rotation_deg: float = 0.0,
) -> Any:
    token = _get_token()
    payload = {
        "chart_id": chart_id,
        "frame_id": frame_id,
        "chart_fit": {
            "dx": dx,
            "dy": dy,
            "scale": scale,
            "rotation_deg": rotation_deg,
        },
    }
    return _request_json("POST", "/api/dev/tools/chart-fit", payload=payload, token=token)


@mcp.tool()
def nudge_chart_fit(
    chart_id: str,
    frame_id: str,
    dx: float = 0.0,
    dy: float = 0.0,
    scale_delta: float = 0.0,
    scale_mult: float = 1.0,
    rotation_delta: float = 0.0,
) -> Any:
    token = _get_token()
    payload = {
        "chart_id": chart_id,
        "frame_id": frame_id,
        "dx": dx,
        "dy": dy,
        "scale_delta": scale_delta,
        "scale_mult": scale_mult,
        "rotation_delta": rotation_delta,
    }
    return _request_json("POST", "/api/dev/tools/chart-fit/nudge", payload=payload, token=token)


@mcp.tool()
def set_frame_mask(
    chart_id: str,
    frame_id: str,
    cx_norm: float,
    cy_norm: float,
    rx_norm: float,
    ry_norm: float,
) -> Any:
    token = _get_token()
    payload = {
        "chart_id": chart_id,
        "frame_id": frame_id,
        "cx_norm": cx_norm,
        "cy_norm": cy_norm,
        "rx_norm": rx_norm,
        "ry_norm": ry_norm,
    }
    return _request_json("POST", "/api/dev/tools/frame-mask", payload=payload, token=token)


@mcp.tool()
def nudge_frame_mask(
    chart_id: str,
    frame_id: str,
    cx_norm_delta: float = 0.0,
    cy_norm_delta: float = 0.0,
    rx_norm_delta: float = 0.0,
    ry_norm_delta: float = 0.0,
) -> Any:
    token = _get_token()
    payload = {
        "chart_id": chart_id,
        "frame_id": frame_id,
        "cx_norm_delta": cx_norm_delta,
        "cy_norm_delta": cy_norm_delta,
        "rx_norm_delta": rx_norm_delta,
        "ry_norm_delta": ry_norm_delta,
    }
    return _request_json("POST", "/api/dev/tools/frame-mask/nudge", payload=payload, token=token)


@mcp.tool()
def update_layout(
    chart_id: str,
    frame_id: str,
    overrides: dict | None = None,
    design: dict | None = None,
    chart_fit: dict | None = None,
    frame_circle: dict | None = None,
    chart_occluders: list | None = None,
    update_meta: bool = False,
) -> Any:
    token = _get_token()
    payload: dict[str, Any] = {
        "chart_id": chart_id,
        "frame_id": frame_id,
        "update_meta": update_meta,
    }
    if overrides is not None:
        payload["overrides"] = overrides
    if design is not None:
        payload["design"] = design
    if chart_fit is not None:
        payload["chart_fit"] = chart_fit
    if frame_circle is not None:
        payload["frame_circle"] = frame_circle
    if chart_occluders is not None:
        payload["chart_occluders"] = chart_occluders
    return _request_json("POST", "/api/dev/tools/layout/update", payload=payload, token=token)


@mcp.tool()
def reset_layout(
    chart_id: str,
    frame_id: str,
    clear_chart_fit: bool = False,
) -> Any:
    token = _get_token()
    payload = {
        "chart_id": chart_id,
        "frame_id": frame_id,
        "clear_chart_fit": clear_chart_fit,
    }
    return _request_json("POST", "/api/dev/tools/layout/reset", payload=payload, token=token)


@mcp.tool()
def reset_chart_layout(chart_id: str) -> Any:
    token = _get_token()
    payload = {"chart_id": chart_id}
    return _request_json("POST", "/api/dev/tools/chart/layout/reset", payload=payload, token=token)


@mcp.tool()
def clear_chart_layout(chart_id: str) -> Any:
    return reset_chart_layout(chart_id)


@mcp.tool()
def delete_chart(chart_id: str) -> Any:
    token = _get_token()
    payload = {"chart_id": chart_id}
    return _request_json("POST", "/api/dev/tools/chart/delete", payload=payload, token=token)


def main() -> None:
    mcp.run(transport=_mcp_transport())


if __name__ == "__main__":
    main()
