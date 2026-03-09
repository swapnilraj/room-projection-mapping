#!/usr/bin/env node
/**
 * Calibrate the projection simulator against a real-world reference photo.
 * Connects via CDP, loads the simulator, searches environment parameter space,
 * and finds the combination that best matches real-world color samples.
 *
 * The search covers both physics-model parameters (surfaceGamma, surfaceFloor,
 * spectralBleed) and projector parameters (blackLevel, lensBloom).
 *
 * Usage:
 *   1. Start Brave with remote debugging:
 *        brave-browser --remote-debugging-port=9222
 *   2. Run the Next.js simulator (choose one):
 *        npm run dev              → http://localhost:3000
 *        Or use a deployed URL    → set SIM_URL=https://your-app.vercel.app
 *   3. Run calibration:
 *        node scripts/calibrate-simulator.js
 *
 * Environment:
 *   SIM_URL     Simulator URL (default: http://localhost:3000)
 *   DEBUG_PORT  Browser CDP port (default: 9222)
 */

const http = require('http');
const PORT = parseInt(process.env.DEBUG_PORT || process.argv[2] || '9222', 10);
const SIM_URL = process.env.SIM_URL || 'http://localhost:3000';

// ── Target colors from real_world.jpg ─────────────────────────────
// Sampled from the print area of the camera-captured photo
// (projection of #2500ff on the "Falling Up" print).
const REGIONS = [
  { name: 'blue_bg_top',   x: 0.50, y: 0.10, size: 30, target: [1, 45, 162] },
  { name: 'blue_bg_left',  x: 0.12, y: 0.40, size: 30, target: [1, 52, 182] },
  { name: 'blue_bg_right', x: 0.88, y: 0.40, size: 30, target: [0, 49, 172] },
  { name: 'figure_head',   x: 0.48, y: 0.30, size: 25, target: [1, 46, 169] },
  { name: 'figure_center', x: 0.48, y: 0.48, size: 25, target: [66, 33, 141] },
  { name: 'figure_edge_l', x: 0.30, y: 0.48, size: 20, target: [71, 52, 149] },
  { name: 'figure_edge_r', x: 0.65, y: 0.48, size: 20, target: [63, 76, 186] },
  { name: 'figure_lower',  x: 0.48, y: 0.70, size: 25, target: [78, 39, 143] },
  { name: 'glow_edge_top', x: 0.48, y: 0.22, size: 20, target: [1, 46, 165] },
];

// ── Scoring ───────────────────────────────────────────────────────
// Uses angular distance (colour direction) + luminance ratio penalty.
// Camera exposure/WB shifts absolute brightness non-linearly, but relative
// colour balance is preserved.

function colorScore(sim, ref) {
  const simLen = Math.sqrt(sim[0] ** 2 + sim[1] ** 2 + sim[2] ** 2) || 1;
  const refLen = Math.sqrt(ref[0] ** 2 + ref[1] ** 2 + ref[2] ** 2) || 1;
  const sn = sim.map(c => c / simLen);
  const rn = ref.map(c => c / refLen);
  const dot = sn[0] * rn[0] + sn[1] * rn[1] + sn[2] * rn[2];
  const angleDist = Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI);
  const lumPenalty = Math.abs(Math.log((simLen + 1) / (refLen + 1))) * 12;
  return angleDist + lumPenalty;
}

function avgScore(samples) {
  return samples.reduce((t, s) => t + colorScore(s.color, s.target), 0) / samples.length;
}

function eucDist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body).webSocketDebuggerUrl); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  const puppeteer = require('puppeteer-core');

  console.log(`Connecting to browser on port ${PORT}...`);
  const wsUrl = await getWsUrl(PORT).catch(() => {
    console.error(`Could not connect. Start Brave with --remote-debugging-port=${PORT}`);
    process.exit(1);
  });

  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  const page = await browser.newPage();

  console.log(`Loading simulator at ${SIM_URL}`);
  await page.goto(SIM_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for the simulator to initialize (base image load + first render)
  await new Promise(r => setTimeout(r, 5000));

  // Verify _calibration API exists
  const hasApi = await page.evaluate(() => typeof window._calibration === 'object');
  if (!hasApi) {
    console.error('_calibration API not found on page — is the simulator loaded?');
    process.exit(1);
  }

  // Set up: flat white projection, colour #2500ff, physical mode
  await page.evaluate(() => {
    const cal = window._calibration;
    cal.setFlatProjection();
    cal.setEnv({
      projColor: [37, 0, 255],
      ambient: 0.0,
      brightness: 1.0,
      temp: 'neutral',
      material: 'matte',
    });
  });
  await new Promise(r => setTimeout(r, 500));

  // ── Parameter grid ──────────────────────────────────────────────
  // surfaceGamma and spectralBleed are the most impactful; the rest are fine-tuning.
  const grid = {
    surfaceGamma:  [0.35, 0.45, 0.55],
    surfaceFloor:  [0.03, 0.06],
    spectralBleed: [0.60, 0.80, 1.00],
    scatter:       [0.05, 0.12, 0.20, 0.30],
    blackLevel:    [0.00, 0.04],
    lensBloom:     [0.00, 0.10],
  };

  const totalCombos = Object.values(grid).reduce((p, a) => p * a.length, 1);

  let bestScore = Infinity;
  let bestParams = {};
  let bestSamples = [];
  let iteration = 0;

  console.log(`\nGrid search: ${totalCombos} combinations\n`);
  const t0 = Date.now();

  for (const sg of grid.surfaceGamma) {
    for (const sf of grid.surfaceFloor) {
      for (const sb of grid.spectralBleed) {
        for (const sc of grid.scatter) {
          for (const bl of grid.blackLevel) {
            for (const lb of grid.lensBloom) {
              iteration++;

              const samples = await page.evaluate((p, regions) => {
                window._calibration.setEnv({
                  surfaceGamma: p.sg,
                  surfaceFloor: p.sf,
                  spectralBleed: p.sb,
                  scatter: p.sc,
                  blackLevel: p.bl,
                  lensBloom: p.lb,
                });
                window._calibration.forceRender();
                return window._calibration.sampleAll(regions);
              }, { sg, sf, sb, sc, bl, lb }, REGIONS);

              for (let i = 0; i < samples.length; i++) {
                samples[i].target = REGIONS[i].target;
              }

              const score = avgScore(samples);

              if (score < bestScore) {
                bestScore = score;
                bestParams = { surfaceGamma: sg, surfaceFloor: sf, spectralBleed: sb, scatter: sc, blackLevel: bl, lensBloom: lb };
                bestSamples = JSON.parse(JSON.stringify(samples));
                console.log(`[${iteration}/${totalCombos}] NEW BEST: score=${score.toFixed(2)} | sG=${sg} sF=${sf} sb=${sb} sc=${sc} bl=${bl} lb=${lb}`);
                for (const s of samples) {
                  const cs = colorScore(s.color, s.target).toFixed(1);
                  console.log(`  ${s.name.padEnd(18)} sim=(${s.color.join(',').padEnd(12)}) ref=(${s.target.join(',').padEnd(12)}) cs=${cs}`);
                }
              }

              if (iteration % 50 === 0) {
                const sec = ((Date.now() - t0) / 1000).toFixed(0);
                const rate = (iteration / ((Date.now() - t0) / 1000)).toFixed(1);
                console.log(`  ... ${iteration}/${totalCombos} (${sec}s, ${rate}/s) best=${bestScore.toFixed(2)}`);
              }
            }
          }
        }
      }
    }
  }

  // ── Fine-tune around the best ──────────────────────────────────
  console.log(`\nPhase 2: Fine-tuning around best (sG=${bestParams.surfaceGamma} sF=${bestParams.surfaceFloor} sb=${bestParams.spectralBleed})...\n`);

  const finetune = {
    surfaceGamma:  [bestParams.surfaceGamma - 0.05, bestParams.surfaceGamma, bestParams.surfaceGamma + 0.05].filter(v => v > 0.1),
    surfaceFloor:  [Math.max(0, bestParams.surfaceFloor - 0.02), bestParams.surfaceFloor, bestParams.surfaceFloor + 0.02],
    spectralBleed: [Math.max(0, bestParams.spectralBleed - 0.10), bestParams.spectralBleed, bestParams.spectralBleed + 0.10],
    scatter:       [Math.max(0, bestParams.scatter - 0.05), bestParams.scatter, bestParams.scatter + 0.05],
    blackLevel:    [Math.max(0, bestParams.blackLevel - 0.02), bestParams.blackLevel, bestParams.blackLevel + 0.02],
    lensBloom:     [Math.max(0, bestParams.lensBloom - 0.05), bestParams.lensBloom, bestParams.lensBloom + 0.05],
  };

  const ftTotal = Object.values(finetune).reduce((p, a) => p * a.length, 1);
  let ftIter = 0;

  for (const sg of finetune.surfaceGamma) {
    for (const sf of finetune.surfaceFloor) {
      for (const sb of finetune.spectralBleed) {
        for (const sc of finetune.scatter) {
          for (const bl of finetune.blackLevel) {
            for (const lb of finetune.lensBloom) {
              ftIter++;

              const samples = await page.evaluate((p, regions) => {
                window._calibration.setEnv({
                  surfaceGamma: p.sg,
                  surfaceFloor: p.sf,
                  spectralBleed: p.sb,
                  scatter: p.sc,
                  blackLevel: p.bl,
                  lensBloom: p.lb,
                });
                window._calibration.forceRender();
                return window._calibration.sampleAll(regions);
              }, { sg, sf, sb, sc, bl, lb }, REGIONS);

              for (let i = 0; i < samples.length; i++) {
                samples[i].target = REGIONS[i].target;
              }

              const score = avgScore(samples);

              if (score < bestScore) {
                bestScore = score;
                bestParams = { surfaceGamma: sg, surfaceFloor: sf, spectralBleed: sb, scatter: sc, blackLevel: bl, lensBloom: lb };
                bestSamples = JSON.parse(JSON.stringify(samples));
                console.log(`[FT ${ftIter}/${ftTotal}] IMPROVED: score=${score.toFixed(2)} | sG=${sg} sF=${sf} sb=${sb} sc=${sc} bl=${bl} lb=${lb}`);
              }
            }
          }
        }
      }
    }
  }

  // ── Results ─────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(65)}`);
  console.log('  CALIBRATION COMPLETE');
  console.log(`${'═'.repeat(65)}`);
  console.log(`  Combos tested: ${iteration + ftIter}`);
  console.log(`  Time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  Best score: ${bestScore.toFixed(2)}`);
  console.log(`\n  Best parameters:`);
  for (const [k, v] of Object.entries(bestParams)) {
    console.log(`    ${k.padEnd(16)} ${v}`);
  }
  console.log(`\n  Region details:`);
  for (const s of bestSamples) {
    const ed = eucDist(s.color, s.target).toFixed(0);
    const cs = colorScore(s.color, s.target).toFixed(1);
    console.log(`    ${s.name.padEnd(18)} sim=(${s.color.join(',').padEnd(12)}) ref=(${s.target.join(',').padEnd(12)}) euc=${ed} cs=${cs}`);
  }

  // Apply and screenshot
  await page.evaluate((p) => {
    window._calibration.setEnv(p);
    window._calibration.forceRender();
  }, bestParams);
  await new Promise(r => setTimeout(r, 500));

  const path = require('path');
  const ssPath = path.join(__dirname, '..', 'assets', 'calibration-result.png');
  await page.screenshot({ path: ssPath, fullPage: false });
  console.log(`\n  Screenshot → ${ssPath}`);
  console.log(`${'═'.repeat(65)}`);

  await page.close();
  await browser.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
