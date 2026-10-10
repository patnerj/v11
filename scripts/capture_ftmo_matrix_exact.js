const { chromium } = require('playwright');
const path = require('path');

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

  // Find the Trading Objectives section at #pricing
  const section = await page.$('section#pricing');
  if (section) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await section.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_objectives_matrix.png')
    });
    console.log('Captured template1_ftmo_objectives_matrix.png');
  }

  await browser.close();
  console.log('Done!');
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
