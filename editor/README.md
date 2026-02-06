# Frame Alignment + Layout Editor

V1 editor for aligning chart overlays and resolving label collisions.

## Setup

```bash
cd editor
npm install
npm run dev
```

## Frames index

Edit `editor/public/frames_index.json` to add frames:

```json
{
  "frames": [
    {
      "id": "artnouveau_test",
      "image": "/@fs/ABSOLUTE_PATH/zodiac_art/frames/artnouveau_test/frame.png",
      "meta": "/@fs/ABSOLUTE_PATH/zodiac_art/frames/artnouveau_test/metadata.json",
      "layout": "/@fs/ABSOLUTE_PATH/zodiac_art/frames/artnouveau_test/layout.json"
    }
  ]
}
```

The editor is configured to allow file access to the repo root via Vite's
`server.fs.allow` in `editor/vite.config.ts`.

## Workflow

1) Run the CLI once to generate a chart SVG: `output/zodiac_art.svg`.
2) Copy or update the editor overlay at `editor/public/sample_chart.svg`.
3) In the editor, adjust the chart fit and label positions.
4) Save updated `metadata.json` (chart_fit) and `layout.json` (overrides).
5) Place the JSON files under `zodiac_art/frames/<frame_id>/`.
