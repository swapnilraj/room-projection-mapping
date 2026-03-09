#!/usr/bin/env node
'use strict';

/**
 * Simple test using CDP directly via WebSocket
 */

const http = require('http');
const WebSocket = require('ws');

async function testSimulator() {
  const url = 'http://localhost:3847/simulator/';
  
  console.log('Getting browser target...');
  
  // Get list of targets
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  // Find a page target or create one
  let target = targets.find(t => t.type === 'page' && t.url.startsWith('http://localhost:3847'));
  
  if (!target) {
    console.log('Opening new tab...');
    target = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 9222,
        path: '/json/new?' + url,
        method: 'PUT'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.end();
    });
  }

  console.log(`Connected to page: ${target.title}`);
  console.log(`WebSocket: ${target.webSocketDebuggerUrl}`);

  // Connect via WebSocket
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const messages = [];
  const errors = [];
  let messageId = 1;

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = messageId++;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === id) {
          ws.removeListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await new Promise((resolve) => ws.once('open', resolve));
  
  console.log('\nEnabling domains...');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Page.enable');

  // Listen for console messages
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '');
      const type = msg.params.type;
      console.log(`[Console ${type}] ${args.join(' ')}`);
      messages.push({ type, args });
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const ex = msg.params.exceptionDetails;
      const error = ex.exception.description || ex.text;
      console.error(`[Error] ${error}`);
      errors.push(error);
    }
  });

  console.log(`\nNavigating to ${url}...`);
  await send('Page.navigate', { url });

  // Wait for load
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\nTaking screenshot...');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  
  const fs = require('fs');
  const screenshotPath = '/Users/swp/dev/swapnilraj/room-projection-mapping/scripts/simulator-screenshot.png';
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Screenshot saved to: ${screenshotPath}`);

  // Evaluate JavaScript to check canvas
  console.log('\nChecking canvas...');
  const result = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const canvas = document.getElementById('preview');
        if (!canvas) return { error: 'Canvas not found' };
        
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        
        if (w === 0 || h === 0) {
          return { error: 'Canvas has zero dimensions', width: w, height: h };
        }
        
        const imageData = ctx.getImageData(0, 0, Math.min(w, 100), Math.min(h, 100));
        const pixels = imageData.data;
        
        let hasContent = false;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 0 || pixels[i+1] > 0 || pixels[i+2] > 0) {
            hasContent = true;
            break;
          }
        }
        
        return {
          width: w,
          height: h,
          hasContent,
          samplePixels: Array.from(pixels.slice(0, 40))
        };
      })()
    `,
    returnByValue: true
  });

  const canvasInfo = result.result.value;
  if (canvasInfo.error) {
    console.log(`  ✗ ${canvasInfo.error}`);
  } else {
    console.log(`  Canvas dimensions: ${canvasInfo.width}×${canvasInfo.height}`);
    console.log(`  Has visual content: ${canvasInfo.hasContent ? '✓ YES' : '✗ NO (blank canvas)'}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Console messages: ${messages.length}`);
  console.log(`JavaScript errors: ${errors.length}`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  ERRORS FOUND:');
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  } else {
    console.log(`Error status: ✓ No JavaScript errors`);
  }

  ws.close();
  console.log('\nTest complete.\n');
}

testSimulator().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
