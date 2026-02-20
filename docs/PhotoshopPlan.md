# Photoshop-Like Layers Tab Plan

This is a future-looking plan and is not being implemented yet. It exists to document a possible direction only.

## Goal
Add a new “Layers” tab (behind a feature flag) that allows users to edit artwork like a lightweight Photoshop: reorder layers, apply blend modes, edit opacity, and paint masks with a brush. The layer stack must drive final PNG/SVG exports, and the API must accept/render the same stack.

This plan also includes:
- Cutting out parts of external images and using them as background layers.
- Editing frame images (e.g., making the middle white area transparent) via masks.

---

## Scope

**Core capabilities**
- Layer stack editor with:
  - Visibility toggle, opacity, blend mode, reorder.
  - Layer types: Frame image, Chart SVG, Background color, Imported image, Adjustment layer.
- Brush-based mask editor:
  - Paint/erase, brush size, hardness, opacity.
  - Undo/redo.
  - Per-layer masks.

**Extended capabilities**
- Import external images, cut out regions, and use as layers.
- Frame editing: make frame interior transparent via a mask (non-destructive).

**Export**
- PNG and SVG outputs respect layer order, masks, and blend modes.

---

## Architecture

### 1) Data model (versioned)
Introduce a `LayerStack` schema saved in layout:

```json
{
  "version": 1,
  "canvas": { "width": 3000, "height": 3000 },
  "layers": [
    {
      "id": "layer-1",
      "type": "frame",
      "name": "Frame",
      "visible": true,
      "opacity": 1.0,
      "blend_mode": "normal",
      "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0 },
      "source": { "url": "/static/frames/..." },
      "mask": { "type": "raster", "url": "/static/masks/..." }
    }
  ]
}
```

**Backward compatibility**
- If `layer_stack` is missing, build a default stack from existing frame + chart + background.
- Keep legacy `overrides` for current UI; only use `layer_stack` when feature flag is on.

---

### 2) API changes
- Layout endpoints accept/return `layer_stack`.
- Render endpoints use `layer_stack` if provided:
  - `render.svg`, `render.png`, `render_chart.svg` (when chart-only).

---

### 3) Client state and feature flag
- Feature flag (env + toggle) enables Layers tab.
- Store and edit `LayerStack` in editor state.
- Save `layer_stack` via existing “Save all”.

---

### 4) UI/UX: new Layers tab
- Tabs: **Layout** (current) and **Layers** (new).
- Layers panel:
  - Reorder, visibility, opacity, blend mode.
  - Add/remove layers.
  - Select a layer and open mask editor.

---

### 5) Brush-based mask editor
- Canvas overlay on the main preview:
  - Paint/erase.
  - Brush size/hardness/opacity sliders.
  - Undo/redo stack.
- Masks are stored as PNGs with alpha (raster).
- Apply masks to any layer.

---

### 6) Cut-out from external images
- Import images as new layers.
- “Cut out” uses mask editor (paint/erase) or quick selection (v1: brush only).
- Resulting masked layer can be used behind chart.

---

### 7) Frame editing
- Frame layer has its own mask (non-destructive).
- Use mask editor to erase white center -> transparency.
- The frame image stays intact; mask handles transparency.

---

### 8) Rendering pipeline

**Client preview (fast)**
- Offscreen canvas compositor applies:
  - Layer order
  - Opacity + blend modes
  - Masks
  - Transforms

**Server render**
- Compose layers with Pillow/CairoSVG:
  - Apply masks + blend modes.
  - Render final PNG.
  - SVG export:
    - Layers with raster masks become embedded PNG in SVG container.
    - Preserve vector for chart-only layers where possible.

---

## Milestones

1. **Schema + API**
   - Define `LayerStack` schema.
   - Layout endpoints accept/return `layer_stack`.
   - Default stack generation for legacy layouts.

2. **Client base**
   - Add Layers tab UI with reorder/visibility/opacity/blend mode.
   - Feature flag gating.

3. **Mask editor**
   - Brush painting + erase.
   - Undo/redo.
   - Store masks + apply in preview.

4. **Import + cut-out**
   - Add external image layer support.
   - Mask editor for cut-outs.

5. **Server render parity**
   - PNG export with masks + blend modes.
   - SVG export with rasterized masked layers.

---

## Notes / Tradeoffs
- Brush masks are raster, so SVG export becomes hybrid (SVG wrapper + embedded PNG for masked layers).
- Full Photoshop-grade selection tools are out of scope for v1.

---

## Open items (for later)
- Advanced selection tools (magic wand, polygon lasso).
- Feather/blur masks.
- Non-destructive adjustment layers (curves, hue/sat).

---

## Feature Flag
- Enable in config: `VITE_LAYER_EDITOR=1`
- Default off; only on in dev/experimental environments.
