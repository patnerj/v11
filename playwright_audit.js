const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ADMIN_SS_DIR = path.resolve('C:/Users/Administrator/Desktop/AlphaCapital_Enterprise_v11.3_GoldMaster/test_artifacts/screenshots_v11_5/admin');
const TRADER_SS_DIR = path.resolve('C:/Users/Administrator/Desktop/AlphaCapital_Enterprise_v11.3_GoldMaster/test_artifacts/screenshots_v11_5/trader');
const BASE_URL = 'https://demo.launchapropfirm.com';

if (!fs.existsSync(ADMIN_SS_DIR)) fs.mkdirSync(ADMIN_SS_DIR, { recursive: true });
if (!fs.existsSync(TRADER_SS_DIR)) fs.mkdirSync(TRADER_SS_DIR, { recursive: true });

const auditReport = {
  timestamp: new Date().toISOString(),
  baseUrl: BASE_URL,
  admin: {
    loginSuccess: false,
    finalLoginUrl: '',
    routes: [],
    errors: [],
    networkErrors: []
  },
  trader: {
    loginSuccess: false,
    finalLoginUrl: '',
    routes: [],
    errors: [],
    networkErrors: []
  }
};

function setupPageLogging(page, categoryLogs) {
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning') {
      console.log(`  [CONSOLE ${type.toUpperCase()}]: ${text}`);
      categoryLogs.errors.push({ type, text, url: page.url() });
    }
  });

  page.on('pageerror', err => {
    console.error(`  [PAGE CRASH/ERROR]: ${err.message}`);
    categoryLogs.errors.push({ type: 'pageerror', text: err.message, stack: err.stack, url: page.url() });
  });

  page.on('response', async res => {
    const status = res.status();
    const url = res.url();
    // Ignore static assets that are optional or analytics
    if (status >= 400) {
      const entry = {
        status,
        statusText: res.statusText(),
        method: res.request().method(),
        url,
        pageUrl: page.url()
      };
      console.log(`  [HTTP ${status}]: ${entry.method} ${url}`);
      categoryLogs.networkErrors.push(entry);
    }
  });
}

async function runAdminAudit(browser) {
  console.log('\n========================================');
  console.log('>>> STARTING ADMIN AUDIT <<<');
  console.log('========================================');

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 PlaywrightAdminAudit'
  });
  const page = await context.newPage();
  setupPageLogging(page, auditReport.admin);

  console.log('Navigating to Admin Login: ' + BASE_URL + '/login');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.screenshot({ path: path.join(ADMIN_SS_DIR, '00_admin_login_page.png'), fullPage: true });

  console.log('Filling Admin credentials (admin / AdminPropFirm2026!)...');
  await page.fill('#user', 'admin');
  await page.fill('#pwd', 'AdminPropFirm2026!');
  await page.screenshot({ path: path.join(ADMIN_SS_DIR, '00_admin_login_filled.png'), fullPage: true });

  console.log('Submitting login form...');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 25000 }).catch(e => console.log('Navigation wait info:', e.message))
  ]);

  await page.waitForTimeout(3000);
  const postLoginUrl = page.url();
  console.log('Post-login Admin URL:', postLoginUrl);
  auditReport.admin.finalLoginUrl = postLoginUrl;
  auditReport.admin.loginSuccess = postLoginUrl.includes('/admin') || !postLoginUrl.includes('/login');

  // List of Admin routes to traverse
  const adminRoutes = [
    { path: '/admin', filename: '01_admin_overview.png', name: 'Overview Stats & Charts' },
    { path: '/admin/traders', filename: '02_admin_traders.png', name: 'Traders Directory & Action Menus' },
    { path: '/admin/challenges', filename: '03_admin_challenges.png', name: 'Challenges Account Listings & Transitions' },
    { path: '/admin/payouts', filename: '04_admin_payouts.png', name: 'Escrow & Payout Approvals' },
    { path: '/admin/helpdesk', filename: '05_admin_helpdesk.png', name: 'Support Ticketing System' },
    { path: '/admin/risk', filename: '06_admin_risk.png', name: 'Risk Sentinel & Drawdown Monitors' },
    { path: '/admin/config', filename: '07_admin_config.png', name: 'Whitelabel & Platform Settings' },
    { path: '/admin/activity', filename: '08_admin_activity.png', name: 'Audit Log & Activity Trail' },
    { path: '/admin/setup', filename: '09_admin_setup.png', name: 'Initial Setup Wizard' },
    { path: '/admin/operations', filename: '10a_admin_operations_health.png', name: 'Operations System Health' },
    { path: '/admin/payments', filename: '11_admin_payments.png', name: 'Payment Gateways & Toggles' },
    { path: '/admin/kyc', filename: '12_admin_kyc.png', name: 'KYC Compliance Queue' },
    { path: '/admin/marketing', filename: '13_admin_marketing.png', name: 'Promotions & Coupons' },
    { path: '/admin/team', filename: '14_admin_team.png', name: 'Staff Role Assignments' },
    { path: '/admin/tournaments', filename: '15_admin_tournaments.png', name: 'Tournament Builder' },
    { path: '/admin/analytics', filename: '16_admin_analytics.png', name: 'Revenue & Cohort Analytics' },
    { path: '/admin/builder', filename: '17_admin_builder.png', name: 'Visual Page Builder' },
  ];

  for (const item of adminRoutes) {
    console.log(`\n--- [ADMIN ROUTE] Visiting ${item.path} (${item.name}) ---`);
    const routeStartTime = Date.now();
    try {
      const response = await page.goto(`${BASE_URL}${item.path}`, { waitUntil: 'networkidle', timeout: 35000 });
      await page.waitForTimeout(2500); // Allow react-query hydration and charts to render
      
      const status = response ? response.status() : 'client-nav';
      const finalUrl = page.url();
      const ssPath = path.join(ADMIN_SS_DIR, item.filename);
      await page.screenshot({ path: ssPath, fullPage: true });

      const routeResult = {
        name: item.name,
        targetPath: item.path,
        status,
        finalUrl,
        durationMs: Date.now() - routeStartTime,
        screenshot: ssPath,
        success: status < 400 && !finalUrl.includes('/404')
      };
      auditReport.admin.routes.push(routeResult);
      console.log(`  Result: Status ${status}, URL: ${finalUrl}, Duration: ${routeResult.durationMs}ms`);

      // Special interaction for /admin/operations
      if (item.path === '/admin/operations') {
        console.log('  Testing Operations Tabs & MT5 Gateway Bridge...');
        
        // Check tabs available on page
        const tabButtons = await page.$$('button');
        console.log(`  Found ${tabButtons.length} buttons on operations page.`);

        // 1. Tab: Price Feed
        try {
          const feedBtn = page.locator('button:has-text("Price Feed")');
          if (await feedBtn.count() > 0) {
            console.log('  Clicking "Price Feed" tab...');
            await feedBtn.first().click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(ADMIN_SS_DIR, '10b_admin_operations_feed.png'), fullPage: true });
          }
        } catch (e) {
          console.log('  Feed tab click notice:', e.message);
        }

        // 2. Tab: MT5 Gateway Bridge
        try {
          const mt5Btn = page.locator('button:has-text("MT5 Gateway Bridge")');
          if (await mt5Btn.count() > 0) {
            console.log('  Clicking "MT5 Gateway Bridge" tab...');
            await mt5Btn.first().click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(ADMIN_SS_DIR, '10c_admin_operations_mt5.png'), fullPage: true });

            // Test MT5 Gateway Ping
            const pingBtn = page.locator('button:has-text("Test MT5 Manager Connection")');
            if (await pingBtn.count() > 0) {
              console.log('  Clicking "Test MT5 Manager Connection" (Ping)...');
              await pingBtn.first().click();
              await page.waitForTimeout(3000);
              await page.screenshot({ path: path.join(ADMIN_SS_DIR, '10d_admin_operations_mt5_ping.png'), fullPage: true });
              console.log('  MT5 ping test completed and captured.');
            } else {
              console.log('  MT5 ping button not found');
            }

            // Test MT5 Gateway Save
            const saveBtn = page.locator('button:has-text("Save MT5 Gateway Settings")');
            if (await saveBtn.count() > 0) {
              console.log('  Clicking "Save MT5 Gateway Settings"...');
              await saveBtn.first().click();
              await page.waitForTimeout(3000);
              await page.screenshot({ path: path.join(ADMIN_SS_DIR, '10e_admin_operations_mt5_save.png'), fullPage: true });
              console.log('  MT5 save settings completed and captured.');
            } else {
              console.log('  MT5 save button not found');
            }
          }
        } catch (e) {
          console.log('  MT5 tab interaction error:', e.message);
        }

        // 3. Tab: Macro-Economic News Guard
        try {
          const newsBtn = page.locator('button:has-text("Macro-Economic News Guard")');
          if (await newsBtn.count() > 0) {
            console.log('  Clicking "Macro-Economic News Guard" tab...');
            await newsBtn.first().click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(ADMIN_SS_DIR, '10f_admin_operations_news.png'), fullPage: true });
          }
        } catch (e) {
          console.log('  News tab click notice:', e.message);
        }

        // 4. Tab: Challenge Lifecycle & Test Tools
        try {
          const chalBtn = page.locator('button:has-text("Challenge Lifecycle")');
          if (await chalBtn.count() > 0) {
            console.log('  Clicking "Challenge Lifecycle & Test Tools" tab...');
            await chalBtn.first().click();
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(ADMIN_SS_DIR, '10g_admin_operations_challenges_tab.png'), fullPage: true });
          }
        } catch (e) {
          console.log('  Challenges tab click notice:', e.message);
        }
      }

      // Special interaction for /admin/traders: Test search and modal
      if (item.path === '/admin/traders') {
        try {
          const searchInput = page.locator('input[placeholder*="Search"]');
          if (await searchInput.count() > 0) {
            console.log('  Testing search box on /admin/traders with "haris"...');
            await searchInput.first().fill('haris');
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(ADMIN_SS_DIR, '02b_admin_traders_search_haris.png'), fullPage: true });
          }
        } catch (e) {
          console.log('  Traders search interaction notice:', e.message);
        }
      }

    } catch (routeErr) {
      console.error(`  Error traversing ${item.path}:`, routeErr.message);
      auditReport.admin.routes.push({
        name: item.name,
        targetPath: item.path,
        error: routeErr.message,
        success: false
      });
    }
  }

  await context.close();
  console.log('Admin audit finished.');
}

async function runTraderAudit(browser) {
  console.log('\n========================================');
  console.log('>>> STARTING TRADER AUDIT (haris) <<<');
  console.log('========================================');

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 PlaywrightTraderAudit'
  });
  const page = await context.newPage();
  setupPageLogging(page, auditReport.trader);

  console.log('Navigating to Trader Login: ' + BASE_URL + '/login');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.screenshot({ path: path.join(TRADER_SS_DIR, '00_trader_login_page.png'), fullPage: true });

  console.log('Filling Trader credentials (haris / asdf1122)...');
  await page.fill('#user', 'haris');
  await page.fill('#pwd', 'asdf1122');
  await page.screenshot({ path: path.join(TRADER_SS_DIR, '00_trader_login_filled.png'), fullPage: true });

  console.log('Submitting login form...');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 25000 }).catch(e => console.log('Navigation wait info:', e.message))
  ]);

  await page.waitForTimeout(3000);
  const postLoginUrl = page.url();
  console.log('Post-login Trader URL:', postLoginUrl);
  auditReport.trader.finalLoginUrl = postLoginUrl;
  auditReport.trader.loginSuccess = postLoginUrl.includes('/dashboard') || !postLoginUrl.includes('/login');

  const traderRoutes = [
    { path: '/dashboard', filename: '01_trader_dashboard.png', name: 'Trader Home Dashboard' },
    { path: '/dashboard/trading', filename: '02_trader_trading.png', name: 'Institutional WebTrader Terminal', waitExtra: 5000 },
    { path: '/dashboard/payouts', filename: '03_trader_payouts.png', name: 'Trader Payouts & Wallet' },
    { path: '/dashboard/challenges', filename: '04_trader_challenges.png', name: 'Challenges Tracker' },
    { path: '/dashboard/analytics', filename: '05_trader_analytics.png', name: 'Trading Statistics & Analytics' },
    { path: '/dashboard/certificates', filename: '06_trader_certificates.png', name: 'Certificates Vault' },
    { path: '/arena', filename: '07_trader_arena.png', name: '1v1 PvP Trading Arena' },
    { path: '/dashboard/tournaments', filename: '08_trader_tournaments.png', name: 'Competitions & Tournaments' },
    { path: '/dashboard/support', filename: '09_trader_support.png', name: 'Helpdesk Ticket Submission' },
    { path: '/dashboard/settings', filename: '10_trader_settings.png', name: 'Profile, Security, Preferences' },
    { path: '/dashboard/history', filename: '11_trader_history.png', name: 'Trade Execution History' },
    { path: '/dashboard/kyc', filename: '12_trader_kyc.png', name: 'Trader KYC Submission' },
    { path: '/dashboard/notifications', filename: '13_trader_notifications.png', name: 'Notification Feed' },
    { path: '/dashboard/affiliate', filename: '14_trader_affiliate.png', name: 'Referral & Affiliate Commissions' },
    { path: '/challenges', filename: '15_trader_challenges_catalog.png', name: 'Public Challenge Catalog' },
  ];

  for (const item of traderRoutes) {
    console.log(`\n--- [TRADER ROUTE] Visiting ${item.path} (${item.name}) ---`);
    const routeStartTime = Date.now();
    try {
      const response = await page.goto(`${BASE_URL}${item.path}`, { waitUntil: 'networkidle', timeout: 35000 });
      await page.waitForTimeout(item.waitExtra || 2500); // Wait for terminal charts / react query hydration
      
      const status = response ? response.status() : 'client-nav';
      const finalUrl = page.url();
      const ssPath = path.join(TRADER_SS_DIR, item.filename);
      await page.screenshot({ path: ssPath, fullPage: true });

      const routeResult = {
        name: item.name,
        targetPath: item.path,
        status,
        finalUrl,
        durationMs: Date.now() - routeStartTime,
        screenshot: ssPath,
        success: status < 400 && !finalUrl.includes('/404')
      };
      auditReport.trader.routes.push(routeResult);
      console.log(`  Result: Status ${status}, URL: ${finalUrl}, Duration: ${routeResult.durationMs}ms`);

    } catch (routeErr) {
      console.error(`  Error traversing ${item.path}:`, routeErr.message);
      auditReport.trader.routes.push({
        name: item.name,
        targetPath: item.path,
        error: routeErr.message,
        success: false
      });
    }
  }

  await context.close();
  console.log('Trader audit finished.');
}

(async () => {
  console.log('Starting Master Headless Playwright Audit on ' + BASE_URL);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  try {
    await runAdminAudit(browser);
    await runTraderAudit(browser);
  } catch (err) {
    console.error('Fatal audit failure:', err);
  } finally {
    await browser.close();
  }

  const reportPath = path.resolve('C:/Users/Administrator/Desktop/AlphaCapital_Enterprise_v11.3_GoldMaster/test_artifacts/screenshots_v11_5/audit_summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(auditReport, null, 2), 'utf8');
  console.log('\n========================================');
  console.log('Audit completed! Full report saved to:', reportPath);
  console.log('========================================');
})();
