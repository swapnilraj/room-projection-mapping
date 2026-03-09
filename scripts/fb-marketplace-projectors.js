#!/usr/bin/env node
/**
 * Connect to Brave (or Chrome) running with --remote-debugging-port and
 * search Facebook Marketplace for projectors, then print best options for
 * budget (max £300), quiet, portable, HDMI.
 *
 * Usage:
 *   1. Start Brave with remote debugging:
 *      macOS:  /Applications/Brave\ Browser.app/Contents/MacOS/Brave\ Browser --remote-debugging-port=9222
 *      Or:    brave-browser --remote-debugging-port=9222
 *   2. Log into Facebook in that browser (Marketplace requires login).
 *   3. Run:   node scripts/fb-marketplace-projectors.js [PORT]
 *      Default port: 9222
 */

const http = require('http');
const PORT = parseInt(process.env.DEBUG_PORT || process.argv[2] || '9222', 10);

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
    console.error('Start Brave with: Brave Browser --remote-debugging-port=9222');
    console.error('(or your browser with --remote-debugging-port=' + PORT + ')');
    process.exit(1);
  });

  const browser = await Puppeteer.connect({ browserWSEndpoint: wsUrl, defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0] || (await browser.newPage());

  const marketplaceUrl = 'https://www.facebook.com/marketplace/search/?query=projector&locale=en_GB';
  console.log('Opening Facebook Marketplace (projectors)...');
  await page.goto(marketplaceUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

  await new Promise((r) => setTimeout(r, 4000));

  const listings = await page.evaluate(() => {
    const items = [];
    const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
    const seen = new Set();
    links.forEach((a) => {
      const href = a.href;
      if (seen.has(href)) return;
      seen.add(href);
      const span = a.querySelector('span');
      const priceEl = a.querySelector('[dir="auto"]');
      let title = (span && span.textContent) || (priceEl && priceEl.textContent) || '';
      let price = '';
      a.querySelectorAll('span').forEach((s) => {
        const t = (s.textContent || '').trim();
        if (/£\d+/.test(t)) price = t;
      });
      if (title && title.length < 200) items.push({ title, price, url: href });
    });
    return items.slice(0, 25);
  });

  console.log('\n--- Facebook Marketplace – Projectors (first 25) ---\n');
  listings.forEach((l, i) => {
    console.log(`${i + 1}. ${l.price || 'No price'} – ${l.title.slice(0, 80)}${l.title.length > 80 ? '...' : ''}`);
    console.log(`   ${l.url}\n`);
  });

  console.log('--- Best for you (max £300, portable, HDMI) ---');
  console.log('Look for: Anker/Nebula Capsule, Philips NeoPix, 1080p, LED/laser, “portable”.');
  console.log('Filter by price ≤ £300 in Marketplace and check “projector” + “portable” or “mini”.');

  await browser.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
