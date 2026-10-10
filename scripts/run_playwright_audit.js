const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const OUT_DIR = path.resolve('C:/Users/Administrator/.gemini/antigravity/brain/1262ff78-0cd1-4527-bd28-002e49eee854');
const SECRET = 'e7b92f4c8a1d5e3b6a9f0c2e4d8b1a7f6c3e9a2d5b8e1f4a7c0d3e6b9a2c5f8';

function mintSessionCookie(uid = 1, role = 'admin') {
  const payloadObj = { uid, role, exp: Math.floor(Date.now() / 1000) + 86400 };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function runVisualAudit() {
  console.log('[*] Starting Full End-to-End Playwright Visual Audit (Targeting ONLY wp-json)...');
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const sessionCookie = mintSessionCookie(1, 'admin');

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    {
      name: 'fxsim_sess',
      value: sessionCookie,
      url: 'http://localhost:3000',
    }
  ]);

  const page = await context.newPage();

  // ONLY intercept WP-JSON API requests!
  await page.route('**/wp-json/fxsim/v1/**', route => {
    const url = route.request().url();
    if (url.includes('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          email: 'admin@alphacapital.com',
          is_admin: true,
          role: 'administrator',
          token: 'mock-valid-token',
          nonce: 'mock-nonce',
          first_name: 'Alpha',
          last_name: 'Admin'
        })
      });
    }
    if (url.includes('/whitelabel')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          brand_name: 'LaunchAPropFirm',
          landing_template: 'terminal',
          font_family: 'poppins',
          primary_color: '#10B981',
          pause_trading: false
        })
      });
    }
    if (url.includes('/admin/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_users: 1250,
          active_traders: 842,
          active_challenges: 620,
          funded_capital: 14500000,
          open_positions: 38,
          total_trades: 49200,
          realised_pnl: 184500.50,
          pending_payouts_count: 1,
          pending_payouts_amount: 5450.00
        })
      });
    }
    if (url.includes('/admin/test-tools/challenges')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    }
    if (url.includes('/admin/challenges')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          challenges: [
            {
              id: 1042,
              user_id: 88,
              plan_name: '$100K Two-Step Evaluation',
              account_size: 100000,
              current_balance: 106450.00,
              equity: 107120.00,
              equity_hwm: 107120.00,
              trailing_dd_floor: 92000.00,
              phase: 1,
              status: 'active',
              trades_count: 14
            },
            {
              id: 1043,
              user_id: 112,
              plan_name: '$200K Pro Funded',
              account_size: 200000,
              current_balance: 208900.00,
              equity: 209500.00,
              equity_hwm: 211000.00,
              trailing_dd_floor: 190000.00,
              phase: 2,
              status: 'active',
              trades_count: 28
            }
          ]
        })
      });
    }
    if (url.includes('/admin/payouts') || url.includes('/payouts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          payouts: [
            {
              id: 'PO-88219',
              trader_name: 'Hamza Khan',
              trader_email: 'hamza@trading.com',
              user_id: 88,
              account_id: 1042,
              amount: 5450.00,
              trader_amount: 4360.00,
              amount_requested: 5450.00,
              firm_amount: 1090.00,
              profit_split: 80,
              payment_method: 'USDT TRC20',
              payment_address: 'TJY4Kq8p9M1sZ7V3XwA6cB2mD9eF5gH8jK',
              status: 'pending',
              open_positions_count: 0,
              pending_orders_count: 0,
              breaches_count: 0,
              min_trading_days: 5,
              trading_days_count: 8,
              kyc_status: 'verified',
              created_at: '2026-10-10 11:30:00'
            }
          ]
        })
      });
    }
    if (url.includes('/accounts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accounts: [
            {
              id: 1042,
              account_number: 'MT5-992144',
              balance: 106450.00,
              equity: 107120.00,
              margin: 1250.00,
              free_margin: 105870.00,
              margin_level: 8569.6,
              leverage: 100,
              currency: 'USD',
              status: 'active',
              floating_pnl: 670.00
            }
          ]
        })
      });
    }
    if (url.includes('/prices')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          EURUSD: { bid: 1.08452, ask: 1.08462, spread: 1.0 },
          GBPUSD: { bid: 1.29840, ask: 1.29852, spread: 1.2 },
          XAUUSD: { bid: 2654.80, ask: 2655.15, spread: 35.0 },
          BTCUSD: { bid: 64280.0, ask: 64288.5, spread: 8.5 }
        })
      });
    }
    route.continue();
  });

  // 1. Landing Page Terminal Template
  console.log('[1] Auditing Landing Page http://localhost:3000/?template=terminal ...');
  await page.goto('http://localhost:3000/?template=terminal', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);
  const shot1 = path.join(OUT_DIR, '01_landing_terminal_numbers_poppins.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log('[✓] Screenshot 1 saved:', shot1);

  // 2. Admin Dashboard with Executive Infrastructure Strip
  console.log('[2] Auditing /admin (Infrastructure Strip)...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  const shot4 = path.join(OUT_DIR, '04_admin_dashboard_infrastructure_strip.png');
  await page.screenshot({ path: shot4, fullPage: false });
  console.log('[✓] Screenshot 4 saved:', shot4);

  // 3. Admin Challenges Table & Slide-Over Drawer
  console.log('[3] Auditing /admin/challenges & Slide Drawer...');
  await page.goto('http://localhost:3000/admin/challenges', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  const inspectBtn = await page.$('button:has-text("Inspect")');
  if (inspectBtn) {
    await inspectBtn.click();
    await page.waitForTimeout(1500);
  }
  const shot5 = path.join(OUT_DIR, '05_admin_challenges_slide_drawer.png');
  await page.screenshot({ path: shot5, fullPage: false });
  console.log('[✓] Screenshot 5 saved:', shot5);

  // 4. Admin Payouts & Crypto QR Modal & Reconciliation Card
  console.log('[4] Auditing /admin/payouts with Reconciliation & QR Modal...');
  await page.goto('http://localhost:3000/admin/payouts', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  const qrBtn = await page.$('button[title*="QR"], button:has-text("QR")');
  if (qrBtn) {
    console.log('[*] Clicking QR button...');
    await qrBtn.click();
    await page.waitForTimeout(1500);
  } else {
    console.warn('[!] QR button not found!');
  }
  const shot6 = path.join(OUT_DIR, '06_admin_payouts_qr_modal.png');
  await page.screenshot({ path: shot6, fullPage: false });
  console.log('[✓] Screenshot 6 saved:', shot6);

  // 5. Admin Payout Review Modal (Reconciliation Card)
  console.log('[5] Opening Payout Review Modal for Reconciliation Card...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  const reviewBtn = await page.$('button:has-text("Manage Payout")');
  if (reviewBtn) {
    console.log('[*] Clicking Manage Payout button...');
    await reviewBtn.click();
    await page.waitForTimeout(1500);
    const shot7 = path.join(OUT_DIR, '07_admin_payout_reconciliation_modal.png');
    await page.screenshot({ path: shot7, fullPage: false });
    console.log('[✓] Screenshot 7 saved:', shot7);
  } else {
    console.warn('[!] Manage Payout button not found!');
  }

  await browser.close();
  console.log('[SUCCESS] All full-fidelity visual audit screenshots captured successfully!');
}

runVisualAudit().catch(err => {
  console.error('[ERROR] Visual audit failed:', err);
  process.exit(1);
});
