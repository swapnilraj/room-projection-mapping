#!/usr/bin/env node
// Extract sample reference data from the sample-reference.html page
// Usage: node scripts/extract-sample-reference.js

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const DEBUG_PORT = process.env.DEBUG_PORT || 9222;
const TARGET_URL = 'http://localhost:3847/scripts/sample-reference.html';

async function extractSampleReference() {
  let browser;
  try {
    console.log(`Connecting to Chrome on port ${DEBUG_PORT}...`);
    browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${DEBUG_PORT}`,
      defaultViewport: { width: 1200, height: 800 }
    });

    const page = await browser.newPage();
    
    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle0', timeout: 10000 });

    // Wait for the page to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot
    const screenshotPath = path.join(__dirname, '../sample-reference-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\nScreenshot saved to: ${screenshotPath}`);

    // Extract the pre element content
    const preContent = await page.evaluate(() => {
      const preElement = document.querySelector('pre');
      return preElement ? preElement.textContent : null;
    });

    // Check for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Check if image loaded successfully
    const imageStatus = await page.evaluate(() => {
      const img = document.querySelector('img');
      if (!img) return { loaded: false, error: 'No image element found' };
      if (!img.complete) return { loaded: false, error: 'Image not complete' };
      if (img.naturalWidth === 0) return { loaded: false, error: 'Image failed to load (naturalWidth = 0)' };
      return { loaded: true, width: img.naturalWidth, height: img.naturalHeight };
    });

    console.log('\n=== IMAGE STATUS ===');
    console.log(JSON.stringify(imageStatus, null, 2));

    if (errors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      errors.forEach(err => console.log(err));
    } else {
      console.log('\n=== CONSOLE ERRORS ===');
      console.log('None');
    }

    console.log('\n=== SAMPLE REFERENCE DATA ===');
    if (preContent) {
      console.log(preContent);
    } else {
      console.log('ERROR: Could not find <pre> element with sample data');
    }

    await page.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.disconnect();
    }
  }
}

extractSampleReference();
