#!/usr/bin/env node
'use strict';

/**
 * Detailed element check for simulator
 */

const http = require('http');
const WebSocket = require('ws');

async function checkElements() {
  // Get list of targets
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  // Find the simulator page
  let target = targets.find(t => t.type === 'page' && t.url.includes('localhost:3847/simulator'));
  
  if (!target) {
    console.error('Simulator page not found! Please open it first.');
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

  console.log('\n=== DETAILED UI ELEMENT CHECK ===\n');

  const result = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const checks = {};
        
        // Header/Toolbar
        checks.toolbarTitle = !!document.querySelector('.toolbar-title');
        checks.modeToggles = document.querySelectorAll('input[name="mode"]').length;
        checks.compareButton = !!document.getElementById('btnCompare');
        checks.exportButton = !!document.getElementById('btnExport');
        
        // Left Panel
        checks.leftPanel = !!document.querySelector('.panel-left');
        checks.uploadButton = !!document.getElementById('btnUpload');
        checks.presetSelect = !!document.getElementById('presetImage');
        checks.ambientLightSlider = !!document.getElementById('ambientLight');
        checks.projBrightnessSlider = !!document.getElementById('projBrightness');
        checks.warpEnabledCheckbox = !!document.getElementById('warpEnabled');
        
        // Canvas Area
        checks.canvasWrapper = !!document.getElementById('canvasWrapper');
        checks.previewCanvas = !!document.getElementById('preview');
        
        // Right Panel
        checks.rightPanel = !!document.querySelector('.panel-right');
        checks.effectsList = !!document.getElementById('effectsList');
        checks.addEffectButton = !!document.getElementById('btnAddEffect');
        
        // Check canvas state
        const canvas = document.getElementById('preview');
        if (canvas) {
          checks.canvasWidth = canvas.width;
          checks.canvasHeight = canvas.height;
          
          // Check if image loaded
          const baseImg = window.state && window.state.baseImg;
          checks.baseImageLoaded = !!baseImg;
          
          // Count effects
          const effects = window.state && window.state.effects;
          checks.effectCount = effects ? effects.length : 0;
          checks.effectNames = effects ? effects.map(e => e.label).join(', ') : '';
        }
        
        // Check status bar
        checks.statusFps = document.getElementById('statusFps')?.textContent || '';
        checks.statusSize = document.getElementById('statusSize')?.textContent || '';
        
        return checks;
      })()
    `,
    returnByValue: true
  });

  const checks = result.result.value;
  
  console.log('TOOLBAR:');
  console.log(`  Title displayed: ${checks.toolbarTitle ? '✓' : '✗'}`);
  console.log(`  Mode toggles: ${checks.modeToggles} found`);
  console.log(`  Compare button: ${checks.compareButton ? '✓' : '✗'}`);
  console.log(`  Export button: ${checks.exportButton ? '✓' : '✗'}`);
  
  console.log('\nLEFT PANEL (Controls):');
  console.log(`  Panel exists: ${checks.leftPanel ? '✓' : '✗'}`);
  console.log(`  Upload button: ${checks.uploadButton ? '✓' : '✗'}`);
  console.log(`  Preset selector: ${checks.presetSelect ? '✓' : '✗'}`);
  console.log(`  Ambient light slider: ${checks.ambientLightSlider ? '✓' : '✗'}`);
  console.log(`  Projector brightness: ${checks.projBrightnessSlider ? '✓' : '✗'}`);
  console.log(`  Warp checkbox: ${checks.warpEnabledCheckbox ? '✓' : '✗'}`);
  
  console.log('\nCANVAS AREA:');
  console.log(`  Wrapper exists: ${checks.canvasWrapper ? '✓' : '✗'}`);
  console.log(`  Preview canvas: ${checks.previewCanvas ? '✓' : '✗'}`);
  console.log(`  Canvas dimensions: ${checks.canvasWidth}×${checks.canvasHeight}`);
  console.log(`  Base image loaded: ${checks.baseImageLoaded ? '✓' : '✗'}`);
  
  console.log('\nRIGHT PANEL (Effects):');
  console.log(`  Panel exists: ${checks.rightPanel ? '✓' : '✗'}`);
  console.log(`  Effects list: ${checks.effectsList ? '✓' : '✗'}`);
  console.log(`  Add effect button: ${checks.addEffectButton ? '✓' : '✗'}`);
  console.log(`  Active effects: ${checks.effectCount}`);
  if (checks.effectNames) {
    console.log(`  Effect names: ${checks.effectNames}`);
  }
  
  console.log('\nSTATUS BAR:');
  console.log(`  FPS display: ${checks.statusFps}`);
  console.log(`  Size display: ${checks.statusSize}`);
  
  console.log('\n');

  ws.close();
}

checkElements().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
