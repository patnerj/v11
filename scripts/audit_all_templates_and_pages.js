const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\2c90911c-3c65-44c9-8596-1be53081d2b6';
const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const templates = ['ftmo', 'neon', 'terminal', 'classic'];
  const pages = ['/', '/about', '/how-it-works', '/faq', '/contact', '/tournaments', '/challenges', '/payouts'];

  const results = {
    templates: {},
    pages: {},
    overflows: []
  };

  for (const tpl of templates) {
    results.templates[tpl] = {};
    for (const mode of ['dark', 'light']) {
      for (const vp of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'mobile', width: 390, height: 844 }]) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.name === 'mobile'
        });
        const page = await context.newPage();

        // set localStorage theme before navigation
        await page.addInitScript((themeMode) => {
          if (themeMode === 'light') {
            localStorage.setItem('theme', 'light');
            localStorage.setItem('user-theme', 'clean-light');
          } else {
            localStorage.setItem('theme', 'dark');
            localStorage.setItem('user-theme', 'midnight-obsidian');
          }
        }, mode);

        const url = `${BASE_URL}/?template=${tpl}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(1000);

        // Ensure theme applied
        if (mode === 'light') {
          await page.evaluate(() => {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            document.documentElement.setAttribute('data-theme', 'clean-light');
          });
        } else {
          await page.evaluate(() => {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'midnight-obsidian');
          });
        }
        await page.waitForTimeout(500);

        // Check horizontal overflow
        const overflow = await page.evaluate(() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
          };
        });

        if (overflow.hasOverflow) {
          results.overflows.push({ template: tpl, mode, viewport: vp.name, overflow });
        }

        const screenshotName = `audit_${tpl}_${mode}_${vp.name}.png`;
        const screenshotPath = path.join(ARTIFACT_DIR, screenshotName);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Captured ${screenshotName} (overflow: ${overflow.hasOverflow})`);

        await context.close();
      }
    }
  }

  // Check public pages in light mode mobile
  for (const p of pages) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'light');
      localStorage.setItem('user-theme', 'clean-light');
    });

    const url = `${BASE_URL}${p}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'clean-light');
    });
    await page.waitForTimeout(400);

    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });

    const pageSlug = p === '/' ? 'home' : p.replace(/\//g, '_');
    const screenshotName = `page_${pageSlug}_light_mobile.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, screenshotName) });
    console.log(`Captured ${screenshotName} (overflow: ${overflow.hasOverflow})`);
    if (overflow.hasOverflow) {
      results.overflows.push({ page: p, overflow });
    }

    await context.close();
  }

  await browser.close();
  console.log('AUDIT COMPLETE. Overflows count:', results.overflows.length);
  if (results.overflows.length > 0) {
    console.log('Overflows detected:', JSON.stringify(results.overflows, null, 2));
  }
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
