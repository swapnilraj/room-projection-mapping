#!/usr/bin/env node
'use strict';

/**
 * Get console errors and check image loading
 */

const http = require('http');
const WebSocket = require('ws');

async function checkConsole() {
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  let target = targets.find(t => t.type === 'page' && t.url.includes('localhost:3847/simulator'));
  
  if (!target) {
    console.error('Simulator page not found!');
    process.exit(1);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
  await send('Runtime.enable');

  console.log('\n=== CHECKING JAVASCRIPT STATE ===\n');

  // Get detailed state
  const result = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const report = {
          stateExists: typeof state !== 'undefined',
          baseImg: null,
          workW: 0,
          workH: 0,
          mode: '',
          effectCount: 0,
          effects: [],
          errors: []
        };
        
        if (typeof state !== 'undefined') {
          report.baseImg = state.baseImg ? 'Image object exists' : null;
          report.workW = state.workW;
          report.workH = state.workH;
          report.mode = state.mode;
          report.effectCount = state.effects ? state.effects.length : 0;
          report.effects = state.effects ? state.effects.map(e => ({
            type: e.type,
            label: e.label,
            enabled: e.enabled
          })) : [];
          report.playing = state.playing;
          report.fps = state.fps;
        }
        
        // Check if canvas has content by sampling pixels
        const canvas = document.getElementById('preview');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const imageData = ctx.getImageData(
            Math.floor(canvas.width/2) - 50, 
            Math.floor(canvas.height/2) - 50,
            100, 100
          );
          const pixels = imageData.data;
          
          let nonZero = 0;
          let totalBrightness = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const brightness = pixels[i] + pixels[i+1] + pixels[i+2];
            totalBrightness += brightness;
            if (brightness > 0) nonZero++;
          }
          
          report.canvasCheck = {
            dimensions: canvas.width + '×' + canvas.height,
            pixelsSampled: pixels.length / 4,
            nonZeroPixels: nonZero,
            avgBrightness: (totalBrightness / (pixels.length / 4) / 3).toFixed(1),
            hasContent: nonZero > 0
          };
        }
        
        return report;
      })()
    `,
    returnByValue: true
  });

  const report = result.result.value;
  
  console.log('STATE OBJECT:');
  console.log(`  Exists: ${report.stateExists ? '✓' : '✗'}`);
  console.log(`  Base image: ${report.baseImg || '✗ Not loaded'}`);
  console.log(`  Work dimensions: ${report.workW}×${report.workH}`);
  console.log(`  Mode: ${report.mode}`);
  console.log(`  Playing: ${report.playing}`);
  console.log(`  FPS: ${report.fps}`);
  
  console.log('\nEFFECTS:');
  console.log(`  Count: ${report.effectCount}`);
  if (report.effects.length > 0) {
    report.effects.forEach(e => {
      console.log(`    - ${e.label} (${e.type}): ${e.enabled ? 'ON' : 'OFF'}`);
    });
  }
  
  console.log('\nCANVAS RENDERING:');
  if (report.canvasCheck) {
    const c = report.canvasCheck;
    console.log(`  Dimensions: ${c.dimensions}`);
    console.log(`  Pixels sampled: ${c.pixelsSampled}`);
    console.log(`  Non-zero pixels: ${c.nonZeroPixels}`);
    console.log(`  Avg brightness: ${c.avgBrightness}`);
    console.log(`  Has visual content: ${c.hasContent ? '✓ YES' : '✗ NO'}`);
  }
  
  console.log('\n');

  ws.close();
}

checkConsole().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
