const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const artifactDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\1262ff78-0cd1-4527-bd28-002e49eee854';
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  console.log('Navigating to FTMO on mobile...');
  await page.goto('https://ftmo.com/en/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(4000);

  // Look for the challenge/pricing section
  const section = await page.$('section:has-text("Choose Your FTMO Challenge")');
  if (section) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await section.screenshot({
      path: path.join(artifactDir, 'ftmo_mobile_matrix.png')
    });
    console.log('Captured ftmo_mobile_matrix.png successfully!');
  } else {
    console.log('Section not found directly, scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(artifactDir, 'ftmo_mobile_matrix.png')
    });
    console.log('Captured fallback screenshot!');
  }

  await browser.close();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
