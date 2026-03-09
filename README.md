# Room Projection Mapping

Room projection mapping — setup, content, and tooling for projecting visuals onto surfaces. Includes a **web simulator** (Next.js / Vercel) and scripts for calibration and automation.

## Projection Simulator

Simulate how projected light interacts with printed surfaces. Adjust ambient light, projector brightness, surface gamma, spectral bleed, and effects. Compare "digital ideal" vs "physical approx" models.

### Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

Connect this repo to Vercel. The app builds with `next build` and deploys automatically. No extra config needed.

## Calibration

The simulator exposes `window._calibration` for programmatic tuning. Use `scripts/calibrate-simulator.js` to find parameters that match a real-world reference photo.

1. Start Brave with `--remote-debugging-port=9222`
2. Run the simulator (`npm run dev` or use a deployed URL)
3. Run `node scripts/calibrate-simulator.js`

See **[docs/CALIBRATION.md](docs/CALIBRATION.md)** for the full calibration process.

## Repo structure

| Path | Purpose |
|------|---------|
| `app/`, `public/` | Next.js simulator (primary) |
| `simulator/` | Static simulator (legacy) |
| `scripts/` | Node scripts (CDP, calibration, etc.) |
| `docs/` | Topic docs (calibration, scripts, simulator) |
