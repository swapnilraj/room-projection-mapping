# Simulator — agent notes

Load this when modifying the projection simulator or its physical model.

## Structure

```
simulator/
├── index.html     ← UI, controls
├── app.js         ← Core logic (~1500 lines), state, render pipeline
├── styles.css
├── presets/       ← JSON presets
└── README.md      ← User-facing docs, controls, rendering model
```

## Calibration API

`window._calibration` is exposed for `scripts/calibrate-simulator.js`:

- `setEnv(params)` — Merge into `state.env`; rebuild reflectance if gamma/floor change
- `setFlatProjection()` — Single full-frame glow, no animation
- `sampleRegion(nx, ny, size)` — Sample RGB from preview canvas
- `sampleAll(regions)` — Batch sample
- `forceRender()` — Run render pipeline once (no rAF loop)

## Physical model

- Reflectance map: `buildReflectanceMap()` — gamma + floor lift on base image
- Cross-talk: `applyCrosstalk(rgb, bleed)` — projector spectral bleed
- Compositing: `renderComposite()` — ambient, black level, bloom, reflectance multiply, material, scatter

See `simulator/README.md` for user-facing rendering description and `VISUAL_COLOUR_CONSTRAINTS.md` for optical theory.
