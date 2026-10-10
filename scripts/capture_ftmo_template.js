const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const artifactDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\1262ff78-0cd1-4527-bd28-002e49eee854';
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Navigating to live FTMO template...');
  await page.goto('https://demo.launchapropfirm.com/?template=ftmo', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  // 1. Hero & Header
  await page.screenshot({
    path: path.join(artifactDir, 'template1_ftmo_hero.png'),
    clip: { x: 0, y: 0, width: 1440, height: 950 }
  });
  console.log('Captured template1_ftmo_hero.png');

  // 2. Trading Objectives Matrix Section
  const matrixSection = await page.$('section:has-text("Trading Objectives")');
  if (matrixSection) {
    await matrixSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_matrix.png'),
      clip: { x: 0, y: 850, width: 1440, height: 950 }
    });
    console.log('Captured template1_ftmo_matrix.png');
  }

  // 3. Floating Switcher Open State
  const switcherBtn = await page.$('button[aria-label="Switch Landing Page Template"]');
  if (switcherBtn) {
    await switcherBtn.scrollIntoViewIfNeeded();
    await switcherBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_switcher_open.png'),
      clip: { x: 900, y: 400, width: 540, height: 500 }
    });
    console.log('Captured template1_ftmo_switcher_open.png');
  }

  await browser.close();
  console.log('Visual audit complete!');
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
