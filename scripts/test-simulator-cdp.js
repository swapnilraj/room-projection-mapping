#!/usr/bin/env node
/**
 * Test the projection mapping simulator color controls using CDP directly.
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const PORT = parseInt(process.env.DEBUG_PORT || process.argv[2] || '9222', 10);

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

let cdpId = 1;
async function sendCDP(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = cdpId++;
    const timeout = setTimeout(() => {
      ws.removeAllListeners('message');
      reject(new Error(`CDP timeout for ${method}`));
    }, 10000);
    
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          if (msg.error) {
            reject(new Error(`CDP error: ${JSON.stringify(msg.error)}`));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {
        // Ignore parse errors for event messages
      }
    };
    
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  console.log('Getting browser tabs...');
  const tabs = JSON.parse(await httpGet(`http://127.0.0.1:${PORT}/json`));
  
  let targetTab = tabs.find(t => t.url && t.url.includes('localhost:3847/simulator'));
  
  if (!targetTab) {
    console.log('Simulator tab not found. Creating new tab...');
    const newTabData = await httpGet(`http://127.0.0.1:${PORT}/json/new?http://localhost:3847/simulator/?v=3`);
    targetTab = JSON.parse(newTabData);
  }

  console.log(`Connecting to tab: ${targetTab.title || targetTab.url}`);
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

  await new Promise((resolve) => ws.once('open', resolve));
  console.log('Connected via CDP!');

  // Simple approach - skip domain enables since tab is already active
  console.log('Waiting for page to stabilize...');
  await new Promise(r => setTimeout(r, 2000));

  // Listen for console messages
  const consoleErrors = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text);
    }
  });

  await new Promise(r => setTimeout(r, 1000));

  // Check for canvas
  console.log('Checking canvas rendering...');
  const canvasCheck = await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      const canvas = document.querySelector('canvas');
      canvas && canvas.width > 0 && canvas.height > 0
    `
  });
  console.log(`Canvas rendered: ${canvasCheck.result.value}`);

  // Find projection color control
  console.log('\nLooking for Projection Color control...');
  const colorPickerCheck = await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (function() {
        const labels = Array.from(document.querySelectorAll('label, div, span'));
        const projectionLabel = labels.find(el => el.textContent && el.textContent.includes('Projection Color'));
        
        if (!projectionLabel) {
          return { found: false, message: 'Label not found' };
        }
        
        // Search for color input
        let colorInput = projectionLabel.querySelector('input[type="color"]');
        if (!colorInput) {
          const parent = projectionLabel.closest('div, .control, .form-group');
          if (parent) colorInput = parent.querySelector('input[type="color"]');
        }
        if (!colorInput) {
          const next = projectionLabel.nextElementSibling;
          if (next && next.tagName === 'INPUT' && next.type === 'color') {
            colorInput = next;
          }
        }
        
        if (!colorInput) {
          return { 
            found: false, 
            message: 'Label found but no color input',
            labelText: projectionLabel.textContent.substring(0, 100)
          };
        }
        
        return {
          found: true,
          id: colorInput.id,
          value: colorInput.value
        };
      })()
    `,
    returnByValue: true
  });

  const colorInfo = colorPickerCheck.result.value;
  console.log(JSON.stringify(colorInfo, null, 2));

  if (!colorInfo.found) {
    console.log('\n⚠️  Projection Color control NOT found!');
    console.log(colorInfo.message);
    
    // Take screenshot
    const screenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/simulator-no-picker.png', Buffer.from(screenshot.data, 'base64'));
    console.log('Screenshot: /tmp/simulator-no-picker.png');
  } else {
    console.log('\n✓ Projection Color control FOUND!');
    console.log(`Current value: ${colorInfo.value}`);

    // Test color changes
    console.log('\nTesting blue (#3366ff)...');
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        const input = document.getElementById('${colorInfo.id}');
        input.value = '#3366ff';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      `
    });
    await new Promise(r => setTimeout(r, 500));
    
    const ss1 = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/simulator-blue.png', Buffer.from(ss1.data, 'base64'));
    console.log('Screenshot: /tmp/simulator-blue.png');

    console.log('Testing red (#ff3333)...');
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        const input = document.getElementById('${colorInfo.id}');
        input.value = '#ff3333';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      `
    });
    await new Promise(r => setTimeout(r, 500));
    
    const ss2 = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/simulator-red.png', Buffer.from(ss2.data, 'base64'));
    console.log('Screenshot: /tmp/simulator-red.png');

    console.log('Testing white (#ffffff)...');
    await sendCDP(ws, 'Runtime.evaluate', {
      expression: `
        const input = document.getElementById('${colorInfo.id}');
        input.value = '#ffffff';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      `
    });
    await new Promise(r => setTimeout(r, 500));
    
    const ss3 = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('/tmp/simulator-white.png', Buffer.from(ss3.data, 'base64'));
    console.log('Screenshot: /tmp/simulator-white.png');

    console.log('\n✓ Color change test completed');
  }

  // Report console errors
  console.log('\n--- Console Errors ---');
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
  } else {
    console.log('✓ No console errors detected');
  }

  ws.close();
  console.log('\n--- Test Complete ---');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
