
# Zodiac Art Generator

Zodiac Art Generator is a hybrid system that creates visually striking, print‑ready astrology artwork by combining:

• Accurate astrology chart calculations  
• Programmatic SVG chart rendering  
• AI‑generated artistic frames and backgrounds  
• Procedural decorative overlays  
• High‑resolution export for merch and print products  

This project is designed to produce premium personalized zodiac artwork suitable for:

- Apparel (shirts, hoodies, etc.)
- Posters and prints
- Collectible astrology art
- Digital downloads

---

## Project Goals

The main objective is to combine **astrological correctness** with **high‑end generative art**.

Traditional astrology software typically produces accurate but visually plain charts. This project enhances that by layering artistic backgrounds and decorative elements while preserving precise astronomical placements.

---

## System Architecture

```text
Birth Data → Astrology Engine → Chart Data
                 ↓
          SVG Chart Renderer
                 ↓
AI Frame / Style Layer + Procedural Ornament Layer
                 ↓
            Final Compositor
                 ↓
        Print‑Ready Artwork Output
```

---

## Key Features

### Astrology Engine

Uses Swiss Ephemeris to calculate:

- Planetary positions
- Zodiac sign placements
- House cusps
- Ascendant and Midheaven
- Optional aspect calculations

---

### SVG Chart Renderer

Programmatically generates:

- Zodiac wheel
- Houses and cusps
- Planet glyph placement
- Text and symbol layout
- Print‑ready vector graphics

---

### AI Art Layer

Used for generating:

- Ornate decorative frames
- Celestial backgrounds
- Illustration themes
- Style presets

AI artwork is generated separately and combined with accurate chart overlays.

---

### Procedural Ornament Layer

Adds visual polish such as:

- Mandala geometry
- Decorative radial elements
- Engraving and foil effects
- Texture overlays

---

### Final Compositor

Combines all layers into:

- High resolution PNG output
- Vector SVG / PDF output
- Merch‑ready assets

---

## Technology Stack

### Backend / Rendering

- Python 3.11
- pyswisseph
- svgwrite
- Pillow
- CairoSVG
- NumPy

### AI Art Generation

- Image generation models (external API or local tools)

### Optional Frontend

- React / React Native / Flutter

---

## Environment Setup

### Requirements

- Miniforge or Conda
- Apple Silicon or x86 supported
- Python 3.11 recommended

---

### Create Environment

```bash
conda activate base
conda install -n base -c conda-forge mamba
```

```bash
mamba env create -f environment.yml
conda activate zodiac_art
```

---

### Verify Installation

```bash
python -c "import swisseph, svgwrite, cairosvg, PIL, numpy; print('Environment OK')"
```

---

## Project Structure

```text
zodiac-art/
├── assets/          # Fonts, textures, and decorative elements
├── zodiac_art/frames/          # Frame presets and metadata
├── astro/           # Astrology calculation logic
├── renderer/        # SVG chart generation
├── compositor/      # Layer combination and export
├── environment.yml
└── main.py
```

---

## Workflow

1. User inputs birth data  
2. Astrology engine generates chart data  
3. SVG renderer produces accurate chart overlay  
4. AI frame or style preset selected  
5. Layers composited into final artwork  
6. Artwork exported for print or download  

---

## Frame Alignment System

Each frame stores metadata describing chart placement:

```json
{
  "canvas": {"width": 4500, "height": 5400},
  "chart": {
    "center": {"x": 2250, "y": 2700},
    "ring_outer": 1800,
    "ring_inner": 1500,
    "rotation_deg": 0
  }
}
```

This ensures accurate chart alignment across multiple artistic themes.

Example frame tooling:

```bash
python -m zodiac_art.main --list-frames
python -m zodiac_art.frames.debug_overlay --frame default --out output/default_debug.png
```

## Frame Alignment + Layout Editor (V1)

The editor is a separate dev tool in `editor/` for dragging/scaling/rotating the
chart overlay and nudging planet labels. It writes `chart_fit` into
`metadata.json` and label overrides into `layout.json`.

```bash
cd editor
npm install
npm run dev
```

## API (V2)

FastAPI backend for chart creation, rendering, and per-chart layout storage.

```bash
python -m zodiac_art.api.app
```

## Dev Tools MCP (Local)

These endpoints and the MCP server are dev-only and require `ZODIAC_DEV_TOOLS=1`.

Start API with dev tools enabled:

```bash
ZODIAC_DEV_TOOLS=1 python -m zodiac_art.api.app
```

Start the editor (Vite):

```bash
cd editor
npm install
npm run dev
```

Start Chrome with remote debugging:

```bash
open -a "Google Chrome" --args --remote-debugging-port=9222
```

Start the MCP server:

```bash
python -m zodiac_art.mcp.server
```

MCP auth can be provided via `.env` (copy from `.env.example`):

```bash
cp .env.example .env
```

Verify MCP tools are registered:

```bash
opencode mcp list
```

### Dev Server Control (Local)

Use `scripts/dev_servers.py` to start/stop/restart dev services. PID files are stored in
`.opencode/pids/` and logs in `.opencode/logs/`.

```bash
python scripts/dev_servers.py start api --dev-tools
python scripts/dev_servers.py start editor
python scripts/dev_servers.py start chrome
python scripts/dev_servers.py start mcp
```

Stop everything:

```bash
python scripts/dev_servers.py stop all
python scripts/dev_servers.py status all
python scripts/dev_servers.py tail api --lines 200 --follow
```

Available zodiac-tools MCP actions include:

- `list_frames`, `list_charts`, `get_chart`, `get_frame`, `create_chart`, `create_chart_with_frame`
- `seed_test_chart`, `duplicate_chart`
- `get_layout`, `update_layout`, `reset_layout`, `reset_chart_layout`, `clear_chart_layout`, `delete_chart`
- `set_chart_fit`, `nudge_chart_fit`
- `set_frame_mask`, `nudge_frame_mask`

Manual test examples: `docs/api.md`

Frame library details: `docs/frames.md`

### Database (Postgres)

Set the connection string or component variables:

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zodiac_art
```

Initialize schema:

```bash
python -m zodiac_art.db.init_db
```

Seed built-in frames:

```bash
python -m zodiac_art.db.seed_frames
```

Start the API:

```bash
python -m zodiac_art.api.app
```

Quick test:

```bash
curl -X POST http://127.0.0.1:8000/api/charts \
  -H "Content-Type: application/json" \
  -d '{
    "birth_date": "1990-04-12",
    "birth_time": "08:45",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "default_frame_id": "artnouveau_test"
  }'

curl http://127.0.0.1:8000/api/charts/<chart_id>
```

### Auth (V3.0)

Set auth config:

```bash
export JWT_SECRET=change-me
export JWT_EXPIRES_SECONDS=604800
export DEV_MODE=false
```

Register/login flows: `docs/auth.md`


---

## Output Formats

- SVG (vector print master)
- PNG (merch preview and DTG printing)
- PDF (poster / fine art printing)

---

## Future Enhancements

- Additional house systems
- Style preset marketplace
- Real‑time preview UI
- Premium one‑of‑one AI generated artwork
- Automated merch integration
- Multi‑planet aspect visualization
- Animation and interactive charts

---

## Development Notes

AI is intentionally used only for artistic styling.  
All astrological placement logic is generated deterministically using astronomical calculations.

---

## License

(To be determined)

---

## Author

Michael Marler

---

## Disclaimer

Astrology outputs are for artistic and entertainment purposes.

---
