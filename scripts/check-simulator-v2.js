#!/usr/bin/env node
/**
 * Check simulator page - improved version with better selectors
 */

const puppeteer = require('puppeteer-core');
const http = require('http');

const PORT = 9222;
const TARGET_URL = 'http://localhost:3847/simulator/?v=2';

function getWsUrl(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).webSocketDebuggerUrl);
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(2000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

(async () => {
  try {
    console.log('Connecting...');
    const wsUrl = await getWsUrl(PORT);
    const browser = await puppeteer.connect({ 
      browserWSEndpoint: wsUrl,
      defaultViewport: null 
    });
    
    console.log('Creating new page...');
    const page = await browser.newPage();

    const messages = [];
    const errors = [];
    
    page.on('console', (msg) => {
      const text = msg.text();
      if (!text.includes('Extension') && !text.includes('extension')) {
        messages.push({ type: msg.type(), text });
      }
    });
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 8000 });
    
    console.log('Doing hard reload...');
    await page.reload({ waitUntil: 'load', timeout: 8000 });
    
    console.log('Waiting for page to stabilize...');
    await new Promise(r => setTimeout(r, 3000));

    // Check DOM with detailed inspection
    const domInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const effectsList = [];
      
      // Look in the EFFECTS STACK panel - scan all divs for button patterns
      const seenNames = new Set();
      const allDivs = Array.from(document.querySelectorAll('div'));
      allDivs.forEach(div => {
        const buttons = div.querySelectorAll('button');
        if (buttons.length > 0) {
          // Check if this div has an On/Off toggle button
          let toggleButton = null;
          buttons.forEach(btn => {
            if (btn.textContent === 'On' || btn.textContent === 'Off') {
              toggleButton = btn;
            }
          });
          
          if (toggleButton) {
            // Extract name by removing button text and control chars
            const fullText = div.textContent || '';
            const cleanText = fullText
              .replace(/On|Off/g, '')
              .replace(/[+×\-]/g, '')
              .replace(/Center X.*$/g, '') // Remove parameter labels
              .replace(/Count.*$/g, '')
              .replace(/Speed.*$/g, '')
              .replace(/Max Radius.*$/g, '')
              .replace(/[\d.]+/g, '')
              .trim();
            
            // Only add unique effect names (avoid duplicates from nested divs)
            if (cleanText && cleanText.length > 2 && cleanText.length < 50 && 
                !cleanText.includes('EFFECTS') && !seenNames.has(cleanText)) {
              seenNames.add(cleanText);
              effectsList.push({
                name: cleanText,
                enabled: toggleButton.textContent === 'On'
              });
            }
          }
        }
      });
      
      // FPS - look for text pattern "XXX fps" in the entire document
      let fps = null;
      const allTextNodes = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text) {
          const fpsMatch = text.match(/(\d+)\s*fps/i);
          if (fpsMatch) {
            fps = `${fpsMatch[1]} fps`;
            break;
          }
        }
      }
      
      // Canvas content check
      let hasVisualContent = false;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
        for (let i = 3; i < data.data.length; i += 4) {
          if (data.data[i] > 0) {
            hasVisualContent = true;
            break;
          }
        }
      }
      
      return {
        hasCanvas: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
        hasVisualContent,
        effects: effectsList,
        fps,
        // Debug info
        bodyText: document.body.textContent.substring(0, 500)
      };
    });

    // Screenshot
    const screenshotPath = '/Users/swp/dev/swapnilraj/room-projection-mapping/simulator-screenshot.png';
    await page.screenshot({ path: screenshotPath });

    // Report
    console.log('\n=== SIMULATOR CHECK REPORT ===\n');
    
    console.log('1. CONSOLE ERRORS/WARNINGS:');
    const consoleErrors = messages.filter(m => m.type === 'error');
    const consoleWarnings = messages.filter(m => m.type === 'warning');
    
    if (errors.length === 0 && consoleErrors.length === 0 && consoleWarnings.length === 0) {
      console.log('   ✓ No errors or warnings\n');
    } else {
      if (errors.length > 0) {
        console.log('   ✗ Page Errors:');
        errors.forEach((e, i) => console.log(`     ${i+1}. ${e}`));
      }
      if (consoleErrors.length > 0) {
        console.log('   ✗ Console Errors:');
        consoleErrors.forEach((m, i) => console.log(`     ${i+1}. ${m.text}`));
      }
      if (consoleWarnings.length > 0) {
        console.log('   ⚠ Console Warnings:');
        consoleWarnings.forEach((m, i) => console.log(`     ${i+1}. ${m.text}`));
      }
      console.log('');
    }

    console.log('2. VISUAL CONTENT:');
    if (domInfo.hasCanvas) {
      console.log(`   ✓ Canvas found: ${domInfo.canvasSize}`);
      console.log(`   ${domInfo.hasVisualContent ? '✓' : '✗'} Has visual content: ${domInfo.hasVisualContent ? 'YES' : 'NO'}\n`);
    } else {
      console.log('   ✗ No canvas found\n');
    }

    console.log('3. EFFECTS LIST:');
    if (domInfo.effects.length > 0) {
      console.log(`   Found ${domInfo.effects.length} effect(s):`);
      domInfo.effects.forEach((e, i) => {
        const status = e.enabled ? '✓ Enabled' : '✗ Disabled';
        console.log(`     ${i+1}. ${e.name} (${status})`);
      });
      console.log('');
    } else {
      console.log('   ⚠ No effects found in DOM');
      console.log('   (This might be a selector issue - see screenshot for actual UI)\n');
    }

    console.log('4. FPS COUNTER:');
    if (domInfo.fps) {
      console.log(`   ${domInfo.fps}\n`);
    } else {
      console.log('   ⚠ FPS counter not detected\n');
    }

    console.log(`Screenshot saved: ${screenshotPath}\n`);

    await page.close();
    await browser.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
