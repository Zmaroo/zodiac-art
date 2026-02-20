"""Storage adapters for chart state."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from uuid import uuid4

from zodiac_art.config import PROJECT_ROOT
from zodiac_art.frames.frame_loader import SUPPORTED_IMAGE_EXTENSIONS
from zodiac_art.utils.file_utils import load_json


@dataclass(frozen=True)
class ChartRecord:
    """Stored chart inputs."""

    chart_id: str
    birth_date: str
    birth_time: str
    latitude: float
    longitude: float
    default_frame_id: str | None = None
    user_id: str | None = None
    name: str | None = None
    birth_place_text: str | None = None
    birth_place_id: str | None = None
    timezone: str | None = None
    birth_datetime_utc: str | None = None
    created_at: str | None = None
    updated_at: str | None = None

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "birth_date": self.birth_date,
            "birth_time": self.birth_time,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "default_frame_id": self.default_frame_id,
            "birth_place_text": self.birth_place_text,
            "birth_place_id": self.birth_place_id,
            "timezone": self.timezone,
            "birth_datetime_utc": self.birth_datetime_utc,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class FileStorage:
    """File-based storage for chart state."""

    def __init__(
        self,
        base_dir: Path | None = None,
        frames_dir: Path | None = None,
    ) -> None:
        self.base_dir = base_dir or PROJECT_ROOT / "data"
        self.frames_dir = frames_dir or PROJECT_ROOT / "zodiac_art" / "frames"

    def _chart_dir(self, chart_id: str) -> Path:
        return self.base_dir / "charts" / chart_id

    def _chart_file(self, chart_id: str) -> Path:
        return self._chart_dir(chart_id) / "chart.json"

    def _frame_state_dir(self, chart_id: str, frame_id: str) -> Path:
        return self._chart_dir(chart_id) / "frames" / frame_id

    def _metadata_path(self, chart_id: str, frame_id: str) -> Path:
        return self._frame_state_dir(chart_id, frame_id) / "metadata.json"

    def _layout_path(self, chart_id: str, frame_id: str) -> Path:
        return self._frame_state_dir(chart_id, frame_id) / "layout.json"

    def _chart_fit_path(self, chart_id: str) -> Path:
        return self._chart_dir(chart_id) / "chart_fit.json"

    def _chart_layout_path(self, chart_id: str) -> Path:
        return self._chart_dir(chart_id) / "layout.json"

    def _template_frame_dir(self, frame_id: str) -> Path:
        return self.frames_dir / frame_id

    def _template_meta_path(self, frame_id: str) -> Path:
        return self._template_frame_dir(frame_id) / "metadata.json"

    def _template_image_path(self, frame_id: str) -> Path:
        frame_dir = self._template_frame_dir(frame_id)
        candidates = [frame_dir / f"frame{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]
        existing = [path for path in candidates if path.exists()]
        if not existing:
            raise FileNotFoundError(f"Frame image not found for {frame_id}.")
        if len(existing) > 1:
            names = ", ".join(path.name for path in existing)
            raise ValueError(f"Multiple frame images found for {frame_id}: {names}")
        return existing[0]

    def list_frames(self) -> list[str]:
        if not self.frames_dir.exists():
            return []
        frame_ids: list[str] = []
        for child in sorted(self.frames_dir.iterdir(), key=lambda path: path.name):
            if child.is_dir() and (child / "metadata.json").exists():
                frame_ids.append(child.name)
        return frame_ids

    def create_chart(
        self,
        user_id: str | None,
        name: str | None,
        birth_date: str,
        birth_time: str,
        latitude: float,
        longitude: float,
        default_frame_id: str | None,
        birth_place_text: str | None = None,
        birth_place_id: str | None = None,
        timezone: str | None = None,
        birth_datetime_utc: str | None = None,
    ) -> ChartRecord:
        from datetime import datetime, timezone

        chart_id = str(uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        record = ChartRecord(
            chart_id=chart_id,
            user_id=user_id,
            name=name,
            birth_date=birth_date,
            birth_time=birth_time,
            latitude=latitude,
            longitude=longitude,
            default_frame_id=default_frame_id,
            birth_place_text=birth_place_text,
            birth_place_id=birth_place_id,
            timezone=timezone,
            birth_datetime_utc=birth_datetime_utc,
            created_at=timestamp,
            updated_at=timestamp,
        )
        chart_dir = self._chart_dir(chart_id)
        chart_dir.mkdir(parents=True, exist_ok=True)
        self._chart_file(chart_id).write_text(
            json.dumps(record.to_dict(), indent=2),
            encoding="utf-8",
        )
        return record

    def load_chart(self, chart_id: str) -> ChartRecord:
        chart_path = self._chart_file(chart_id)
        data = load_json(chart_path)
        return ChartRecord(
            chart_id=chart_id,
            user_id=data.get("user_id"),
            name=data.get("name"),
            birth_date=str(data.get("birth_date")),
            birth_time=str(data.get("birth_time")),
            latitude=float(data.get("latitude", 0.0)),
            longitude=float(data.get("longitude", 0.0)),
            default_frame_id=data.get("default_frame_id"),
            birth_place_text=data.get("birth_place_text"),
            birth_place_id=data.get("birth_place_id"),
            timezone=data.get("timezone"),
            birth_datetime_utc=data.get("birth_datetime_utc"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def list_charts(
        self,
        user_id: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[ChartRecord]:
        charts_dir = self.base_dir / "charts"
        if not charts_dir.exists():
            return []
        records: list[ChartRecord] = []
        for child in sorted(charts_dir.iterdir(), key=lambda path: path.name, reverse=True):
            if not child.is_dir():
                continue
            chart_file = child / "chart.json"
            if not chart_file.exists():
                continue
            record = self.load_chart(child.name)
            if user_id and record.user_id != user_id:
                continue
            records.append(record)
        if offset:
            records = records[offset:]
        return records[:limit]

    def chart_exists(self, chart_id: str) -> bool:
        return self._chart_file(chart_id).exists()

    def metadata_exists(self, chart_id: str, frame_id: str) -> bool:
        return self._metadata_path(chart_id, frame_id).exists()

    def layout_exists(self, chart_id: str, frame_id: str) -> bool:
        return self._layout_path(chart_id, frame_id).exists()

    def chart_fit_exists(self, chart_id: str) -> bool:
        return self._chart_fit_path(chart_id).exists()

    def chart_layout_exists(self, chart_id: str) -> bool:
        return self._chart_layout_path(chart_id).exists()

    def load_template_meta(self, frame_id: str) -> dict:
        return load_json(self._template_meta_path(frame_id))

    def load_chart_meta(self, chart_id: str, frame_id: str) -> dict | None:
        path = self._metadata_path(chart_id, frame_id)
        if not path.exists():
            return None
        return load_json(path)

    def load_chart_layout(self, chart_id: str, frame_id: str) -> dict | None:
        path = self._layout_path(chart_id, frame_id)
        if not path.exists():
            return None
        return load_json(path)

    def load_chart_fit(self, chart_id: str) -> dict | None:
        path = self._chart_fit_path(chart_id)
        if not path.exists():
            return None
        return load_json(path)

    def load_chart_layout_base(self, chart_id: str) -> dict | None:
        path = self._chart_layout_path(chart_id)
        if not path.exists():
            return None
        return load_json(path)

    def save_chart_meta(self, chart_id: str, frame_id: str, meta: dict) -> None:
        target = self._metadata_path(chart_id, frame_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    def save_chart_layout(self, chart_id: str, frame_id: str, layout: dict) -> None:
        target = self._layout_path(chart_id, frame_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(layout, indent=2), encoding="utf-8")

    def save_chart_fit(self, chart_id: str, chart_fit: dict) -> None:
        target = self._chart_fit_path(chart_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(chart_fit, indent=2), encoding="utf-8")

    def save_chart_layout_base(self, chart_id: str, layout: dict) -> None:
        target = self._chart_layout_path(chart_id)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(layout, indent=2), encoding="utf-8")

    def template_image_path(self, frame_id: str) -> Path:
        return self._template_image_path(frame_id)

    def template_meta_path(self, frame_id: str) -> Path:
        return self._template_meta_path(frame_id)

    def iter_frame_dirs(self) -> Iterable[Path]:
        if not self.frames_dir.exists():
            return []
        return sorted(
            [path for path in self.frames_dir.iterdir() if path.is_dir()],
            key=lambda path: path.name,
        )
