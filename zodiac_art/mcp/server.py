"""MCP server for local dev tools."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal, cast
from urllib.parse import urlencode
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


def _mcp_transport() -> Literal["stdio", "sse", "streamable-http"]:
    value = _env_str("MCP_TRANSPORT", "stdio")
    if value not in {"stdio", "sse", "streamable-http"}:
        raise ValueError(f"Invalid MCP_TRANSPORT: {value}")
    return cast(Literal["stdio", "sse", "streamable-http"], value)


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


def _request_bytes(method: str, path: str, token: str | None) -> bytes:
    url = f"{_api_base()}{path}"
    request = Request(url=url, data=None, method=method)
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urlopen(request, timeout=30) as response:
            return response.read()
    except HTTPError as exc:
        detail = exc.read().decode("utf-8") if exc.fp else ""
        raise RuntimeError(f"HTTP {exc.code} {method} {path} {detail}") from exc
    except URLError as exc:
        raise RuntimeError(f"Request failed: {method} {path} {exc.reason}") from exc


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = value.strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _presets_path() -> Path:
    base = Path("storage") / "presets"
    base.mkdir(parents=True, exist_ok=True)
    return base / "layout_presets.json"


def _load_presets() -> dict[str, Any]:
    path = _presets_path()
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _save_presets(presets: dict[str, Any]) -> None:
    path = _presets_path()
    path.write_text(json.dumps(presets, indent=2, sort_keys=True), encoding="utf-8")


def _diff_values(left: Any, right: Any, prefix: str = "") -> list[dict[str, Any]]:
    if left == right:
        return []
    if isinstance(left, dict) and isinstance(right, dict):
        diffs: list[dict[str, Any]] = []
        keys = set(left.keys()) | set(right.keys())
        for key in sorted(keys):
            next_prefix = f"{prefix}.{key}" if prefix else key
            if key not in left:
                diffs.append({"path": next_prefix, "left": None, "right": right[key]})
            elif key not in right:
                diffs.append({"path": next_prefix, "left": left[key], "right": None})
            else:
                diffs.extend(_diff_values(left[key], right[key], next_prefix))
        return diffs
    if isinstance(left, list) and isinstance(right, list):
        if left == right:
            return []
        return [{"path": prefix or "[list]", "left": left, "right": right}]
    return [{"path": prefix or "[value]", "left": left, "right": right}]


def _extract_frame_id(payload: Any) -> str | None:
    if isinstance(payload, dict):
        return (
            payload.get("frame_id")
            or payload.get("id")
            or payload.get("frameId")
            or payload.get("frameID")
        )
    return None


def _render_to_file(
    chart_id: str,
    frame_id: str | None,
    format: str,
    size: int | None,
    chart_only: bool,
    export: bool,
    token: str,
) -> dict[str, Any]:
    ext = "png" if format.lower() == "png" else "svg"
    base = "render_export" if export else "render"
    if chart_only:
        base = f"{base}_chart"
    endpoint = f"/api/charts/{chart_id}/{base}.{ext}"
    query: dict[str, Any] = {}
    if frame_id and not chart_only:
        query["frame_id"] = frame_id
    if size is not None and ext == "png":
        query["size"] = size
    path = endpoint
    if query:
        path = f"{endpoint}?{urlencode(query)}"
    data = _request_bytes("GET", path, token=token)
    output_dir = Path("output")
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    frame_slug = frame_id or ("chart_only" if chart_only else "frame")
    filename = f"mcp_{chart_id}_{frame_slug}_{'export' if export else 'preview'}.{ext}"
    output_path = output_dir / f"{stamp}_{filename}"
    output_path.write_bytes(data)
    return {
        "path": str(output_path),
        "bytes": len(data),
    }


@mcp.tool()
def list_frames() -> Any:
    token = _get_token()
    return _request_json("GET", "/api/frames", payload=None, token=token)


@mcp.tool()
def list_charts(
    name_contains: str | None = None,
    created_after: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> Any:
    token = _get_token()
    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)
    created_after_dt = _parse_iso_datetime(created_after)
    results: list[dict[str, Any]] = []
    page_size = 200
    scanned = 0
    while len(results) < safe_limit and scanned < 2000:
        query = urlencode({"limit": page_size, "offset": safe_offset})
        page = _request_json("GET", f"/api/charts?{query}", payload=None, token=token)
        if not isinstance(page, list) or not page:
            break
        for item in page:
            scanned += 1
            if not isinstance(item, dict):
                continue
            if name_contains and name_contains.lower() not in str(item.get("name", "")).lower():
                continue
            if created_after_dt:
                created_at = _parse_iso_datetime(str(item.get("created_at", "")))
                if not created_at or created_at <= created_after_dt:
                    continue
            results.append(item)
            if len(results) >= safe_limit:
                break
        if len(page) < page_size:
            break
        safe_offset += page_size
    return results


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


@mcp.tool()
def delete_chart_by_name(
    name: str,
    match: str = "exact",
    limit: int = 10,
    dry_run: bool = False,
) -> Any:
    token = _get_token()
    charts = list_charts(limit=200)
    deleted: list[dict[str, str]] = []
    match_value = name.lower()
    for item in charts:
        chart_name = str(item.get("name", ""))
        chart_id = str(item.get("chart_id", ""))
        if not chart_id:
            continue
        if match == "prefix" and not chart_name.lower().startswith(match_value):
            continue
        if match == "contains" and match_value not in chart_name.lower():
            continue
        if match == "exact" and chart_name.lower() != match_value:
            continue
        deleted.append({"chart_id": chart_id, "name": chart_name})
        if not dry_run:
            payload = {"chart_id": chart_id}
            _request_json("POST", "/api/dev/tools/chart/delete", payload=payload, token=token)
        if len(deleted) >= max(1, limit):
            break
    return {"status": "ok", "deleted": deleted, "dry_run": dry_run}


@mcp.tool()
def render_export_chart(
    chart_id: str,
    frame_id: str | None = None,
    format: str = "png",
    size: int | None = None,
    chart_only: bool = False,
    export: bool = True,
) -> Any:
    token = _get_token()
    result = _render_to_file(chart_id, frame_id, format, size, chart_only, export, token)
    return {"status": "ok", **result}


@mcp.tool()
def get_editor_state(chart_id: str, frame_id: str | None = None) -> Any:
    token = _get_token()
    chart = _request_json("GET", f"/api/charts/{chart_id}", payload=None, token=token)
    resolved_frame = frame_id or chart.get("default_frame_id")
    layout = _request_json("GET", f"/api/charts/{chart_id}/layout", payload=None, token=token)
    chart_fit = None
    try:
        chart_fit = _request_json(
            "GET", f"/api/charts/{chart_id}/chart_fit", payload=None, token=token
        )
    except RuntimeError:
        chart_fit = None
    frame_layout = None
    frame_meta = None
    if resolved_frame:
        frame_layout = _request_json(
            "GET",
            f"/api/charts/{chart_id}/frames/{resolved_frame}/layout",
            payload=None,
            token=token,
        )
        frame_meta = _request_json(
            "GET",
            f"/api/charts/{chart_id}/frames/{resolved_frame}/metadata",
            payload=None,
            token=token,
        )
    return {
        "chart": chart,
        "frame_id": resolved_frame,
        "chart_layout": layout,
        "chart_fit": chart_fit,
        "frame_layout": frame_layout,
        "frame_meta": frame_meta,
    }


@mcp.tool()
def save_layout_preset(
    name: str,
    chart_id: str,
    frame_id: str,
    include_meta: bool = True,
) -> Any:
    token = _get_token()
    payload = _request_json(
        "GET",
        f"/api/dev/tools/layout?{urlencode({'chart_id': chart_id, 'frame_id': frame_id})}",
        payload=None,
        token=token,
    )
    preset = {
        "name": name,
        "chart_id": chart_id,
        "frame_id": frame_id,
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "layout": payload.get("layout") if isinstance(payload, dict) else None,
    }
    if include_meta:
        preset["meta"] = payload.get("meta") if isinstance(payload, dict) else None
    presets = _load_presets()
    presets[name] = preset
    _save_presets(presets)
    return {"status": "ok", "preset": preset}


@mcp.tool()
def apply_layout_preset(
    name: str,
    chart_id: str,
    frame_id: str,
    apply_meta: bool = True,
) -> Any:
    token = _get_token()
    presets = _load_presets()
    preset = presets.get(name)
    if not isinstance(preset, dict):
        raise RuntimeError(f"Preset not found: {name}")
    layout_payload = preset.get("layout") if isinstance(preset.get("layout"), dict) else None
    if layout_payload:
        update_payload = {
            "chart_id": chart_id,
            "frame_id": frame_id,
            "overrides": layout_payload.get("overrides"),
            "design": layout_payload.get("design"),
            "chart_fit": layout_payload.get("chart_fit"),
            "frame_circle": layout_payload.get("frame_circle"),
            "chart_occluders": layout_payload.get("chart_occluders"),
        }
        _request_json("POST", "/api/dev/tools/layout/update", payload=update_payload, token=token)
    if apply_meta and isinstance(preset.get("meta"), dict):
        _request_json(
            "PUT",
            f"/api/charts/{chart_id}/frames/{frame_id}/metadata",
            payload=preset["meta"],
            token=token,
        )
    return {"status": "ok", "preset": name}


@mcp.tool()
def list_layout_presets() -> Any:
    return _load_presets()


@mcp.tool()
def validate_chart(chart_id: str, frame_id: str | None = None, render: bool = False) -> Any:
    token = _get_token()
    issues: list[str] = []
    chart = _request_json("GET", f"/api/charts/{chart_id}", payload=None, token=token)
    resolved_frame = frame_id or chart.get("default_frame_id")
    if not resolved_frame:
        issues.append("No frame_id provided and chart has no default_frame_id")
        return {"status": "warning", "issues": issues}
    try:
        _request_json("GET", f"/api/frames/{resolved_frame}", payload=None, token=token)
    except RuntimeError as exc:
        issues.append(f"Frame missing: {resolved_frame} ({exc})")
    try:
        _request_json(
            "GET",
            f"/api/charts/{chart_id}/frames/{resolved_frame}/layout",
            payload=None,
            token=token,
        )
    except RuntimeError as exc:
        issues.append(f"Layout missing: {exc}")
    try:
        _request_json(
            "GET",
            f"/api/charts/{chart_id}/frames/{resolved_frame}/metadata",
            payload=None,
            token=token,
        )
    except RuntimeError as exc:
        issues.append(f"Metadata missing: {exc}")
    if render and not issues:
        try:
            _request_bytes(
                "GET",
                f"/api/charts/{chart_id}/render.svg?{urlencode({'frame_id': resolved_frame})}",
                token=token,
            )
        except RuntimeError as exc:
            issues.append(f"Render failed: {exc}")
    status = "ok" if not issues else "warning"
    return {"status": status, "chart_id": chart_id, "frame_id": resolved_frame, "issues": issues}


@mcp.tool()
def diff_layouts(
    chart_id_a: str,
    chart_id_b: str,
    frame_id: str,
) -> Any:
    token = _get_token()
    layout_a = _request_json(
        "GET",
        f"/api/charts/{chart_id_a}/frames/{frame_id}/layout",
        payload=None,
        token=token,
    )
    layout_b = _request_json(
        "GET",
        f"/api/charts/{chart_id_b}/frames/{frame_id}/layout",
        payload=None,
        token=token,
    )
    diffs = _diff_values(layout_a, layout_b)
    return {"status": "ok", "diff_count": len(diffs), "diffs": diffs}


@mcp.tool()
def seed_walkthrough(
    name: str | None = None,
    birth_date: str = "1990-04-12",
    birth_time: str = "08:45",
    latitude: float = 40.7128,
    longitude: float = -74.0060,
    frame_id: str | None = None,
) -> Any:
    token = _get_token()
    if frame_id is None:
        frames = _request_json("GET", "/api/frames", payload=None, token=token)
        if isinstance(frames, list):
            for item in frames:
                frame_id = _extract_frame_id(item)
                if frame_id:
                    break
        elif isinstance(frames, dict):
            frame_id = _extract_frame_id(frames)
        if frame_id is None:
            raise RuntimeError("No frames available to seed walkthrough")
    payload: dict[str, Any] = {
        "birth_date": birth_date,
        "birth_time": birth_time,
        "latitude": latitude,
        "longitude": longitude,
    }
    if name is not None:
        payload["name"] = name
    if frame_id is not None:
        payload["default_frame_id"] = frame_id
    result = _request_json("POST", "/api/dev/tools/chart/seed", payload=payload, token=token)
    chart_id = result.get("chart_id") if isinstance(result, dict) else None
    return {"status": "ok", "chart_id": chart_id, "frame_id": frame_id}


@mcp.tool()
def render_batch(
    chart_ids: list[str],
    frame_id: str | None = None,
    format: str = "png",
    size: int | None = None,
    chart_only: bool = False,
    export: bool = True,
) -> Any:
    token = _get_token()
    results: list[dict[str, Any]] = []
    for chart_id in chart_ids:
        try:
            item = _render_to_file(chart_id, frame_id, format, size, chart_only, export, token)
            results.append({"chart_id": chart_id, **item})
        except RuntimeError as exc:
            results.append({"chart_id": chart_id, "error": str(exc)})
    return {"status": "ok", "results": results}


@mcp.tool()
def cleanup_charts(
    name_prefix: str | None = None,
    older_than_days: int | None = None,
    limit: int = 50,
    dry_run: bool = False,
) -> Any:
    token = _get_token()
    charts = list_charts(limit=200)
    cutoff: datetime | None = None
    if older_than_days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
    deleted: list[dict[str, str]] = []
    for item in charts:
        if not isinstance(item, dict):
            continue
        chart_id = str(item.get("chart_id", ""))
        chart_name = str(item.get("name", ""))
        if not chart_id:
            continue
        if name_prefix and not chart_name.lower().startswith(name_prefix.lower()):
            continue
        if cutoff:
            created_at = _parse_iso_datetime(str(item.get("created_at", "")))
            if not created_at or created_at >= cutoff:
                continue
        deleted.append({"chart_id": chart_id, "name": chart_name})
        if not dry_run:
            _request_json(
                "POST", "/api/dev/tools/chart/delete", payload={"chart_id": chart_id}, token=token
            )
        if len(deleted) >= max(1, limit):
            break
    return {"status": "ok", "deleted": deleted, "dry_run": dry_run}


@mcp.tool()
def frame_asset_check(tag: str | None = None, limit: int = 200) -> Any:
    token = _get_token()
    query: dict[str, Any] = {"limit": max(1, min(limit, 500))}
    if tag:
        query["tag"] = tag
    frames = _request_json("GET", f"/api/frames?{urlencode(query)}", payload=None, token=token)
    results: list[dict[str, Any]] = []
    if not isinstance(frames, list):
        return {"status": "warning", "issues": ["Frame list not available"]}
    for item in frames:
        frame_id = _extract_frame_id(item)
        if not frame_id:
            continue
        issues: list[str] = []
        detail = _request_json("GET", f"/api/frames/{frame_id}", payload=None, token=token)
        image_url = detail.get("image_url") if isinstance(detail, dict) else None
        thumb_url = detail.get("thumb_url") if isinstance(detail, dict) else None
        if not image_url:
            issues.append("missing image_url")
        if not thumb_url:
            issues.append("missing thumb_url")
        if isinstance(detail, dict) and detail.get("template_metadata_json") is None:
            issues.append("missing template_metadata_json")
        results.append({"frame_id": frame_id, "issues": issues})
    status = "ok" if all(not r["issues"] for r in results) else "warning"
    return {"status": status, "results": results}


@mcp.tool()
def smoke_walkthrough(
    name: str | None = None,
    frame_id: str | None = None,
    format: str = "png",
    size: int | None = 1200,
    cleanup: bool = True,
) -> Any:
    seeded = seed_walkthrough(name=name, frame_id=frame_id)
    chart_id = seeded.get("chart_id") if isinstance(seeded, dict) else None
    frame_id = seeded.get("frame_id") if isinstance(seeded, dict) else frame_id
    if not chart_id:
        raise RuntimeError("Failed to seed walkthrough chart")
    update_layout(
        chart_id=chart_id,
        frame_id=frame_id,
        chart_fit={"dx": 4, "dy": 2, "scale": 1.03, "rotation_deg": 1.0},
        frame_circle={"cxNorm": 0.5, "cyNorm": 0.5, "rxNorm": 0.25, "ryNorm": 0.25},
    )
    render_result = render_export_chart(
        chart_id=chart_id,
        frame_id=frame_id,
        format=format,
        size=size,
        chart_only=False,
        export=True,
    )
    validation = validate_chart(chart_id=chart_id, frame_id=frame_id, render=True)
    if cleanup:
        delete_chart(chart_id)
    return {
        "status": "ok",
        "chart_id": chart_id,
        "frame_id": frame_id,
        "render": render_result,
        "validation": validation,
        "cleaned": cleanup,
    }


def main() -> None:
    mcp.run(transport=_mcp_transport())


if __name__ == "__main__":
    main()
