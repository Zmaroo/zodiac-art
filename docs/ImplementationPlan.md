# Implementation Plan: API + Rendering Improvements

This document outlines the staged implementation plan for improving API endpoints, rendering logic, and configuration best practices. It is intended as a final implementation plan.

---

## Phase 1 — Quick Wins (Low risk, high value)

1) **Validation & schemas**
- Add Pydantic models for `/api/auth/register` and `/api/auth/login` payloads.
- Validate `glyph_outline_color` input (hex format) in render endpoints.

2) **CORS & config**
- Make CORS origins configurable via a single env var (comma-separated list).
- Optional: add env overrides for key render settings (canvas size, ratios) in `load_config()`.

3) **Layout handling**
- Normalize overrides (coerce numeric fields to floats) at save time.
- Log or surface invalid override entries instead of silently skipping.

4) **Render pipeline hygiene**
- Cache frame image size (store in frame record or in memory) to avoid repeated disk reads.
- Avoid repeated `load_config()` calls by passing config/settings once per render.

---

## Phase 2 — Medium Refactors (Pre‑production stability)

1) **State handling**
- Replace module‑level globals in `api/app.py` with `app.state` or dependency injection.

2) **Render context separation**
- Split rendering into:
  - `build_render_context()` (meta/layout/overrides/chart)
  - `render_svg()` (pure render)
- Improves testability, reuse, and future caching.

3) **Schema versioning**
- Add layout schema versioning (start with v1) and keep backward compatibility.

---

## Phase 3 — Bigger Refactors / Optional Enhancements

1) **Auto‑layout improvements**
- Tie glyph sizing to `RenderSettings` (not fixed constants).
- Optionally include sign/label overlap handling.

2) **Caching & performance**
- Add render output caching (chart_id + frame_id + glyph options).
- Consider streaming PNG responses or setting cache headers for large outputs.

3) **API ergonomics**
- Add pagination to frames/charts lists.
- Standardize error response shape.

---

## Per‑File Checklist

**`zodiac_art/api/app.py`**
- Pydantic auth models
- Configurable CORS
- `app.state` for storage/db/auth
- Clarify `mine` behavior in `/api/frames`
- Add pagination parameters

**`zodiac_art/api/rendering.py`**
- Cache image sizes
- Normalize/validate overrides
- Separate build vs render
- Use config/settings once per request

**`zodiac_art/config.py`**
- Optional env overrides for render settings

**`zodiac_art/compositor/compositor.py`**
- Optional toggle between embedded data URI vs external `<image href>`

**`zodiac_art/renderer/svg_chart.py`**
- Move glyph mode to settings (avoid `load_config()` per render)

**`zodiac_art/main.py`**
- Optional `--verbose` flag for debug errors

---

## Long‑Term Recommendations

- **CORS configuration**: Use a single env var that accepts a comma‑separated list (e.g., `CORS_ORIGINS="https://app.example.com,https://staging.example.com"`). Default to localhost in dev.
- **Auto‑layout improvements timing**: Keep auto‑layout algorithm changes in Phase 3. They can alter output behavior and are best tackled after schema/validation and API stability.
- **Layout schema versioning**: Maintain backward compatibility silently. Log server‑side warnings when loading old layouts, but do not surface warnings to clients until a migration UI exists.
