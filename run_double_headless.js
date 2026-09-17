const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://demo.launchapropfirm.com';
const ARTIFACT_DIR = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f404737c-4311-4194-ab4d-bf54c164b59b';
const WORKSPACE_DIR = 'C:\\Users\\Administrator\\Desktop\\AlphaCapital_v11.5_LiveWorkspace\\test_artifacts\\screenshots_v11_5';

fs.mkdirSync(path.join(WORKSPACE_DIR, 'admin'), { recursive: true });
fs.mkdirSync(path.join(WORKSPACE_DIR, 'trader'), { recursive: true });

async function run() {
  console.log('===========================================================');
  console.log('STARTING DOUBLE HEADLESS BROWSER VERIFICATION (v11.5)');
  console.log('===========================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const errors = [];
  const results = {
    admin: { login: false, operations_hub: false, redis_tab: false, screenshots: [] },
    trader: { login: false, dashboard: false, webtrader: false, screenshots: [] }
  };

  // ─────────────────────────────────────────────────────────────────
  // 1. ADMIN HEADLESS CONTEXT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n[1/2] Launching Admin Headless Session...');
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Playwright/AdminAudit'
  });
  const adminPage = await adminContext.newPage();

  adminPage.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[Admin Console Error]: ${msg.text()}`);
    }
  });

  try {
    console.log('  -> Navigating to login page...');
    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('  -> Submitting admin credentials (admin / AdminPropFirm2026!)...');
    const userInput = adminPage.locator('input[type="text"], input[name="username"], input[name="login"], input[id*="user"]');
    const passInput = adminPage.locator('input[type="password"]');

    await userInput.first().fill('admin');
    await passInput.first().fill('AdminPropFirm2026!');

    const submitBtn = adminPage.locator('button[type="submit"]');
    await submitBtn.first().click();

    await adminPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await adminPage.waitForTimeout(3000);

    const currentUrl = adminPage.url();
    console.log(`  -> Current Admin URL: ${currentUrl}`);
    results.admin.login = currentUrl.includes('/admin') || currentUrl.includes('/dashboard');

    // Admin Overview Screenshot
    const adminOverviewPath = path.join(ARTIFACT_DIR, 'admin_overview.png');
    await adminPage.screenshot({ path: adminOverviewPath, fullPage: true });
    fs.copyFileSync(adminOverviewPath, path.join(WORKSPACE_DIR, 'admin', '01_admin_overview.png'));
    results.admin.screenshots.push('admin_overview.png');
    console.log('  -> Captured Admin Overview screenshot.');

    // Navigate to Operations Hub
    console.log('  -> Navigating to Operations Hub (/admin/operations?tab=redis)...');
    await adminPage.goto(`${BASE_URL}/admin/operations?tab=redis`, { waitUntil: 'networkidle', timeout: 30000 });
    await adminPage.waitForTimeout(4000);

    // Click Redis tab if not already active
    const redisTabBtn = adminPage.locator('button:has-text("Redis In-Memory Engine")');
    if (await redisTabBtn.count() > 0) {
      await redisTabBtn.first().click();
      await adminPage.waitForTimeout(2000);
      results.admin.redis_tab = true;
      console.log('  -> Clicked "Redis In-Memory Engine" tab button.');
    }

    // Check for In-Memory Redis Caching Card
    const redisCard = adminPage.locator('text=In-Memory Redis Caching Engine');
    const hasCard = (await redisCard.count()) > 0;
    console.log(`  -> Redis Caching Engine Card visible: ${hasCard}`);
    results.admin.operations_hub = hasCard;

    // Trigger Test Connection button if available
    const testConnBtn = adminPage.locator('button:has-text("Test Connection")');
    if (await testConnBtn.count() > 0) {
      console.log('  -> Triggering "Test Connection" button...');
      await testConnBtn.first().click();
      await adminPage.waitForTimeout(3000);
    }

    // Capture Redis Operations Screenshot
    const adminRedisPath = path.join(ARTIFACT_DIR, 'admin_redis_operations.png');
    await adminPage.screenshot({ path: adminRedisPath, fullPage: true });
    fs.copyFileSync(adminRedisPath, path.join(WORKSPACE_DIR, 'admin', '02_admin_redis_operations.png'));
    results.admin.screenshots.push('admin_redis_operations.png');
    console.log('  -> Captured Admin Redis Operations screenshot.');

  } catch (err) {
    console.error(`  [Admin Error]: ${err.message}`);
    errors.push(`[Admin Flow Exception]: ${err.message}`);
  } finally {
    await adminContext.close();
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. TRADER HEADLESS CONTEXT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n[2/2] Launching Trader Headless Session...');
  const traderContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Playwright/TraderAudit'
  });
  const traderPage = await traderContext.newPage();

  traderPage.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[Trader Console Error]: ${msg.text()}`);
    }
  });

  try {
    console.log('  -> Navigating to login page...');
    await traderPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });

    console.log('  -> Submitting trader credentials (haris / asdf1122)...');
    const userInput = traderPage.locator('input[type="text"], input[name="username"], input[name="login"], input[id*="user"]');
    const passInput = traderPage.locator('input[type="password"]');

    await userInput.first().fill('haris');
    await passInput.first().fill('asdf1122');

    const submitBtn = traderPage.locator('button[type="submit"]');
    await submitBtn.first().click();

    await traderPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await traderPage.waitForTimeout(3000);

    const traderUrl = traderPage.url();
    console.log(`  -> Current Trader URL: ${traderUrl}`);
    results.trader.login = traderUrl.includes('/dashboard');

    // Trader Dashboard Screenshot
    const traderDashboardPath = path.join(ARTIFACT_DIR, 'trader_dashboard.png');
    await traderPage.screenshot({ path: traderDashboardPath, fullPage: true });
    fs.copyFileSync(traderDashboardPath, path.join(WORKSPACE_DIR, 'trader', '01_trader_dashboard.png'));
    results.trader.screenshots.push('trader_dashboard.png');
    console.log('  -> Captured Trader Dashboard screenshot.');

    // Navigate to WebTrader Trading Terminal
    console.log('  -> Navigating to WebTrader Trading Terminal (/dashboard/trading)...');
    await traderPage.goto(`${BASE_URL}/dashboard/trading`, { waitUntil: 'networkidle', timeout: 30000 });
    await traderPage.waitForTimeout(5000);

    // Check for Terminal elements (order ticket, chart, price quotes)
    const orderTicket = traderPage.locator('text=Buy').or(traderPage.locator('text=Sell')).or(traderPage.locator('text=Market Order'));
    const hasTicket = (await orderTicket.count()) > 0;
    console.log(`  -> WebTrader Order Ticket rendered: ${hasTicket}`);
    results.trader.webtrader = hasTicket;

    // WebTrader Terminal Screenshot
    const traderTerminalPath = path.join(ARTIFACT_DIR, 'trader_webtrader_terminal.png');
    await traderPage.screenshot({ path: traderTerminalPath, fullPage: true });
    fs.copyFileSync(traderTerminalPath, path.join(WORKSPACE_DIR, 'trader', '02_trader_webtrader.png'));
    results.trader.screenshots.push('trader_webtrader_terminal.png');
    console.log('  -> Captured WebTrader Terminal screenshot.');

  } catch (err) {
    console.error(`  [Trader Error]: ${err.message}`);
    errors.push(`[Trader Flow Exception]: ${err.message}`);
  } finally {
    await traderContext.close();
  }

  await browser.close();

  console.log('\n===========================================================');
  console.log('DOUBLE HEADLESS VERIFICATION SUMMARY');
  console.log('===========================================================');
  console.log(JSON.stringify(results, null, 2));
  console.log(`Total Errors Logged: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Errors:\n' + errors.slice(0, 5).join('\n'));
  }
  console.log('===========================================================');
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
