#!/usr/bin/env node
/**
 * Visual loop test — verify the projection simulator loads and renders correctly.
 * Checks: canvas content, base image, FPS, effects, calibration API, no console errors.
 *
 * Usage:
 *   1. Start simulator:     npm run dev          (or use deployed URL)
 *   2. Start browser:       brave --remote-debugging-port=9222
 *   3. Run test:            node scripts/visual-loop-test.js
 *
 * Options:
 *   --loop N     Run N times (for regression / stress)
 *   --no-screenshot   Skip saving screenshot
 *
 * Environment:
 *   SIM_URL      Simulator URL (default: http://localhost:3000)
 *   DEBUG_PORT   Browser CDP port (default: 9222)
 */

const http = require('http');
const path = require('path');

const PORT = parseInt(process.env.DEBUG_PORT || '9222', 10);
const SIM_URL = process.env.SIM_URL || 'http://localhost:3000';

const args = process.argv.slice(2);
const loopCount = (() => {
  const i = args.indexOf('--loop');
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : 1;
})();
const saveScreenshot = !args.includes('--no-screenshot');

function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).webSocketDebuggerUrl);
        } catch (e) {
          reject(new Error('Invalid JSON from browser'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function runOne(page, iteration, total) {
  const prefix = total > 1 ? `[${iteration}/${total}] ` : '';

  await page.goto(SIM_URL, { waitUntil: 'networkidle2', timeout: 15000 });

  // Wait for simulator init (base image load + first render)
  await new Promise((r) => setTimeout(r, 4000));

  const errors = [];
  page.once('pageerror', (e) => errors.push(e.message));

  const result = await page.evaluate(() => {
    const preview = document.getElementById('preview');
    if (!preview) return { ok: false, reason: 'No #preview canvas' };

    const ctx = preview.getContext('2d');
    if (!ctx) return { ok: false, reason: 'No canvas context' };

    const w = preview.width;
    const h = preview.height;
    if (w <= 0 || h <= 0) return { ok: false, reason: `Canvas size ${w}x${h}` };

    // Sample pixels — expect non-black content (base image + projection)
    const sample = ctx.getImageData(0, 0, Math.min(w, 64), Math.min(h, 64));
    const data = sample.data;
    let nonBlack = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 20 || data[i + 1] > 20 || data[i + 2] > 20) nonBlack++;
    }
    const hasContent = nonBlack > 100;

    const statusSize = document.getElementById('statusSize');
    const statusFps = document.getElementById('statusFps');
    const sizeText = statusSize ? statusSize.textContent.trim() : '';
    const fpsText = statusFps ? statusFps.textContent.trim() : '';
    const fpsNum = fpsText.match(/\d+/) ? parseInt(fpsText.match(/\d+/)[0], 10) : 0;

    const hasCalibration = typeof window._calibration === 'object';

    const effectsList = document.getElementById('effectsList');
    const effectCount = effectsList ? effectsList.querySelectorAll('.effect-card').length : 0;

    return {
      ok: hasContent && w > 100 && h > 100,
      reason: hasContent ? null : 'Canvas appears empty (no base image)',
      canvasSize: `${w}x${h}`,
      statusSize: sizeText,
      fps: fpsNum,
      hasCalibration,
      effectCount,
      nonBlackPixels: nonBlack,
    };
  });

  if (errors.length > 0) {
    return { ok: false, error: errors[0], result };
  }

  return { ok: result.ok, result };
}

async function main() {
  let Puppeteer;
  try {
    Puppeteer = require('puppeteer-core');
  } catch (_) {
    console.error('Install puppeteer-core in scripts/: cd scripts && npm install');
    process.exit(1);
  }

  console.log(`Connecting to browser on port ${PORT}...`);
  const wsUrl = await getWsUrl(PORT).catch((e) => {
    console.error(`Could not connect to browser on port ${PORT}.`);
    console.error('Start Brave/Chrome with: --remote-debugging-port=' + PORT);
    process.exit(1);
  });

  const browser = await Puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  const page = await browser.newPage();

  const consoleMessages = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (!text.includes('Extension') && !text.includes('extension')) {
      consoleMessages.push({ type: msg.type(), text });
    }
  });

  let passed = 0;
  let failed = 0;

  for (let i = 1; i <= loopCount; i++) {
    const outcome = await runOne(page, i, loopCount);
    if (outcome.ok) {
      passed++;
      const r = outcome.result;
      console.log(`✓ Pass ${i}/${loopCount}  canvas=${r.canvasSize} fps=${r.fps} effects=${r.effectCount} calibration=${r.hasCalibration ? 'yes' : 'no'}`);
    } else {
      failed++;
      const r = outcome.result || {};
      console.log(`✗ Fail ${i}/${loopCount}  ${outcome.reason || outcome.error || 'Unknown'}`);
      if (outcome.result) {
        console.log(`    canvas=${r.canvasSize || 'N/A'} statusSize=${r.statusSize || 'N/A'} nonBlack=${r.nonBlackPixels ?? 'N/A'}`);
      }
    }
  }

  if (saveScreenshot && loopCount >= 1) {
    const assetsDir = path.join(__dirname, '..', 'assets');
    const screenshotPath = path.join(assetsDir, 'visual-loop-test.png');
    try {
      const fs = require('fs');
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
      await page.screenshot({ path: screenshotPath });
      console.log(`\nScreenshot: ${screenshotPath}`);
    } catch (e) {
      console.warn('Could not save screenshot:', e.message);
    }
  }

  const errors = consoleMessages.filter((m) => m.type === 'error');
  if (errors.length > 0) {
    console.log('\nConsole errors:');
    errors.forEach((m, i) => console.log(`  ${i + 1}. ${m.text}`));
  }

  await page.close();
  await browser.disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
