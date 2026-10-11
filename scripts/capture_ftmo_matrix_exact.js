const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  const artifactDir = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\1262ff78-0cd1-4527-bd28-002e49eee854';
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });
  const page = await context.newPage();

  console.log('Navigating to local FTMO template on port 3000...');
  try {
    await page.goto('http://localhost:3000/?template=ftmo', { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    console.log('Falling back to demo host...');
    await page.goto('https://demo.launchapropfirm.com/?template=ftmo', { waitUntil: 'networkidle', timeout: 30000 });
  }
  await page.waitForTimeout(2000);

  // 1. Capture Hero Section
  const heroSection = await page.$('section:has-text("Grow & Monetize")');
  if (heroSection) {
    await heroSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await heroSection.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_hero.png')
    });
    console.log('Captured template1_ftmo_hero.png');
  }

  // 2. Capture Why Choose Section (Now comes 2nd, before Matrix!)
  const whySection = await page.$('section:has-text("Why People Choose")');
  if (whySection) {
    await whySection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await whySection.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_why_choose_exact.png')
    });
    console.log('Captured template1_ftmo_why_choose_exact.png');
  }

  // 3. Capture Pricing Matrix Section directly
  const pricingSection = await page.$('#pricing');
  if (pricingSection) {
    await pricingSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await pricingSection.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_matrix_exact.png')
    });
    console.log('Captured template1_ftmo_matrix_exact.png');
  }

  // 4. Capture How It Works Section
  const howSection = await page.$('section:has-text("How It Works")');
  if (howSection) {
    await howSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await howSection.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_how_it_works_exact.png')
    });
    console.log('Captured template1_ftmo_how_it_works_exact.png');
  }

  // 5. Capture Bottom CTA Banner
  const ctaSection = await page.$('section:has-text("Start Your")');
  if (ctaSection) {
    await ctaSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await ctaSection.screenshot({
      path: path.join(artifactDir, 'template1_ftmo_cta_exact.png')
    });
    console.log('Captured template1_ftmo_cta_exact.png');
  }

  await browser.close();
  console.log('All FTMO screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
