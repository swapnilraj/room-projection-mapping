# Projection Simulator

Browser-based previsualization tool for projection mapping. Load a base image, stack animated projection effects on top, and preview what the result would look like in the physical world — before setting up the projector.

## Quick start

Open `simulator/index.html` directly in a browser, or serve from the repo root:

```bash
npx serve .
# then open http://localhost:3000/simulator/
```

The *Falling Up* preset image loads automatically.

## Controls

### Left panel

| Section | Control | What it does |
|---------|---------|-------------|
| **Base Image** | Upload / Preset dropdown | Sets the wall artwork that receives the projection |
| **Environment** | Ambient Light | Simulates room light level (0 = pitch dark, 100 = well-lit room) |
| | Projector Brightness | How powerful the projector is (maps to lumen output) |
| | Color Temperature | Warm / Neutral / Cool tint on the projected light |
| | Material | Matte, Glossy, Textured, or Canvas substrate simulation |
| **Warp** | Enable Corner-Pin | Activates 4 draggable corner handles for perspective transform |
| | Reset Warp | Snaps corners back to rectangle |
| | Show Grid | Alignment grid overlay |
| | Edge Overlay | Shows detected edges of the base image (for registration) |
| | Onion Skin | Fades the base image over the composite (alignment aid) |
| **Presets** | Save / Load | Download or upload `.json` preset files |

### Right panel — Effects Stack

Add effects with **+ Add**, then tune each one:

| Effect | Description | Key params |
|--------|-------------|-----------|
| **Glow Pulse** | Pulsing radial light bloom | Center, radius, speed, color, min/max brightness |
| **Bloom Expansion** | Expanding/contracting ring of light | Center, max radius, softness, color |
| **Rising Particles** | Luminous particles drifting upward | Count, speed, size, spread, origin height, color |
| **Edge Drift** | Glowing edge highlights that pulse and drift | Speed, brightness, blur width, color |

Each effect has an **On/Off** toggle and a **remove** button.

### Toolbar

- **Digital Ideal / Physical Approx** — Toggle between naive screen-blend and the optical model that simulates reflectance filtering, ambient wash-out, and material effects.
- **Compare** — Side-by-side view: Base Only | Digital | Physical.
- **Export PNG** — Downloads the current view (or all three compare panels) as a PNG.

### Bottom bar

- **Play / Pause** and **Speed** slider for the animation clock.

## Rendering model

Based on the constraints in `VISUAL_COLOUR_CONSTRAINTS.md`:

```
visible = ambient × base_reflectance + projector_brightness × (projection × base_reflectance)
```

**Physical Approx** mode uses canvas composite operations to approximate this:

1. Draw the base image at ambient brightness (the surface under room light).
2. Multiply the projection layer by the base image (simulates wavelength-selective reflectance — blue surfaces attenuate red, etc.).
3. Apply material effects (glossy contrast, texture noise, canvas softening).
4. Additively blend the filtered projection onto the ambient base.

**Digital Ideal** mode uses a simple `screen` blend — what it would look like on a monitor.

The difference between the two modes is the whole point: it shows you which colours survive the substrate, where dark-on-dark detail vanishes, and how ambient light washes out subtlety.

## Warp system

Corner-pin warp uses a homography (perspective transform) computed from the 4 corner positions. The projection layer is rendered through a subdivided triangle mesh (14×14 grid) for smooth perspective approximation. Drag the TL/TR/BR/BL handles to simulate projector angle and keystone.

## Known limits

- The optical model is an approximation, not a spectral simulation. Real projector primaries, substrate spectral curves, and viewing-angle effects are not modeled.
- Material simulation (glossy/textured/canvas) is suggestive, not calibrated.
- Warp does not simulate lens distortion, only perspective (corner-pin).
- Performance depends on browser and image size. Working resolution is capped at 1024 px wide.
- No undo/redo for effect parameter changes — save presets frequently.

## Presets

Presets are JSON files that capture environment settings, warp corners, and the full effects stack with all parameter values. The `presets/falling-up.json` file is loaded automatically on start.
