"""File loading utilities."""

from __future__ import annotations

import json
from pathlib import Path


def load_json(path: Path) -> dict:
    """Load a JSON file from disk."""

    if not path.exists():
        raise FileNotFoundError(f"JSON file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))
