<?php defined('ABSPATH') || exit; ?>
<div class="fxsim-dash" id="fxsim-dashboard">
  <!-- Announcement banner (populated by JS if active) -->
  <div id="fxdb-announcement" style="display:none"></div>

  <!-- Onboarding modal (shown on first login) -->
  <div id="fxdb-onboarding-modal" class="fxdb-modal-overlay" style="display:none">
    <div class="fxdb-modal-box fxdb-onboarding-box">
      <div class="fxdb-onboarding-emoji">🚀</div>
      <h2>Welcome to Your Trader Dashboard!</h2>
      <p>Here's how to get started:</p>
      <ol class="fxdb-onboarding-steps">
        <li><strong>Browse Challenges</strong> — choose a plan that fits your goal</li>
        <li><strong>Pass Phase 1 & 2</strong> — hit profit targets, respect drawdown rules</li>
        <li><strong>Get Funded</strong> — receive a funded account and keep up to 85% profits</li>
      </ol>
      <button class="fxdb-btn-primary" onclick="fxDash.closeOnboarding()" style="width:100%;justify-content:center;margin-top:20px">
        Let's Go →
      </button>
    </div>
  </div>


  <!-- ── Top nav ─────────────────────────────────────────────────────────── -->
  <?php $active = 'dashboard'; include FXSIM_DIR . 'templates/nav.php'; ?>

  <div class="fxdb-body">

    <!-- ── Page header ──────────────────────────────────────────────────── -->
    <div class="fxdb-header">
      <div>
        <h1 class="fxdb-title">Trader Dashboard</h1>
        <p class="fxdb-subtitle">Welcome back, <strong><?= esc_html(wp_get_current_user()->display_name) ?></strong></p>
      </div>
      <div class="fxdb-header-actions">
        <a href="<?= home_url('/challenges/') ?>" class="fxdb-btn-primary">+ New Challenge</a>
        <a href="<?= home_url('/trading/') ?>" target="_blank" rel="noopener" class="fxdb-btn-ghost">Open Terminal ↗</a>
      </div>
    </div>

    <!-- ── Account summary cards ────────────────────────────────────────── -->
    <div class="fxdb-metrics-row" id="fxdb-metric-cards">
      <div class="fxdb-metric-card">
        <span class="fxdb-metric-label">Account Balance</span>
        <strong class="fxdb-metric-value" id="m-balance">—</strong>
        <span class="fxdb-metric-sub" id="m-balance-sub">Live account</span>
      </div>
      <div class="fxdb-metric-card">
        <span class="fxdb-metric-label">Floating P&L</span>
        <strong class="fxdb-metric-value" id="m-pnl">—</strong>
        <span class="fxdb-metric-sub" id="m-pnl-sub">Open positions</span>
      </div>
      <div class="fxdb-metric-card">
        <span class="fxdb-metric-label">Win Rate</span>
        <strong class="fxdb-metric-value" id="m-winrate">—</strong>
        <span class="fxdb-metric-sub" id="m-winrate-sub">Closed trades</span>
      </div>
      <div class="fxdb-metric-card">
        <span class="fxdb-metric-label">Active Challenges</span>
        <strong class="fxdb-metric-value" id="m-challenges">—</strong>
        <span class="fxdb-metric-sub" id="m-challenges-sub">In progress</span>
      </div>
    </div>

    <!-- ── Active challenge selector ────────────────────────────────────── -->
    <div class="fxdb-section" id="fxdb-challenge-section" style="display:none">
      <div class="fxdb-section-header">
        <h2 class="fxdb-section-title">Challenge Progress</h2>
        <select class="fxdb-select" id="fxdb-challenge-select"></select>
      </div>

      <!-- Challenge status banner -->
      <div class="fxdb-status-banner" id="fxdb-status-banner" style="display:none"></div>

      <!-- Phase + rules grid -->
      <div class="fxdb-rules-grid" id="fxdb-rules-grid">

        <!-- Profit Target -->
        <div class="fxdb-rule-card" id="rc-profit">
          <div class="fxdb-rule-header">
            <?= class_exists("FXSIM_Icons") ? FXSIM_Icons::get("target","18","fxdb-rule-icon") : "" ?>
            <div>
              <div class="fxdb-rule-name">Profit Target</div>
              <div class="fxdb-rule-vals"><span id="rc-profit-cur">—</span> / <span id="rc-profit-tgt">—</span></div>
            </div>
            <div class="fxdb-rule-badge" id="rc-profit-badge">—</div>
          </div>
          <div class="fxdb-progress-bar"><div class="fxdb-progress-fill green" id="rc-profit-bar" style="width:0%"></div></div>
          <div class="fxdb-rule-foot"><span id="rc-profit-pct">0%</span> of target reached</div>
        </div>

        <!-- Max Drawdown -->
        <div class="fxdb-rule-card" id="rc-maxdd">
          <div class="fxdb-rule-header">
            <?= class_exists("FXSIM_Icons") ? FXSIM_Icons::get("trending-up","18","fxdb-rule-icon") : "" ?>
            <div>
              <div class="fxdb-rule-name">Max Drawdown</div>
              <div class="fxdb-rule-vals">Used: <span id="rc-maxdd-cur">—</span> / Limit: <span id="rc-maxdd-tgt">—</span></div>
            </div>
            <div class="fxdb-rule-badge" id="rc-maxdd-badge">—</div>
          </div>
          <div class="fxdb-progress-bar"><div class="fxdb-progress-fill red" id="rc-maxdd-bar" style="width:0%"></div></div>
          <div class="fxdb-rule-foot">Remaining: <span id="rc-maxdd-rem">—</span></div>
        </div>

        <!-- Daily Drawdown -->
        <div class="fxdb-rule-card" id="rc-dailydd">
          <div class="fxdb-rule-header">
            <span class="fxdb-rule-icon">📆</span>
            <div>
              <div class="fxdb-rule-name">Daily Drawdown</div>
              <div class="fxdb-rule-vals">Today: <span id="rc-daily-cur">—</span> / Limit: <span id="rc-daily-tgt">—</span></div>
            </div>
            <div class="fxdb-rule-badge" id="rc-daily-badge">—</div>
          </div>
          <div class="fxdb-progress-bar"><div class="fxdb-progress-fill yellow" id="rc-daily-bar" style="width:0%"></div></div>
          <div class="fxdb-rule-foot">Resets at midnight UTC</div>
        </div>

        <!-- Trading Days -->
        <div class="fxdb-rule-card" id="rc-days">
          <div class="fxdb-rule-header">
            <?= class_exists("FXSIM_Icons") ? FXSIM_Icons::get("calendar","18","fxdb-rule-icon") : "" ?>
            <div>
              <div class="fxdb-rule-name">Trading Days</div>
              <div class="fxdb-rule-vals"><span id="rc-days-done">—</span> done / <span id="rc-days-min">—</span> required</div>
            </div>
            <div class="fxdb-rule-badge" id="rc-days-badge">—</div>
          </div>
          <div class="fxdb-progress-bar"><div class="fxdb-progress-fill cyan" id="rc-days-bar" style="width:0%"></div></div>
          <div class="fxdb-rule-foot"><span id="rc-days-left">—</span> days remaining in phase</div>
        </div>

      </div><!-- /.fxdb-rules-grid -->

      <!-- Equity curve chart + trade stats side by side -->
      <div class="fxdb-bottom-row">

        <div class="fxdb-card fxdb-chart-card">
          <div class="fxdb-card-title">Equity Curve</div>
          <div style="position:relative;height:220px;flex:1;min-height:200px">
            <canvas id="fxdb-equity-chart"></canvas>
          </div>
        </div>

        <div class="fxdb-card fxdb-stats-card">
          <div class="fxdb-card-title">Performance</div>
          <div class="fxdb-stat-list">
            <div class="fxdb-stat-row"><span>Total Trades</span><strong id="ps-total">—</strong></div>
            <div class="fxdb-stat-row"><span>Win Rate</span><strong id="ps-wr">—</strong></div>
            <div class="fxdb-stat-row"><span>Profit Factor</span><strong id="ps-pf">—</strong></div>
            <div class="fxdb-stat-row"><span>Net P&L</span><strong id="ps-pnl">—</strong></div>
            <div class="fxdb-stat-row"><span>Starting Balance</span><strong id="ps-start">—</strong></div>
            <div class="fxdb-stat-row"><span>Current Balance</span><strong id="ps-balance">—</strong></div>
            <div class="fxdb-stat-row"><span>Phase</span><strong id="ps-phase">—</strong></div>
            <div class="fxdb-stat-row"><span>Status</span><strong id="ps-status">—</strong></div>
          </div>
          <div class="fxdb-actions" id="fxdb-actions"></div>
        </div>

        <!-- ── MT5 Desktop Access (funded accounts only) ─────────────────── -->
        <div id="fxdb-mt5-box" class="fxdb-card fxdb-mt5-box" style="display:none">
          <div class="fxdb-card-title" style="display:flex;align-items:center;gap:10px">
            <span style="font-size:22px">🖥</span>
            <span>MT5 Desktop Access — Your Funded Account</span>
          </div>
          <p style="font-size:13px;color:var(--text-muted);margin:6px 0 16px">
            Your challenge phases are complete. Your funded account trades live on MetaTrader 5.
            The web terminal is no longer available for funded accounts.
          </p>
          <div id="fxdb-mt5-content">
            <div style="color:var(--text-muted);font-size:13px">Loading…</div>
          </div>
        </div>

      </div>
    </div><!-- /.fxdb-challenge-section -->

    <!-- ── No challenges state ───────────────────────────────────────────── -->
    <div class="fxdb-empty" id="fxdb-empty" style="display:none">
      <div class="fxdb-empty-icon">🚀</div>
      <h3>No Active Challenge</h3>
      <p>Purchase a challenge to start your funded trader journey.</p>
      <a href="<?= home_url('/challenges/') ?>" class="fxdb-btn-primary">Browse Challenges</a>
    </div>

    <!-- ── Recent trades ─────────────────────────────────────────────────── -->
    <div class="fxdb-card" style="margin-top:24px">
      <div class="fxdb-card-title">Recent Trades</div>
      <div class="fxdb-table-wrap">
        <table class="fxdb-table" id="fxdb-recent-trades">
          <thead><tr><th>Symbol</th><th>Type</th><th>Lots</th><th>Open</th><th>Close</th><th>P&L</th><th>Closed At</th></tr></thead>
          <tbody id="fxdb-trades-body"><tr class="fxdb-tr-empty"><td colspan="7">No trades yet.</td></tr></tbody>
        </table>
      </div>
    </div>

  </div><!-- /.fxdb-body -->

  <!-- 2FA Security Settings (loaded async at bottom of page) -->
  <div class="fxdb-body" style="padding-top:0">
    <div class="fxdb-card" style="max-width:480px">
      <div class="fxdb-card-title"><?= class_exists("FXSIM_Icons") ? FXSIM_Icons::get("shield","16") : "" ?> Security</div>
      <div class="fxdb-stat-list">
        <div class="fxdb-stat-row">
          <span><?= class_exists("FXSIM_Icons") ? FXSIM_Icons::get("key","14") : "" ?> Two-Factor Authentication</span>
          <div style="display:flex;align-items:center;gap:10px">
            <span id="fxdb-2fa-status" style="font-size:12px;color:var(--text-muted)">—</span>
            <button id="fxdb-2fa-btn" class="fxdb-btn-ghost" style="font-size:11px;padding:4px 10px"
                    onclick="fxDash.toggle2FA()">Loading…</button>
          </div>
        </div>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:10px">
        When enabled, a verification code is emailed at each login.
      </p>
    </div>
  </div>
</div>

<!-- Chart.js CDN -->
  <!-- dashboard.js loaded via wp_enqueue_script (with Chart.js dependency) -->
