# Simulator — agent notes

Load this when modifying the projection simulator or its physical model.

## Structure

**Next.js (primary):** `app/`, `public/simulator.js`, `public/falling-up.jpeg`, `public/presets/`  
Deploy with Vercel. Simulator runs at `/` when `npm run dev` or deployed.

**Static (legacy):**
```
simulator/
├── index.html     ← UI, controls
├── app.js         ← Core logic (~1500 lines), state, render pipeline
├── styles.css
├── presets/       ← JSON presets
└── README.md      ← User-facing docs, controls, rendering model
```

`public/simulator.js` is a copy of `simulator/app.js` with absolute paths for Next.js.

## Calibration API

`window._calibration` is exposed for `scripts/calibrate-simulator.js`:

- `setEnv(params)` — Merge into `state.env`; rebuild reflectance if gamma/floor change
- `setFlatProjection()` — Single full-frame glow, no animation
- `sampleRegion(nx, ny, size)` — Sample RGB from preview canvas
- `sampleAll(regions)` — Batch sample
- `forceRender()` — Run render pipeline once (no rAF loop)

See `docs/CALIBRATION.md` for the calibration process and usage.

## Physical model

- Reflectance map: `buildReflectanceMap()` — gamma + floor lift on base image
- Cross-talk: `applyCrosstalk(rgb, bleed)` — projector spectral bleed
- Compositing: `renderComposite()` — ambient, black level, bloom, reflectance multiply, material, scatter

See `simulator/README.md` for user-facing rendering description and `VISUAL_COLOUR_CONSTRAINTS.md` for optical theory.
