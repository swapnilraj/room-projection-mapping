/**
 * simulator-setup.js
 * 
 * Navigate to the projection simulator, set up test conditions,
 * and capture a screenshot for visual comparison.
 * 
 * Usage:
 *   node simulator-setup.js
 * 
 * Connects to Chrome/Brave via CDP on port 9222 (override with DEBUG_PORT env var).
 */

const puppeteer = require('puppeteer-core');

async function main() {
  const debugPort = process.env.DEBUG_PORT || '9222';
  const browserURL = `http://127.0.0.1:${debugPort}`;
  
  console.log(`Connecting to browser at ${browserURL}...`);
  
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null
    });
    
    console.log('Connected to browser.');
    
    // Create a new page
    const page = await browser.newPage();
    console.log('Created new page.');
    
    console.log('Navigating to http://localhost:3847/simulator/...');
    await page.goto('http://localhost:3847/simulator/', { waitUntil: 'networkidle2' });
    
    console.log('Page loaded. Waiting for canvas to render...');
    // Wait for the canvas element to be present
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    // Give it a moment to render the initial image
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Setting up test conditions via JavaScript...');
    
    // Run the calibration setup code
    await page.evaluate(() => {
      window._calibration.setFlatProjection();
      window._calibration.setEnv({
        projColor: [37, 0, 255],
        ambient: 0.0,
        brightness: 1.0,
        spectralBleed: 0.80,
        surfaceGamma: 0.55,
        surfaceFloor: 0.01,
        scatter: 0.20,
        blackLevel: 0.0,
        lensBloom: 0.0,
        temp: 'neutral',
        material: 'matte'
      });
      window._calibration.forceRender();
    });
    
    console.log('Configuration applied. Waiting for render to complete...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Taking screenshot...');
    const screenshotPath = '../simulator-test-conditions.png';
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`Screenshot saved to ${screenshotPath}`);
    console.log('\nTest conditions have been applied:');
    console.log('  - Flat projection (no perspective)');
    console.log('  - Projector color: RGB(37, 0, 255)');
    console.log('  - Spectral bleed: 0.80');
    console.log('  - Surface gamma: 0.55');
    console.log('  - Scatter: 0.20');
    console.log('  - Material: matte, neutral temp');
    
  } catch (error) {
    console.error('Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nCould not connect to browser on port ' + debugPort);
      console.error('Start Chrome/Brave with: --remote-debugging-port=' + debugPort);
    }
    
    process.exit(1);
  }
  
  // Don't close the browser - leave it open for user inspection
  console.log('\nBrowser left open for inspection. Close manually when done.');
}

main().catch(console.error);
