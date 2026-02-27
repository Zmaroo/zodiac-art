# AGENTS
This document is for automated coding agents working in this repo.
Keep changes small, focused, and aligned with existing conventions.
## Quick Facts
- Primary language: Python 3.11 (conda env in `environment.yml`).
- Linting/formatting: ruff (line length 100; excludes `output/` and `storage/`).
- Tests: pytest (defaults include `-ra`; tests in `tests/`).
- CLI entry point: `zodiac_art/main.py` (runs an example when no args).
- API entry point: `zodiac_art/api/app.py` (FastAPI).
- Config defaults in `zodiac_art/config.py`, with env overrides.
- Frames live in `frames/`; outputs written to `output/`.
- Optional Redis sessions when `REDIS_URL` is set.
## Repo Layout
- `zodiac_art/`: package source.
- `zodiac_art/api/`: API entry and routes.
- `zodiac_art/renderer/`: SVG chart rendering.
- `zodiac_art/frames/`: frame assembly and compositing.
- `frames/`: frame metadata (`.json`) and art (`.png`).
- `output/`: generated SVG/PNG artifacts.
- `environment.yml`: conda environment definition.
## Build / Run / Test Commands
No separate build step; create the env and run Python entry points.
### Environment Setup
```bash
conda activate base
conda install -n base -c conda-forge mamba
mamba env create -f environment.yml
conda activate zodiac_art
```
### Verify Dependencies
```bash
python test_env.py
```
### Run the CLI
Example run (uses defaults if no args):
```bash
python -m zodiac_art.main
```
Custom run:
```bash
python -m zodiac_art.main \
  --birth-date 1990-04-12 \
  --birth-time 08:45 \
  --latitude 40.7128 \
  --longitude -74.0060 \
  --frame default \
  --output-name example_zodiac_art
```
### Run the API
```bash
python -m zodiac_art.api.app
```
### Dev Server Control
Helper script starts/stops API/editor/MCP/Chrome with PID files.
Logs are written to `.opencode/logs/`.
```bash
python scripts/dev_servers.py start api --dev-tools
python scripts/dev_servers.py start editor
python scripts/dev_servers.py start chrome
python scripts/dev_servers.py start mcp
python scripts/dev_servers.py stop all
python scripts/dev_servers.py status all
python scripts/dev_servers.py tail api --lines 200 --follow
```
### Lint and Format
```bash
ruff check .
ruff format .
```
Optional autofix:
```bash
ruff check . --fix
```
### Tests (All)
```bash
pytest
```
### Tests (Single)
Use pytest node IDs, file paths, or `-k`:
```bash
pytest tests/test_config.py::test_build_database_url_from_pg_env
pytest tests/test_session_storage.py::test_session_round_trip
pytest tests/test_session_storage.py::TestSessionStorage::test_round_trip
pytest tests/test_session_storage.py -k round_trip
pytest -k "session and round_trip" -vv
```
## Code Style Guidelines
### Imports
- Use absolute imports within the package (e.g., `from zodiac_art.utils...`).
- Standard library imports first, then third-party, then local modules.
- Keep import groups separated by a single blank line.
- Avoid unused imports; use local imports only to avoid heavy deps.
### Formatting
- Use 4-space indentation.
- Keep lines reasonably short (100 chars) and avoid excessive wrapping.
- Use f-strings for string interpolation.
- Use double quotes for user-facing messages and f-strings.
- Keep docstrings concise and one-line when possible.
- Avoid reformatting unrelated code.
### Typing
- Use `from __future__ import annotations` in modules.
- Prefer explicit type hints for function parameters and returns.
- Use `list[...]`, `dict[...]`, and `tuple[...]` generics.
- Dataclasses are used for structured data; prefer `@dataclass(frozen=True)`.
- Use `Path` and `Path | None` for optional filesystem paths.
- Favor small, typed helper functions over complex inline logic.
### Naming Conventions
- Modules: `snake_case.py`.
- Classes: `PascalCase`.
- Functions and variables: `snake_case`.
- Constants: `UPPER_SNAKE_CASE`.
- CLI options: kebab-case flags mapped to snake_case vars.
### Error Handling
- Validate inputs early and raise `ValueError` for invalid user input.
- Wrap external library failures with a clear `RuntimeError` and `from exc`.
- Let exceptions propagate to `main`, which prints a single-line error.
- Prefer clear, user-facing error text for CLI usage.
- Avoid swallowing exceptions unless retrying or adding context.
### Testing
- Pytest defaults to `-ra`; keep new tests compatible with that output.
- Tests live in `tests/` and import from the repo root via `pythonpath`.
- Prefer focused unit tests; keep fixtures minimal and readable.
### Data and Paths
- Use `pathlib.Path` for filesystem paths.
- JSON loading should validate file existence and raise `FileNotFoundError`.
- Keep assets and output paths configurable via config/env.
### SVG / Rendering
- Keep rendering logic in `zodiac_art/renderer/`.
- Use `svgwrite` for SVG generation.
- Avoid non-deterministic rendering; math should be reproducible.
- Glyphs are configurable via `glyph_mode` (unicode/ascii).
### Configuration
- Centralize defaults in `zodiac_art/config.py`.
- Support overrides via environment variables (e.g., `SWEPH_PATH`).
- Do not hardcode filesystem paths outside config or CLI args.
### Redis Sessions
- `REDIS_URL` enables chart sessions backed by Redis.
- `CHART_SESSION_TTL_SECONDS` controls session TTL (default 604800).
- Sessions store chart inputs + per-frame layout/meta overrides; saved charts persist in DB.
## Cursor / Copilot Rules
None found in `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md`.
## When You Make Changes
- Update this file if you add lint/test tooling or new entry points.
- Keep edits minimal and consistent with existing conventions.
- Avoid reformatting unrelated code.
