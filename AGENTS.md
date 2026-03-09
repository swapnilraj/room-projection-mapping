# Agent guide

Read this first. Load topic docs when relevant.

---

## Project

Room projection mapping — scripts, assets, and a web simulator for projecting visuals onto surfaces. No backend unless requested.

---

## Structure

```
room-projection-mapping/
├── AGENTS.md
├── docs/               ← Topic docs (load when needed)
│   ├── scripts.md      ← Scripts, CDP, Brave
│   └── simulator.md    ← Simulator internals, calibration API
├── scripts/            ← Node automation (puppeteer-core, etc.)
├── simulator/          ← Web projection simulator (HTML/CSS/JS)
├── presets/            ← Simulator presets
├── assets/
└── falling-up.jpeg, real_world.jpg, ...
```

---

## Essentials

- **Paths:** Use repo-relative paths; no hardcoded machine paths.
- **Platform:** macOS; examples can assume macOS.
- **Don’t add** backend, DB, or API unless asked.
- **Don’t edit** `.cursor/` or session assets unless asked.

---

## When to load topic docs

| Topic | Doc |
|-------|-----|
| Scripts, CDP, Brave | `docs/scripts.md` |
| Simulator, calibration API | `docs/simulator.md` |
| Calibration process, usage | `docs/CALIBRATION.md` |
| Optical theory (base × projection) | `VISUAL_COLOUR_CONSTRAINTS.md` |
