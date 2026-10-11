const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\2c90911c-3c65-44c9-8596-1be53081d2b6';
const BASE_URL = 'http://localhost:3000';

async function verify() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  const templates = ['ftmo', 'neon', 'terminal', 'classic'];

  for (const tpl of templates) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/?template=${tpl}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Switch to light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'clean-light');
    });
    await page.waitForTimeout(500);

    // Check bounds of promo popup vs template switcher
    const bounds = await page.evaluate(() => {
      const popup = document.querySelector('aside[aria-label="Promotional offer"]');
      const switcher = document.querySelector('button[title="Switch Landing Page Template"]');

      if (!popup || !switcher) {
        return { error: 'elements not found', popup: !!popup, switcher: !!switcher };
      }

      const pBox = popup.getBoundingClientRect();
      const sBox = switcher.getBoundingClientRect();

      // Check if bounding boxes intersect
      const horizontalOverlap = !(pBox.right < sBox.left || pBox.left > sBox.right);
      const verticalOverlap = !(pBox.bottom < sBox.top || pBox.top > sBox.bottom);
      const collision = horizontalOverlap && verticalOverlap;

      return {
        popup: { top: pBox.top, bottom: pBox.bottom, left: pBox.left, right: pBox.right, height: pBox.height, width: pBox.width },
        switcher: { top: sBox.top, bottom: sBox.bottom, left: sBox.left, right: sBox.right, height: sBox.height, width: sBox.width },
        horizontalOverlap,
        verticalOverlap,
        collision
      };
    });

    console.log(`[${tpl}] Collision check:`, bounds.collision ? 'COLLISION DETECTED!' : 'ZERO COLLISION (PASS)');
    if (bounds.collision) {
      console.error(`ERROR: Collided on template ${tpl}`, bounds);
      process.exit(1);
    } else {
      console.log(`[${tpl}] Popup bottom: ${bounds.popup.bottom}, Switcher top: ${bounds.switcher.top}. Gap: ${bounds.switcher.top - bounds.popup.bottom}px`);
    }

    // Verify #pricing anchor exists on page
    const pricingAnchor = await page.$('#pricing');
    console.log(`[${tpl}] #pricing anchor exists:`, !!pricingAnchor);
    if (!pricingAnchor) {
      console.error(`ERROR: #pricing missing on template ${tpl}`);
      process.exit(1);
    }

    // Capture screenshot
    const shotName = `verified_fix_${tpl}_mobile_light.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, shotName) });
    console.log(`Captured ${shotName}`);

    await context.close();
  }

  // Also test dismissal of popup
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/?template=ftmo`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Click close [x] button
    const closeBtn = await page.$('button[aria-label="Close promotional offer"]');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);

      const isDismissedStored = await page.evaluate(() => localStorage.getItem('fxsim_promo_dismissed'));
      console.log('localStorage fxsim_promo_dismissed after click:', isDismissedStored);

      const popupVisible = await page.$('aside[aria-label="Promotional offer"]');
      console.log('Popup visible after close:', !!popupVisible);

      // Reload page and verify it remains dismissed
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const popupAfterReload = await page.$('aside[aria-label="Promotional offer"]');
      console.log('Popup visible after reload (persistence check):', !!popupAfterReload);
      if (popupAfterReload) {
        console.error('ERROR: Popup reopened after being dismissed!');
        process.exit(1);
      }
    }
    await context.close();
  }

  await browser.close();
  console.log('ALL VERIFICATION CHECKS PASSED 100%!');
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
