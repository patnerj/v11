const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  console.log('Navigating to login...');
  await page.goto('https://demo.launchapropfirm.com/login', { waitUntil: 'networkidle' });
  await page.fill('#user', 'admin');
  await page.fill('#pwd', 'AdminPropFirm2026!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log('URL after login:', page.url());

  console.log('Navigating to /admin/operations...');
  await page.goto('https://demo.launchapropfirm.com/admin/operations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('Clicking MT5 Gateway Bridge tab...');
  const mt5Btn = page.locator('button:has-text("MT5 Gateway Bridge")');
  await mt5Btn.first().click();
  await page.waitForTimeout(1500);
  
  console.log('Clicking Test MT5 Manager Connection...');
  const pingBtn = page.locator('button:has-text("Test MT5 Manager Connection")');
  await pingBtn.first().click();
  await page.waitForTimeout(5000);
  
  const pingBox = await page.locator('text=Latency').locator('..').innerText().catch(() => '');
  console.log('Ping box:', pingBox);

  const toasts = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  console.log('Toasts after ping:', toasts);

  console.log('Clicking Save MT5 Gateway Settings...');
  const saveBtn = page.locator('button:has-text("Save MT5 Gateway Settings")');
  await saveBtn.first().click();
  await page.waitForTimeout(4000);

  const toastsAfterSave = await page.locator('[data-sonner-toast]').allInnerTexts().catch(() => []);
  console.log('Toasts after save:', toastsAfterSave);
  
  await browser.close();
})();
