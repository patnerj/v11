const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function capture() {
  const outputDir = path.join(__dirname, '..', '..', 'test_artifacts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });

  // ── 1. DARK MODE TEST ─────────────────────────────────────────────────
  const darkContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });
  const pageDark = await darkContext.newPage();
  console.log('Navigating to http://localhost:3030/?template=neon (Dark Mode)...');
  await pageDark.goto('http://localhost:3030/?template=neon', { waitUntil: 'networkidle', timeout: 30000 });
  await pageDark.waitForTimeout(1500);

  // 1a. Hero
  await pageDark.screenshot({
    path: path.join(outputDir, 'template2_neon_hero_dark.png'),
    clip: { x: 0, y: 0, width: 1440, height: 950 }
  });
  console.log('Captured template2_neon_hero_dark.png');

  // 1b. Objectives Matrix
  const matrixSection = await pageDark.$('#challenge-models');
  if (matrixSection) {
    await matrixSection.scrollIntoViewIfNeeded();
    await pageDark.waitForTimeout(800);
    const box = await matrixSection.boundingBox();
    if (box) {
      await pageDark.screenshot({
        path: path.join(outputDir, 'template2_neon_matrix_dark.png'),
        clip: { x: 0, y: box.y, width: 1440, height: Math.min(box.height, 1100) }
      });
      console.log('Captured template2_neon_matrix_dark.png');
    }
  }

  // 1c. Switcher Menu Open
  const switcherBtn = await pageDark.$('button[aria-label="Switch Landing Page Template"]');
  if (switcherBtn) {
    await switcherBtn.scrollIntoViewIfNeeded();
    await switcherBtn.click();
    await pageDark.waitForTimeout(500);
    await pageDark.screenshot({
      path: path.join(outputDir, 'template2_neon_switcher_open.png'),
      clip: { x: 900, y: 400, width: 540, height: 500 }
    });
    console.log('Captured template2_neon_switcher_open.png');
  }

  // 1d. Footer Verification (Owner email removed & Instagram link verified)
  const footerElement = await pageDark.$('footer');
  if (footerElement) {
    await footerElement.scrollIntoViewIfNeeded();
    await pageDark.waitForTimeout(800);
    const footerBox = await footerElement.boundingBox();
    if (footerBox) {
      await pageDark.screenshot({
        path: path.join(outputDir, 'template2_neon_footer_links.png'),
        clip: { x: 0, y: footerBox.y, width: 1440, height: Math.min(footerBox.height, 650) }
      });
      console.log('Captured template2_neon_footer_links.png');
    }
  }

  // Check footer links directly
  const igLink = await pageDark.$eval('footer a[aria-label="Instagram Profile"]', el => el.getAttribute('href')).catch(() => null);
  const ytLink = await pageDark.$eval('footer a[aria-label="YouTube Channel"]', el => el.getAttribute('href')).catch(() => null);
  const tkLink = await pageDark.$eval('footer a[aria-label="TikTok Channel"]', el => el.getAttribute('href')).catch(() => null);
  const fbLink = await pageDark.$eval('footer a[aria-label="Facebook Page"]', el => el.getAttribute('href')).catch(() => null);
  const dcLink = await pageDark.$eval('footer a[aria-label="Discord Server"]', el => el.getAttribute('href')).catch(() => null);
  const footerText = await pageDark.$eval('footer', el => el.innerText).catch(() => '');

  console.log('Footer Audit:');
  console.log('  Instagram href:', igLink);
  console.log('  YouTube href:', ytLink);
  console.log('  TikTok href:', tkLink);
  console.log('  Facebook href:', fbLink);
  console.log('  Discord href:', dcLink);
  console.log('  Has vip@launchapropfirm.com?', footerText.includes('vip@launchapropfirm.com'));
  console.log('  Has support@launchapropfirm.com?', footerText.includes('support@launchapropfirm.com'));

  await darkContext.close();

  // ── 2. LIGHT MODE TEST ────────────────────────────────────────────────
  const lightContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const pageLight = await lightContext.newPage();
  await pageLight.goto('http://localhost:3030/?template=neon', { waitUntil: 'networkidle', timeout: 30000 });
  await pageLight.waitForTimeout(1000);
  
  // Click theme toggle button in header
  const themeToggle = await pageLight.$('button[aria-label="Toggle Day/Night Mode"]');
  if (themeToggle) {
    await themeToggle.click();
    await pageLight.waitForTimeout(1000);
  }

  // Hero in Light Mode
  await pageLight.screenshot({
    path: path.join(outputDir, 'template2_neon_hero_light.png'),
    clip: { x: 0, y: 0, width: 1440, height: 950 }
  });
  console.log('Captured template2_neon_hero_light.png');

  // Matrix in Light Mode
  const matrixLight = await pageLight.$('#challenge-models');
  if (matrixLight) {
    await matrixLight.scrollIntoViewIfNeeded();
    await pageLight.waitForTimeout(800);
    const boxLight = await matrixLight.boundingBox();
    if (boxLight) {
      await pageLight.screenshot({
        path: path.join(outputDir, 'template2_neon_matrix_light.png'),
        clip: { x: 0, y: boxLight.y, width: 1440, height: Math.min(boxLight.height, 1100) }
      });
      console.log('Captured template2_neon_matrix_light.png');
    }
  }

  await lightContext.close();
  await browser.close();
  console.log('ALL SCREENSHOTS CAPTURED SUCCESSFULLY!');
}

capture().catch(err => {
  console.error('Capture error:', err);
  process.exit(1);
});
