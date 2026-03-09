# Scripts — conventions and setup

Load this when working on `scripts/` or automation.

## Structure

- Scripts live in `scripts/`. Node.js; add deps in `scripts/package.json`.
- Document usage in the script header or README.

## Browser / CDP

- Assume Brave (or Chrome) with `--remote-debugging-port=9222`.
- Override via env `DEBUG_PORT` or CLI arg.
- Connect via `http://127.0.0.1:PORT/json/version` → `webSocketDebuggerUrl`; use puppeteer-core to connect.

## Package.json

- Dependencies: puppeteer-core, ws (per existing setup).
- Run from repo root or `scripts/`: `node scripts/<name>.js`.

## Existing scripts

| Script | Purpose |
|--------|---------|
| `fb-marketplace-projectors.js` | CDP + Brave, searches FB Marketplace for projectors |
| `calibrate-simulator.js` | CDP + Brave on 9222, calibrates simulator against real-world photo. Uses SIM_URL (default localhost:3000). See `docs/CALIBRATION.md`. |
| `visual-loop-test.js` | CDP + Brave on 9222, visual regression test. Checks canvas content, base image, FPS, calibration API. `npm run visual-test`. Use `--loop N` to repeat. |
