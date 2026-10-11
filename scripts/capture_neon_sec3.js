const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto('http://localhost:3000/?template=neon');
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.setAttribute('data-theme', 'clean-light');
  });
  await page.waitForTimeout(500);
  const sec = await page.$('#challenge-models');
  if (sec) {
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\2c90911c-3c65-44c9-8596-1be53081d2b6\\neon_section3_light.png' });
    console.log('Captured neon_section3_light.png');
  }
  await browser.close();
})();
