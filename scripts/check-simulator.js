#!/usr/bin/env node
/**
 * Connect to a browser running with --remote-debugging-port and check the
 * simulator page for console errors, visual content, effects list, and FPS.
 *
 * Usage:
 *   1. Start browser with remote debugging:
 *      Chrome: google-chrome --remote-debugging-port=9222
 *      Brave:  /Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
 *   2. Run:   node scripts/check-simulator.js [PORT]
 *      Default port: 9222
 */

const http = require('http');
const PORT = parseInt(process.env.DEBUG_PORT || process.argv[2] || '9222', 10);
const TARGET_URL = 'http://localhost:3847/simulator/?v=2';

function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.webSocketDebuggerUrl || null);
        } catch (e) {
          reject(new Error('Invalid JSON from browser'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function main() {
  let Puppeteer;
  try {
    Puppeteer = require('puppeteer-core');
  } catch (_) {
    console.error('Install puppeteer-core: npm install puppeteer-core');
    process.exit(1);
  }

  console.log(`Connecting to browser on port ${PORT}...`);
  const wsUrl = await getWsUrl(PORT).catch((e) => {
    console.error(`Could not connect to browser on port ${PORT}.`);
    console.error('Start browser with: --remote-debugging-port=' + PORT);
    process.exit(1);
  });

  const browser = await Puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  // Collect console messages
  const consoleMessages = [];
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    // Filter out extension messages
    if (!text.includes('extension') && !text.includes('Extension')) {
      consoleMessages.push({ type, text });
    }
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  console.log(`\nNavigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});

  // Wait for page to stabilize
  console.log('Waiting for page to load...\n');
  await new Promise((r) => setTimeout(r, 2000));

  // Check for canvas and visual content
  const visualCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { hasCanvas: false };

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Check if canvas has any non-transparent pixels
    let hasContent = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] > 0) { // Check alpha channel
        hasContent = true;
        break;
      }
    }

    return {
      hasCanvas: true,
      hasContent,
      canvasSize: `${canvas.width}x${canvas.height}`
    };
  });

  // Get effects list
  const effectsInfo = await page.evaluate(() => {
    const effects = [];
    const effectElements = document.querySelectorAll('.effect-item, [class*="effect"]');
    
    effectElements.forEach((el) => {
      const nameEl = el.querySelector('.effect-name, [class*="name"]');
      const toggleEl = el.querySelector('input[type="checkbox"], .toggle, [class*="toggle"]');
      
      if (nameEl) {
        effects.push({
          name: nameEl.textContent.trim(),
          enabled: toggleEl ? toggleEl.checked || toggleEl.classList.contains('active') : null
        });
      }
    });

    // Alternative: try to find in any list/panel
    if (effects.length === 0) {
      const listItems = document.querySelectorAll('li, .list-item');
      listItems.forEach((el) => {
        const text = el.textContent.trim();
        if (text && text.length > 0 && text.length < 100) {
          const checkbox = el.querySelector('input[type="checkbox"]');
          effects.push({
            name: text,
            enabled: checkbox ? checkbox.checked : null
          });
        }
      });
    }

    return effects;
  });

  // Get FPS counter
  const fpsInfo = await page.evaluate(() => {
    const fpsEl = document.querySelector('.fps, [class*="fps"], #fps');
    if (!fpsEl) return null;
    
    const text = fpsEl.textContent.trim();
    const match = text.match(/(\d+(?:\.\d+)?)\s*fps/i);
    return match ? match[1] : text;
  });

  // Take screenshot
  const screenshotPath = '/Users/swp/dev/swapnilraj/room-projection-mapping/simulator-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Report
  console.log('=== SIMULATOR CHECK REPORT ===\n');
  
  console.log('1. Console Messages:');
  if (consoleMessages.length === 0 && pageErrors.length === 0) {
    console.log('   ✓ No console errors or warnings\n');
  } else {
    if (pageErrors.length > 0) {
      console.log('   ✗ Page Errors:');
      pageErrors.forEach((err, i) => {
        console.log(`     ${i + 1}. ${err}`);
      });
      console.log('');
    }
    
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');
    const logs = consoleMessages.filter(m => m.type === 'log');
    
    if (errors.length > 0) {
      console.log('   ✗ Console Errors:');
      errors.forEach((msg, i) => {
        console.log(`     ${i + 1}. ${msg.text}`);
      });
      console.log('');
    }
    
    if (warnings.length > 0) {
      console.log('   ⚠ Console Warnings:');
      warnings.forEach((msg, i) => {
        console.log(`     ${i + 1}. ${msg.text}`);
      });
      console.log('');
    }
    
    if (logs.length > 0 && logs.length < 20) {
      console.log('   ℹ Console Logs:');
      logs.forEach((msg, i) => {
        console.log(`     ${i + 1}. ${msg.text}`);
      });
      console.log('');
    }
  }

  console.log('2. Visual Content:');
  if (visualCheck.hasCanvas) {
    console.log(`   ✓ Canvas found (${visualCheck.canvasSize})`);
    console.log(`   ${visualCheck.hasContent ? '✓' : '✗'} Canvas has visual content: ${visualCheck.hasContent ? 'YES' : 'NO'}\n`);
  } else {
    console.log('   ✗ No canvas element found\n');
  }

  console.log('3. Effects List:');
  if (effectsInfo.length > 0) {
    console.log(`   Found ${effectsInfo.length} effect(s):`);
    effectsInfo.forEach((effect, i) => {
      const status = effect.enabled === null ? 'unknown' : (effect.enabled ? 'enabled' : 'disabled');
      console.log(`     ${i + 1}. ${effect.name} (${status})`);
    });
    console.log('');
  } else {
    console.log('   ✗ No effects found in the DOM\n');
  }

  console.log('4. FPS Counter:');
  if (fpsInfo) {
    console.log(`   ${fpsInfo} FPS\n`);
  } else {
    console.log('   ✗ FPS counter not found\n');
  }

  console.log(`Screenshot saved to: ${screenshotPath}\n`);

  await browser.disconnect();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
