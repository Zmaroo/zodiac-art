
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
├── frames/          # AI‑generated background frames
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
  "center": [x, y],
  "ring_outer": value,
  "ring_inner": value
}
```

This ensures accurate chart alignment across multiple artistic themes.

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
