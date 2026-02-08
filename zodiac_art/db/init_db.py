"""Initialize the Postgres schema."""

from __future__ import annotations

import asyncio
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

from zodiac_art.config import PROJECT_ROOT, build_database_url


async def _init_db() -> None:
    load_dotenv(override=False)
    database_url = build_database_url()
    if not database_url:
        raise RuntimeError("Database is not configured. Set DATABASE_URL or PG* vars.")
    schema_path = Path(PROJECT_ROOT) / "db" / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")
    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute(schema_sql)
    finally:
        await conn.close()
    print("Database schema initialized.")


def main() -> None:
    asyncio.run(_init_db())


if __name__ == "__main__":
    main()
