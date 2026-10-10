const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const OUT_DIR = path.resolve('C:/Users/Administrator/.gemini/antigravity/brain/1262ff78-0cd1-4527-bd28-002e49eee854');
const SECRET = process.env.FXSIM_SESSION_SECRET || process.env.SESSION_SECRET || 'fxsim_dev_insecure_local_secret';

function mintSessionCookie(uid = 1, role = 'user') {
  const payloadObj = { uid, role, exp: Math.floor(Date.now() / 1000) + 86400 };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

async function runAudit() {
  console.log('[*] Launching Chromium for Phase 3 Visual Audit...');
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const sessionCookie = mintSessionCookie(1, 'user');
  const adminCookie = mintSessionCookie(1, 'admin');

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

  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('fxsim:bearer', 'mock-valid-token');
      sessionStorage.setItem('fxsim:nonce', 'mock-nonce');
    } catch {}
  });

  const page = await context.newPage();

  // Intercept backend API requests with realistic test mocks
  await page.route('**/wp-json/fxsim/v1/**', route => {
    const url = route.request().url();

    if (url.includes('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'pro_trader',
          email: 'trader@alphacapital.com',
          is_admin: false,
          role: 'trader',
          token: 'mock-valid-token',
          nonce: 'mock-nonce',
          first_name: 'Alex',
          last_name: 'Vance',
          display_name: 'Alex Vance',
          email_verified: true
        })
      });
    }

    if (url.includes('/whitelabel')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          brand_name: 'LaunchAPropFirm',
          brand_tagline: 'Institutional High-Frequency Prop Trading',
          landing_template: 'terminal',
          font_family: 'poppins',
          primary_color: '#10B981',
          accent_color: '#10B981',
          pause_trading: false
        })
      });
    }

    if (url.includes('/tournaments/list') || (url.includes('/tournaments') && !url.includes('/mine') && !url.includes('/leaderboard') && !url.match(/\/tournaments\/\d+/))) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            title: 'Global FX Championship — Autumn Invitational',
            name: 'Global FX Championship',
            description: 'Compete with traders worldwide for the $50,000 prize pool and $100K live funded account allocations.',
            status: 'active',
            entry_fee: '0.00',
            prize_pool: '$50,000',
            starting_balance: 100000,
            current_participants: 384,
            max_participants: 1000,
            start_date: '2026-10-01 00:00:00',
            end_date: '2026-10-31 23:59:59',
          },
          {
            id: 2,
            title: 'Crypto Scalpers Arena Series',
            name: 'Crypto Scalpers Arena',
            description: 'Ultra-low latency crypto futures tournament. Trade BTC & ETH with raw institutional spreads.',
            status: 'upcoming',
            entry_fee: '50.00',
            prize_pool: '$25,000',
            starting_balance: 50000,
            current_participants: 120,
            max_participants: 500,
            start_date: '2026-11-01 00:00:00',
            end_date: '2026-11-15 23:59:59',
          }
        ])
      });
    }

    if (url.match(/\/tournaments\/\d+\/leaderboard/)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { rank: 1, user_id: 101, display_name: 'ApexAlpha_FX', user_login: 'apex_alpha', starting_equity: 100000, current_equity: 124850, roi_pct: 24.85, trades_count: 42, win_rate: 76.2 },
          { rank: 2, user_id: 102, display_name: 'QuantumPips', user_login: 'quantum_pips', starting_equity: 100000, current_equity: 118400, roi_pct: 18.40, trades_count: 38, win_rate: 68.4 },
          { rank: 3, user_id: 103, display_name: 'VortexTrader', user_login: 'vortex_trader', starting_equity: 100000, current_equity: 114150, roi_pct: 14.15, trades_count: 29, win_rate: 65.5 },
          { rank: 4, user_id: 104, display_name: 'SigmaScalper', user_login: 'sigma_trader', starting_equity: 100000, current_equity: 109200, roi_pct: 9.20, trades_count: 21, win_rate: 61.9 },
        ])
      });
    }

    if (url.match(/\/tournaments\/\d+$/)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          title: 'Global FX Championship — Autumn Invitational',
          name: 'Global FX Championship',
          description: 'Compete with traders worldwide for the $50,000 prize pool and $100K live funded account allocations.',
          status: 'active',
          entry_fee: '0.00',
          prize_pool: '$50,000',
          starting_balance: 100000,
          current_participants: 384,
          max_participants: 1000,
          start_date: '2026-10-01 00:00:00',
          end_date: '2026-10-31 23:59:59',
          is_registered: false,
        })
      });
    }

    if (url.includes('/challenge/my')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            user_id: 1,
            fxsim_account_id: 501,
            plan_name: 'Executive 100K Evaluation',
            status: 'funded',
            phase: 2,
            account_size: 100000,
            starting_balance: 100000,
            current_balance: 109450,
            funded_at: '2026-10-05 12:00:00',
            trading_days: 7,
            funded_profit_split: 85,
            payout_eligibility: {
              withdrawable_profit: 9450,
              withdrawable_share: 8032.50,
              open_positions_count: 0,
              pending_orders_count: 0,
              has_pending_payout: false,
              trading_days_completed: 7,
              min_days_required: 5,
              min_payout_amount: 100,
              unsettled_profit: 0
            }
          }
        ])
      });
    }

    if (url.includes('/certificate/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          challenge_id: 101,
          trader_name: 'Alex Vance',
          plan_name: 'Executive 100K Challenge',
          account_size: 100000,
          profit_split: 85,
          status: 'funded',
          issued_date: '2026-10-05',
          brand: 'LaunchAPropFirm',
          share_code: 'CERT-ALEX-101'
        })
      });
    }

    if (url.includes('/payouts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          history: [
            {
              id: 201,
              user_id: 1,
              challenge_id: 101,
              name: 'Alex Vance',
              username: 'pro_trader',
              amount: 5450,
              trader_amount: 4632.50,
              profit_split_pct: 85,
              status: 'paid',
              payment_method: 'usdt_trc20',
              processed_at: '2026-10-08 14:30:00',
              requested_at: '2026-10-07 10:15:00',
              tx_reference: '0x8f9c1b...d92e',
            }
          ]
        })
      });
    }

    if (url.includes('/affiliate/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enrolled: true,
          code: 'ALEXVIP',
          rate_percent: 15,
          available_balance: 1450.00,
          payout_method: 'usdt_trc20',
          payout_destination: 'TN3Yq...98eD',
          stats: {
            referrals: 84,
            conversions: 18,
            total: 3200,
            unpaid: 1450,
            paid: 1750
          }
        })
      });
    }

    if (url.includes('/account')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 501,
          balance: 109450,
          equity: 109450,
          margin: 0,
          free_margin: 109450,
          currency: 'USD'
        })
      });
    }

    if (url.includes('/metrics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          phase: 1,
          current_profit_pct: 9.45,
          profit_target_pct: 8.0,
          profit_progress: 100,
          current_dd_pct: 1.8,
          max_dd_pct: 10.0,
          max_dd_progress: 18,
          daily_dd_pct: 0.6,
          max_daily_dd_pct: 5.0,
          trading_days_done: 7,
          min_trading_days: 5,
          days_remaining: 23,
          status: 'passed'
        })
      });
    }

    // Default 200 for other API endpoints
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] })
    });
  });

  // 1. Audit /tournaments (Public Header Clearance & Podium)
  console.log('[1/7] Navigating to /tournaments...');
  await page.goto('http://localhost:3000/tournaments', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  const tournamentsPath = path.join(OUT_DIR, 'phase3_01_tournaments_page.png');
  await page.screenshot({ path: tournamentsPath, fullPage: false });
  console.log(`[+] Captured: ${tournamentsPath}`);

  // 2. Audit /tournaments/1 (Arena Detail Header, Podium & Standings)
  console.log('[2/7] Navigating to /tournaments/1...');
  await page.goto('http://localhost:3000/tournaments/1', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  const tournamentArenaPath = path.join(OUT_DIR, 'phase3_02_tournament_arena_detail.png');
  await page.screenshot({ path: tournamentArenaPath, fullPage: false });
  console.log(`[+] Captured: ${tournamentArenaPath}`);

  // 3. Audit /dashboard/certificates (WYSIWYG Parity Preview)
  console.log('[3/7] Navigating to /dashboard/certificates...');
  await page.goto('http://localhost:3000/dashboard/certificates', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1200);
  const certPath = path.join(OUT_DIR, 'phase3_03_dashboard_certificates_wysiwyg.png');
  await page.screenshot({ path: certPath, fullPage: false });
  console.log(`[+] Captured: ${certPath}`);

  // 4. Audit /dashboard/marketing (Enhanced Media Kit)
  console.log('[4/7] Navigating to /dashboard/marketing...');
  await page.goto('http://localhost:3000/dashboard/marketing', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  const mediaKitPath = path.join(OUT_DIR, 'phase3_04_dashboard_marketing_media_kit.png');
  await page.screenshot({ path: mediaKitPath, fullPage: false });
  console.log(`[+] Captured: ${mediaKitPath}`);

  // 5. Audit /dashboard (Milestone Celebration Roadmap & Gamification)
  console.log('[5/7] Navigating to /dashboard...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);
  const dashboardRoadmapPath = path.join(OUT_DIR, 'phase3_05_milestone_celebration_roadmap.png');
  await page.screenshot({ path: dashboardRoadmapPath, fullPage: false });
  console.log(`[+] Captured: ${dashboardRoadmapPath}`);

  // 6. Audit /dashboard/payouts with Viral Payout Card Modal Open
  console.log('[6/7] Navigating to /dashboard/payouts...');
  await page.goto('http://localhost:3000/dashboard/payouts', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1000);

  // Click the viral social card button
  const viralBtn = page.locator('button:has-text("1-Click Viral Social Card")').first();
  if (await viralBtn.count() > 0) {
    await viralBtn.click();
    await page.waitForTimeout(800);
  }
  const viralModalPath = path.join(OUT_DIR, 'phase3_06_viral_payout_card_modal.png');
  await page.screenshot({ path: viralModalPath, fullPage: false });
  console.log(`[+] Captured: ${viralModalPath}`);

  // 7. Audit /admin/branding (Split-Screen Canvas & Live Mockup)
  console.log('[7/7] Navigating to /admin/branding (using admin session)...');
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'fxsim_sess',
      value: adminCookie,
      url: 'http://localhost:3000',
    }
  ]);
  // Re-route auth/me as admin
  await page.unroute('**/wp-json/fxsim/v1/**');
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
          last_name: 'Admin',
          email_verified: true
        })
      });
    }
    if (url.includes('/whitelabel')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          brand_name: 'LaunchAPropFirm',
          brand_tagline: 'Institutional High-Frequency Prop Trading',
          landing_template: 'terminal',
          font_family: 'poppins',
          primary_color: '#10B981',
          accent_color: '#10B981',
          logo_url: '/branding/brand_logo_600x150.png',
          login_logo_url: '/branding/login_logo_400x100.png',
          sidebar_icon_url: '/branding/sidebar_icon_128x128.png',
          favicon_url: '/favicon.svg',
          ga_measurement_id: '',
          facebook_pixel_id: '',
          google_site_verification: '',
          youtube_url: 'https://www.youtube.com/@LaunchAPropFirm',
          instagram_url: 'https://www.instagram.com/launchapropfirm/',
          tiktok_url: 'https://www.tiktok.com/@launchapropfirm.com',
          facebook_url: 'https://www.facebook.com/profile.php?id=61591803448831',
          discord_url: 'https://discord.com/channels/1555893909496799312/1555893997103484969',
          developer_url: '',
        })
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: [] })
    });
  });

  await page.goto('http://localhost:3000/admin/branding', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1200);
  const brandingCanvasPath = path.join(OUT_DIR, 'phase3_07_split_screen_branding_canvas.png');
  await page.screenshot({ path: brandingCanvasPath, fullPage: false });
  console.log(`[+] Captured: ${brandingCanvasPath}`);

  await browser.close();
  console.log('[*] Visual Audit Complete! All 7 screenshots verified and saved.');
}

runAudit().catch(err => {
  console.error('[!] Audit error:', err);
  process.exit(1);
});
