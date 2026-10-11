const { chromium } = require('playwright');
const path = require('path');

async function capture() {
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

  console.log('Navigating to FTMO mobile light mode...');
  await page.goto('https://demo.launchapropfirm.com/?template=ftmo', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  // Toggle theme to light mode
  const themeToggle = await page.$('button[title*="Day Mode"], button[title*="Light"]');
  if (themeToggle) {
    await themeToggle.click();
    await page.waitForTimeout(1000);
  }

  // Mobile Hero
  await page.screenshot({
    path: path.join(artifactDir, 'template1_ftmo_mobile_hero_light.png'),
    clip: { x: 0, y: 0, width: 390, height: 844 }
  });
  console.log('Captured template1_ftmo_mobile_hero_light.png');

  // Mobile Objectives Card
  const section = await page.$('section#pricing');
  if (section) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_mobile_matrix_light.png'),
      clip: { x: 0, y: 0, width: 390, height: 844 }
    });
    console.log('Captured template1_ftmo_mobile_matrix_light.png');
  }

  await browser.close();
  console.log('Done mobile light audit!');
}

capture().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
