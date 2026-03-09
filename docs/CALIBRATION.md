# Calibrating the Projection Simulator

The simulator exposes a **calibration API** (`window._calibration`) that lets scripts tweak parameters and sample the rendered output. `scripts/calibrate-simulator.js` uses this to find the parameter combination that best matches a real-world reference photo.

## Prerequisites

1. **Brave or Chrome** with remote debugging
2. **Node.js** (scripts require `puppeteer-core` from `scripts/package.json`)
3. **Simulator running** — either Next.js dev (`npm run dev`) or deployed (e.g. Vercel)
4. **Reference photo** — a camera-captured shot of your projected setup (same base image, same projection colour)

## Calibration API

The simulator exposes `window._calibration` for programmatic use:

| Method | Purpose |
|--------|---------|
| `setEnv(params)` | Merge into `state.env` (ambient, brightness, surfaceGamma, etc.). Rebuilds reflectance if gamma/floor change. |
| `setFlatProjection()` | Replaces effects with a single full-frame glow (no animation). Used during calibration. |
| `sampleRegion(nx, ny, size)` | Sample mean RGB from the preview canvas at normalized coords `(nx, ny)` with sample size `size`. Returns `[r, g, b]`. |
| `sampleAll(regions)` | Batch sample. `regions` = `[{ name, x, y, size? }]`. Returns `[{ name, color }]`. |
| `forceRender()` | Run the render pipeline once (without the rAF loop). |

## Running the Calibration Script

### 1. Start Brave with remote debugging

```bash
brave-browser --remote-debugging-port=9222
```

(On macOS, use your Brave executable path, e.g. `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser`.)

### 2. Run the simulator

**Local (Next.js dev):**
```bash
npm run dev
```
Simulator will be at `http://localhost:3000`.

**Deployed (Vercel):**  
Use your deployed URL and set `SIM_URL` (see step 3).

### 3. Run calibration

From the repo root:

```bash
cd scripts && npm install   # if not done
node scripts/calibrate-simulator.js
```

**Options:**

- `SIM_URL` — Simulator URL (default: `http://localhost:3000`)
- `DEBUG_PORT` — CDP port (default: `9222`)

Example with deployed URL:

```bash
SIM_URL=https://your-project.vercel.app node scripts/calibrate-simulator.js
```

### 4. Output

The script:

1. Loads the simulator in a new tab
2. Sets flat white projection and projector colour `#2500ff`
3. Runs a grid search over `surfaceGamma`, `surfaceFloor`, `spectralBleed`, `scatter`, `blackLevel`, `lensBloom`
4. For each combo, samples regions and compares to target RGB values
5. Prints best parameters and saves `assets/calibration-result.png`

Target colours in the script (`REGIONS` in `calibrate-simulator.js`) are derived from a reference photo. Edit those values if you calibrate against a different setup.

## Customising Targets

The script has hardcoded `REGIONS` with `target` RGB values from a reference photo. To calibrate for your own setup:

1. Take a photo of your projected print (same base image, same projection colour).
2. Sample RGB from key regions in the photo (e.g. blue background, figure centre, edges).
3. Edit `scripts/calibrate-simulator.js` — update `REGIONS` with your `x`, `y`, `size`, and `target` values.

Region coordinates are **normalized** (0–1). `size` is pixels.
