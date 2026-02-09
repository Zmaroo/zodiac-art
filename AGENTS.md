# AGENTS

This document is for automated coding agents working in this repo.
Keep changes small, focused, and aligned with existing conventions.

## Quick Facts
- Primary language: Python 3.11 (conda environment).
- No explicit lint/test tooling is configured yet.
- CLI entry point: `zodiac_art/main.py` (runs an example when no args).
- API entry point: `zodiac_art/api/app.py` (FastAPI).
- Config defaults: `zodiac_art/config.py` with env overrides.
- Frames live in `frames/`; outputs written to `output/`.

## Build / Run / Test Commands
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

### Build Artifacts
This repo does not have a separate build step. Running the CLI produces:

- SVG output in `output/`
- PNG output in `output/`

### Linting
No lint configuration is present (no ruff/flake8/black). If you add one,
update this file with the exact command.

### Tests
No test framework is configured (no pytest/unittest discovery). If you
introduce pytest, document commands here. Suggested patterns:

```bash
pytest
pytest path/to/test_file.py::test_name
```

If you add a different runner, include a single-test command, e.g.:

```bash
python -m unittest path.to.module.TestClass.test_name
```

## Code Style Guidelines
### Imports
- Use absolute imports within the package, e.g. `from zodiac_art.utils...`.
- Standard library imports first, then third-party, then local modules.
- Keep import groups separated by a single blank line.

### Formatting
- Use 4-space indentation.
- Keep lines reasonably short and avoid excessive wrapping.
- Use f-strings for string interpolation.
- Use double quotes for user-facing messages and f-strings.
- Keep docstrings concise and one-line when possible.

### Typing
- Use `from __future__ import annotations` in modules.
- Prefer explicit type hints for function parameters and returns.
- Use `list[...]`, `dict[...]`, and `tuple[...]` generics.
- Dataclasses are used for structured data; prefer `@dataclass(frozen=True)`.
- Use `Path` and `Path | None` for optional filesystem paths.

### Naming Conventions
- Modules: `snake_case.py`.
- Classes: `PascalCase` (e.g., `SvgChartRenderer`).
- Functions and variables: `snake_case`.
- Constants: `UPPER_SNAKE_CASE`.

### Error Handling
- Validate inputs early and raise `ValueError` for invalid user input.
- Wrap external library failures with a clear `RuntimeError` and `from exc`.
- Let exceptions propagate to `main`, which prints a single-line error.
- Prefer clear, user-facing error text for CLI usage.

### Data and Paths
- Use `pathlib.Path` for filesystem paths.
- Prefer small helper functions for transformations (e.g., normalize degrees).
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

## Project-Specific Notes
- `zodiac_art/main.py` runs an example when no CLI args are provided.
- `frames/*.json` provides chart placement; `frames/*.png` is the artwork.
- Output paths are returned as a dataclass `CompositeOutput`.
- The compositor writes SVG first, then uses CairoSVG to export PNG.
- Chart rendering is in `zodiac_art/renderer/`; frame assembly in `zodiac_art/frames/`.

## Cursor / Copilot Rules
None found. No `.cursor/rules/`, `.cursorrules`, or
`.github/copilot-instructions.md` exist in this repository.

## When You Make Changes
- Update this file if you add lint/test tooling or new entry points.
- Keep edits minimal and consistent with existing conventions.
- Avoid reformatting unrelated code.
