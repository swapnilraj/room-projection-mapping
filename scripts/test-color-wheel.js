#!/usr/bin/env node
'use strict';

/**
 * Test color wheel functionality in simulator
 * Tests: rendering, hue ring interaction, saturation/brightness square interaction, projection update
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

async function testColorWheel() {
  const url = 'http://localhost:3847/simulator/?nocache=wheel1';
  
  console.log('Getting browser target...');
  
  // Get list of targets
  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  // Find existing simulator tab or create new one
  let target = targets.find(t => t.type === 'page' && t.url.includes('localhost:3847/simulator'));
  
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
  } else {
    console.log('Using existing tab, navigating to URL...');
  }

  console.log(`Connected to page: ${target.title || 'Simulator'}`);

  // Connect via WebSocket
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  const consoleMessages = [];
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
  await send('DOM.enable');
  await send('Input.enable');

  // Listen for console messages and errors
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = msg.params.args.map(a => a.value || a.description || '');
      const type = msg.params.type;
      consoleMessages.push({ type, args });
      
      // Filter out browser extension warnings
      const text = args.join(' ');
      if (!text.includes('extension') && !text.includes('Extension')) {
        console.log(`[Console ${type}] ${text}`);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const ex = msg.params.exceptionDetails;
      const error = ex.exception.description || ex.text;
      errors.push(error);
      console.error(`[JS Error] ${error}`);
    }
  });

  console.log(`\nNavigating to ${url}...`);
  await send('Page.navigate', { url });

  console.log('Waiting for page load...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n' + '='.repeat(70));
  console.log('STEP 1: Check for Console Errors');
  console.log('='.repeat(70));
  
  if (errors.length > 0) {
    console.log(`❌ Found ${errors.length} JavaScript error(s):`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  } else {
    console.log('✅ No JavaScript errors found');
  }

  console.log('\n' + '='.repeat(70));
  console.log('STEP 2: Check Color Wheel Rendering');
  console.log('='.repeat(70));

  const wheelCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        // Look for "Projection Color" label
        const labels = Array.from(document.querySelectorAll('label'));
        const colorLabel = labels.find(l => l.textContent.includes('Projection Color'));
        
        // Look for color wheel canvas
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const wheelCanvas = canvases.find(c => 
          c.classList.contains('color-wheel') || 
          c.parentElement?.classList.contains('color-wheel-container') ||
          (c.width > 150 && c.width < 200 && c.height === c.width)
        );
        
        // Look for hex input
        const hexInput = document.querySelector('input[type="text"][value^="#"]') ||
                        document.querySelector('input[placeholder*="hex"]') ||
                        Array.from(document.querySelectorAll('input[type="text"]'))
                          .find(inp => /^#[0-9a-fA-F]{6}$/.test(inp.value));
        
        // Look for native color picker
        const colorInput = document.querySelector('input[type="color"]');
        
        return {
          hasLabel: !!colorLabel,
          labelText: colorLabel?.textContent || null,
          hasWheelCanvas: !!wheelCanvas,
          wheelWidth: wheelCanvas?.width || null,
          wheelHeight: wheelCanvas?.height || null,
          wheelVisible: wheelCanvas ? 
            (wheelCanvas.offsetWidth > 0 && wheelCanvas.offsetHeight > 0) : false,
          hasHexInput: !!hexInput,
          hexValue: hexInput?.value || null,
          hasColorInput: !!colorInput,
          colorValue: colorInput?.value || null,
          wheelSelector: wheelCanvas?.className || wheelCanvas?.id || 'no-class-or-id'
        };
      })()
    `,
    returnByValue: true
  });

  const wheelInfo = wheelCheck.result.value;
  
  console.log(`Label "Projection Color": ${wheelInfo.hasLabel ? '✅' : '❌'}`);
  if (wheelInfo.hasLabel) {
    console.log(`  Text: "${wheelInfo.labelText}"`);
  }
  
  console.log(`Color wheel canvas: ${wheelInfo.hasWheelCanvas ? '✅' : '❌'}`);
  if (wheelInfo.hasWheelCanvas) {
    console.log(`  Dimensions: ${wheelInfo.wheelWidth}×${wheelInfo.wheelHeight}px`);
    console.log(`  Visible: ${wheelInfo.wheelVisible ? '✅' : '❌'}`);
    console.log(`  Selector: ${wheelInfo.wheelSelector}`);
  }
  
  console.log(`Hex input field: ${wheelInfo.hasHexInput ? '✅' : '❌'}`);
  if (wheelInfo.hasHexInput) {
    console.log(`  Current value: ${wheelInfo.hexValue}`);
  }
  
  console.log(`Native color picker: ${wheelInfo.hasColorInput ? '✅' : '❌'}`);
  if (wheelInfo.hasColorInput) {
    console.log(`  Current value: ${wheelInfo.colorValue}`);
  }

  // Take initial screenshot
  console.log('\nTaking initial screenshot...');
  const screenshot1 = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath1 = '/Users/swp/dev/swapnilraj/room-projection-mapping/scripts/color-wheel-initial.png';
  fs.writeFileSync(screenshotPath1, Buffer.from(screenshot1.data, 'base64'));
  console.log(`  Saved: ${screenshotPath1}`);

  if (!wheelInfo.hasWheelCanvas) {
    console.log('\n⚠️  Cannot continue: Color wheel canvas not found');
    ws.close();
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log('STEP 3: Test Hue Ring Interaction');
  console.log('='.repeat(70));

  // Get the canvas position and simulate clicking on the hue ring
  const canvasRect = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const wheelCanvas = canvases.find(c => 
          c.classList.contains('color-wheel') || 
          (c.width > 150 && c.width < 200 && c.height === c.width)
        );
        
        if (!wheelCanvas) return null;
        
        const rect = wheelCanvas.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          centerX: rect.x + rect.width / 2,
          centerY: rect.y + rect.height / 2
        };
      })()
    `,
    returnByValue: true
  });

  if (!canvasRect.result.value) {
    console.log('❌ Could not get canvas position');
  } else {
    const rect = canvasRect.result.value;
    console.log(`Canvas position: (${rect.x}, ${rect.y}), size: ${rect.width}×${rect.height}`);
    
    // Click on the hue ring at roughly 240° (blue)
    // The ring is around the outside, so we click near the edge
    const centerX = rect.centerX;
    const centerY = rect.centerY;
    const radius = rect.width / 2 - 15; // Near the outer edge
    const angle = 240 * Math.PI / 180; // Blue hue
    const clickX = centerX + radius * Math.cos(angle);
    const clickY = centerY + radius * Math.sin(angle);
    
    console.log(`Clicking hue ring at (${clickX.toFixed(1)}, ${clickY.toFixed(1)}) for blue hue...`);
    
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: clickX,
      y: clickY,
      button: 'left',
      clickCount: 1
    });
    
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: clickX,
      y: clickY,
      button: 'left',
      clickCount: 1
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('✅ Clicked hue ring');
  }

  console.log('\n' + '='.repeat(70));
  console.log('STEP 4: Test Saturation/Brightness Square');
  console.log('='.repeat(70));

  if (canvasRect.result.value) {
    const rect = canvasRect.result.value;
    
    // Click in the middle-right of the inner square for saturated, mid-brightness color
    const squareClickX = rect.centerX + rect.width * 0.15; // Right side of square
    const squareClickY = rect.centerY; // Middle height
    
    console.log(`Clicking inner square at (${squareClickX.toFixed(1)}, ${squareClickY.toFixed(1)})...`);
    
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: squareClickX,
      y: squareClickY,
      button: 'left',
      clickCount: 1
    });
    
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: squareClickX,
      y: squareClickY,
      button: 'left',
      clickCount: 1
    });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('✅ Clicked inner square');
  }

  console.log('\n' + '='.repeat(70));
  console.log('STEP 5: Verify Color Updates');
  console.log('='.repeat(70));

  const colorUpdate = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const hexInput = document.querySelector('input[type="text"][value^="#"]') ||
                        Array.from(document.querySelectorAll('input[type="text"]'))
                          .find(inp => /^#[0-9a-fA-F]{6}$/.test(inp.value));
        
        const colorInput = document.querySelector('input[type="color"]');
        
        // Check preview canvas for color change
        const preview = document.getElementById('preview');
        let projectionHasColor = false;
        
        if (preview) {
          const ctx = preview.getContext('2d');
          const imageData = ctx.getImageData(
            preview.width / 2, 
            preview.height / 2, 
            1, 
            1
          );
          const [r, g, b] = imageData.data;
          projectionHasColor = r > 0 || g > 0 || b > 0;
        }
        
        return {
          hexValue: hexInput?.value || null,
          colorValue: colorInput?.value || null,
          projectionHasColor,
          isWhite: hexInput?.value === '#ffffff' || hexInput?.value === '#FFFFFF'
        };
      })()
    `,
    returnByValue: true
  });

  const updateInfo = colorUpdate.result.value;
  
  console.log(`Hex input value: ${updateInfo.hexValue}`);
  console.log(`Native color value: ${updateInfo.colorValue}`);
  console.log(`Color changed from white: ${!updateInfo.isWhite ? '✅' : '❌'}`);
  console.log(`Projection has color: ${updateInfo.projectionHasColor ? '✅' : '❌'}`);

  // Take final screenshot
  console.log('\nTaking final screenshot...');
  const screenshot2 = await send('Page.captureScreenshot', { format: 'png' });
  const screenshotPath2 = '/Users/swp/dev/swapnilraj/room-projection-mapping/scripts/color-wheel-final.png';
  fs.writeFileSync(screenshotPath2, Buffer.from(screenshot2.data, 'base64'));
  console.log(`  Saved: ${screenshotPath2}`);

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  
  const passed = [];
  const failed = [];
  
  if (errors.length === 0) {
    passed.push('No console errors');
  } else {
    failed.push(`${errors.length} console error(s)`);
  }
  
  if (wheelInfo.hasWheelCanvas && wheelInfo.wheelVisible) {
    passed.push('Color wheel renders correctly');
  } else {
    failed.push('Color wheel not rendering');
  }
  
  if (wheelInfo.hasHexInput && wheelInfo.hasColorInput) {
    passed.push('Input fields present');
  } else {
    failed.push('Missing input fields');
  }
  
  if (!updateInfo.isWhite) {
    passed.push('Color changed on interaction');
  } else {
    failed.push('Color did not change');
  }
  
  if (updateInfo.projectionHasColor) {
    passed.push('Projection canvas updated');
  } else {
    failed.push('Projection canvas not updated');
  }
  
  console.log(`\n✅ PASSED (${passed.length}):`);
  passed.forEach(p => console.log(`   • ${p}`));
  
  if (failed.length > 0) {
    console.log(`\n❌ FAILED (${failed.length}):`);
    failed.forEach(f => console.log(`   • ${f}`));
  }
  
  console.log(`\nScreenshots saved:`);
  console.log(`  • ${screenshotPath1}`);
  console.log(`  • ${screenshotPath2}`);

  ws.close();
  console.log('\n✅ Test complete.\n');
}

testColorWheel().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
