from __future__ import annotations

from zodiac_art.config import (
    build_database_url,
    get_dev_mode,
    get_redis_url,
    get_session_ttl_seconds,
    load_config,
)


def test_load_config_defaults_without_sweph_path(monkeypatch):
    monkeypatch.delenv("SWEPH_PATH", raising=False)
    config = load_config()

    assert config.sweph_path is None


def test_build_database_url_prefers_database_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")

    assert build_database_url() == "postgresql://example"


def test_build_database_url_from_pg_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("PGHOST", "localhost")
    monkeypatch.setenv("PGPORT", "5433")
    monkeypatch.setenv("PGUSER", "user")
    monkeypatch.setenv("PGPASSWORD", "pass")
    monkeypatch.setenv("PGDATABASE", "zodiac_art")

    assert build_database_url() == "postgresql://user:pass@localhost:5433/zodiac_art"


def test_get_dev_mode_true_values(monkeypatch):
    monkeypatch.setenv("DEV_MODE", "true")

    assert get_dev_mode() is True


def test_get_redis_url(monkeypatch):
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")

    assert get_redis_url() == "redis://localhost:6379/0"


def test_get_session_ttl_seconds(monkeypatch):
    monkeypatch.setenv("CHART_SESSION_TTL_SECONDS", "120")

    assert get_session_ttl_seconds() == 120
