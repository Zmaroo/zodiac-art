"""FastAPI application for chart rendering."""

from __future__ import annotations

from zodiac_art.api.app_factory import create_app

app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("zodiac_art.api.app:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
