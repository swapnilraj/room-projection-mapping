#!/usr/bin/env node
/**
 * Debug script to see what controls exist in the simulator.
 */

const http = require('http');
const WebSocket = require('ws');

const PORT = 9222;

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
        // Ignore parse errors
      }
    };
    
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const tabs = JSON.parse(await httpGet(`http://127.0.0.1:${PORT}/json`));
  const targetTab = tabs.find(t => t.url && t.url.includes('localhost:3847/simulator'));
  
  if (!targetTab) {
    console.error('Simulator tab not found');
    process.exit(1);
  }

  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  console.log('Getting all labels and controls...\n');

  const controls = await sendCDP(ws, 'Runtime.evaluate', {
    expression: `
      (function() {
        const result = {
          labels: [],
          inputs: []
        };
        
        // Get all text labels
        const labels = document.querySelectorAll('label, .label, h1, h2, h3, h4, legend');
        labels.forEach(el => {
          const text = el.textContent.trim();
          if (text && text.length < 100) {
            result.labels.push(text);
          }
        });
        
        // Get all color inputs
        const colorInputs = document.querySelectorAll('input[type="color"]');
        colorInputs.forEach(input => {
          result.inputs.push({
            id: input.id,
            name: input.name,
            value: input.value,
            parent: input.parentElement?.textContent?.substring(0, 50) || 'no parent'
          });
        });
        
        // Get Environment panel structure
        const envText = document.querySelector('[class*="environment"], [class*="Environment"], .panel, .sidebar');
        result.environmentHTML = envText ? envText.innerHTML.substring(0, 500) : 'not found';
        
        return result;
      })()
    `,
    returnByValue: true
  });

  const data = controls.result.value;
  
  console.log('=== Labels found ===');
  data.labels.forEach((l, i) => console.log(`${i + 1}. ${l}`));
  
  console.log('\n=== Color inputs found ===');
  if (data.inputs.length === 0) {
    console.log('No color inputs found!');
  } else {
    data.inputs.forEach(inp => console.log(JSON.stringify(inp, null, 2)));
  }
  
  console.log('\n=== Environment panel HTML (first 500 chars) ===');
  console.log(data.environmentHTML);

  ws.close();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
