# Frame Alignment + Layout Editor

V1 editor for aligning chart overlays and resolving label collisions.

## Setup

```bash
cd editor
npm install
npm run dev
```

The editor expects the API to run at `http://127.0.0.1:8000`. Override via:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000 npm run dev
```

Create a chart id via the API and paste it into the editor.

## Frames

Frames are discovered via the API `GET /api/frames` endpoint, which scans
`zodiac_art/frames/<frame_id>/` for templates.

## Workflow

1) Start the API: `python -m zodiac_art.api.app`.
2) Create a chart id via `POST /api/charts` (see `docs/api.md`).
3) Paste the chart id into the editor.
4) Adjust chart fit and label positions.
5) Save metadata/layout — the editor calls the API directly.
