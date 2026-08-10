<?php defined('ABSPATH') || exit; ?>
<div id="fxsim-terminal">

  <!-- ── Sidebar: Watchlist ──────────────────────────────────────────────── -->
  <aside id="fxsim-watchlist">
    <div class="fx-sidebar-header">
      <span class="fx-logo"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('zap','16') : '' ?> <?= esc_html(class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name','PropFirm System') : 'PropFirm System') ?></span>
      <span class="fx-user-info" id="fx-user-display"></span>
      <nav class="fx-sidebar-nav">
        <a href="<?= home_url('/dashboard/') ?>"   class="fx-snav-link"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('dashboard','14') : '' ?> Dashboard</a>
        <a href="<?= home_url('/challenges/') ?>"  class="fx-snav-link"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('challenges','14') : '' ?> Challenges</a>
        <a href="<?= home_url('/trading/') ?>"     class="fx-snav-link fx-snav-active"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('activity','14') : '' ?> Terminal</a>
        <a href="<?= home_url('/statistics/') ?>"  class="fx-snav-link"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('statistics','14') : '' ?> Statistics</a>
        <a href="<?= home_url('/leaderboard/') ?>" class="fx-snav-link"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('leaderboard','14') : '' ?> Leaderboard</a>
        <a href="<?= wp_logout_url(home_url('/login/')) ?>" class="fx-snav-link fx-snav-logout"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('logout','14') : '' ?> Logout</a>
      </nav>
    </div>
    <div class="fx-search-wrap">
      <input type="text" id="fx-symbol-search" placeholder="Search symbol…">
    </div>
    <div id="fx-watchlist-list"></div>
  </aside>

  <!-- ── Main Area ──────────────────────────────────────────────────────── -->
  <main id="fxsim-main">

    <!-- Chart + Order Panel Row -->
    <div id="fx-top-row">

      <!-- TradingView Chart -->
      <div id="fx-chart-wrap">
        <div class="fx-chart-toolbar">
          <span id="fx-active-symbol-label">EURUSD</span>
          <span id="fx-active-price-display">—</span>
          <div class="fx-tf-btns">
            <?php foreach(['1','5','15','60','240','D','W'] as $tf): ?>
              <button class="fx-tf-btn <?= $tf==='60'?'active':'' ?>" data-tf="<?= $tf ?>"><?= $tf==='D'?'1D':($tf==='W'?'1W':"${tf}m") ?></button>
            <?php endforeach; ?>
          </div>
        </div>
        <div id="fx-tradingview-chart"></div>
        <!-- Chart Order Lines Overlay -->
        <div id="fx-chart-orders" style="display:none">
          <div class="fx-co-title">Open Positions on <?php echo '' ?><span id="fx-co-symbol">—</span></div>
          <div id="fx-co-list"></div>
        </div>
      </div>

      <!-- Order Panel -->
      <div id="fx-order-panel">
        <h3 class="fx-panel-title">New Order</h3>

        <!-- ── Phase 2: Market / Pending mode toggle ────────────────────── -->
        <div class="fx-mode-toggle" id="fx-mode-toggle">
          <button class="fx-mode-btn active" id="fx-mode-market"
                  onclick="fxTerminal.setOrderMode('market')">Market</button>
          <button class="fx-mode-btn" id="fx-mode-pending"
                  onclick="fxTerminal.setOrderMode('pending')">Pending</button>
        </div>

        <div class="fx-field-group">
          <label>Symbol</label>
          <div class="fx-selected-symbol" id="fx-order-symbol">EURUSD</div>
        </div>

        <div class="fx-price-row">
          <div class="fx-price-box fx-sell-price">
            <label>BID (SELL)</label>
            <span id="fx-bid-price">—</span>
          </div>
          <div class="fx-spread-badge" id="fx-spread-display">—</div>
          <div class="fx-price-box fx-buy-price">
            <label>ASK (BUY)</label>
            <span id="fx-ask-price">—</span>
          </div>
        </div>

        <div class="fx-field-group">
          <label>Lot Size</label>
          <div class="fx-lot-row">
            <button class="fx-lot-btn" onclick="fxTerminal.adjustLot(-0.01)">−</button>
            <input type="number" id="fx-lot-input" value="0.10" min="0.01" max="50" step="0.01">
            <button class="fx-lot-btn" onclick="fxTerminal.adjustLot(0.01)">+</button>
          </div>
        </div>

        <div class="fx-field-group">
          <label>Stop Loss (absolute price)</label>
          <input type="number" id="fx-sl-input" placeholder="0.00000" step="0.00001">
        </div>

        <div class="fx-field-group">
          <label>Take Profit (absolute price)</label>
          <input type="number" id="fx-tp-input" placeholder="0.00000" step="0.00001">
        </div>

        <!-- ── Phase 3: Pending-only fields (hidden in market mode) ─────── -->
        <div class="fx-pending-fields" id="fx-pending-fields" style="display:none">

          <div class="fx-field-group">
            <label>Order Type</label>
            <select id="fx-pending-type" class="fx-select">
              <option value="buy_limit">Buy Limit  — buy below market</option>
              <option value="sell_limit">Sell Limit — sell above market</option>
              <option value="buy_stop">Buy Stop   — buy above market</option>
              <option value="sell_stop">Sell Stop  — sell below market</option>
            </select>
          </div>

          <div class="fx-field-group">
            <label>Target Price</label>
            <input type="number" id="fx-pending-price" placeholder="0.00000" step="0.00001">
          </div>

          <div class="fx-field-group">
            <label>Expiry <span class="fx-label-hint">(optional — leave blank for GTC)</span></label>
            <input type="datetime-local" id="fx-pending-expiry" class="fx-datetime-input">
          </div>

        </div>

        <div class="fx-order-preview" id="fx-order-preview">
          <div><span>Margin Required</span><strong id="prev-margin">—</strong></div>
          <div><span>Commission</span><strong id="prev-commission">—</strong></div>
        </div>

        <div class="fx-order-btns" id="fx-market-btns">
          <button class="fx-btn-sell" id="fx-btn-sell" onclick="fxTerminal.placeOrder('sell')">
            ▼ SELL<br><small id="fx-sell-label">—</small>
          </button>
          <button class="fx-btn-buy"  id="fx-btn-buy"  onclick="fxTerminal.placeOrder('buy')">
            ▲ BUY<br><small id="fx-buy-label">—</small>
          </button>
        </div>

        <!-- Pending mode: single submit button (hidden in market mode) -->
        <div id="fx-pending-btns" style="display:none">
          <button class="fx-btn-pending-submit" id="fx-btn-pending-submit"
                  onclick="fxTerminal.placePendingOrder()">
            ⏳ Place Pending Order
          </button>
        </div>

        <div id="fx-order-msg" class="fx-order-msg" style="display:none"></div>

        <!-- Account Summary -->
        <div class="fx-account-summary" id="fx-account-summary">
          <div class="fx-acc-row"><span>Balance</span><strong id="acc-balance">—</strong></div>
          <div class="fx-acc-row"><span>Equity</span><strong id="acc-equity">—</strong></div>
          <div class="fx-acc-row"><span>Margin Used</span><strong id="acc-margin">—</strong></div>
          <div class="fx-acc-row"><span>Free Margin</span><strong id="acc-free">—</strong></div>
          <div class="fx-acc-row"><span>Margin Level</span><strong id="acc-level">—</strong></div>
        </div>

        <!-- Risk Calculator -->
        <div class="fx-risk-calc">
          <div class="fx-panel-title" style="margin-bottom:8px">⚖️ Risk Calculator</div>
          <div class="fx-field-group">
            <label>Risk % of Balance</label>
            <div class="fx-lot-row">
              <input type="number" id="fx-risk-pct" value="1" min="0.1" max="10" step="0.1" oninput="fxTerminal.calcRisk()">
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:6px">
            <span style="color:var(--text-muted)">Risk Amount: <strong id="fx-risk-amount-display" style="color:var(--red)">—</strong></span>
            <span style="color:var(--text-muted)">Rec. Lots: <strong id="fx-rec-lot-display" style="color:var(--accent)">Set SL first</strong></span>
          </div>
        </div>
      </div><!-- /#fx-order-panel -->
    </div>

    <!-- ── Bottom Tabs ──────────────────────────────────────────────────── -->
    <div id="fx-bottom-panel">
      <div class="fx-tabs">
        <button class="fx-tab active" data-tab="positions">Positions <span id="fx-pos-count" class="fx-badge">0</span></button>
        <button class="fx-tab" data-tab="pending">Pending <span id="fx-pending-count" class="fx-badge">0</span></button>
        <button class="fx-tab" data-tab="history">History</button>
        <button class="fx-tab" data-tab="transactions">Transactions</button>
        <button class="fx-tab" data-tab="stats">Performance</button>
        <div class="fx-tab-actions">
          <button class="fx-refresh-btn" id="fx-refresh-btn" onclick="fxTerminal.refreshPositions()" title="Manual refresh">↻ Refresh</button>
        </div>
      </div>

      <!-- Positions Tab -->
      <div class="fx-tab-content active" id="tab-positions">
        <table class="fx-table" id="fx-positions-table">
          <thead><tr>
            <th>#</th><th>Symbol</th><th>Type</th><th>Lots</th>
            <th>Open Price</th><th>Current</th><th>SL</th><th>TP</th>
            <th>PnL</th><th>Margin</th><th>Actions</th>
          </tr></thead>
          <tbody id="fx-positions-body"><tr class="fx-empty"><td colspan="11">No open positions.</td></tr></tbody>
        </table>
      </div>

      <!-- Pending Orders Tab -->
      <div class="fx-tab-content" id="tab-pending">
        <table class="fx-table" id="fx-pending-table">
          <thead><tr>
            <th>#</th>
            <th>Symbol</th>
            <th>Type</th>
            <th>Lots</th>
            <th>Target Price</th>
            <th>SL</th>
            <th>TP</th>
            <th>Margin Held</th>
            <th>Expires</th>
            <th>Placed</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="fx-pending-body">
            <tr class="fx-empty"><td colspan="11">No pending orders.</td></tr>
          </tbody>
        </table>
      </div>

      <!-- History Tab -->
      <div class="fx-tab-content" id="tab-history">
        <table class="fx-table">
          <thead><tr><th>#</th><th>Symbol</th><th>Type</th><th>Lots</th><th>Open</th><th>Close</th><th>PnL</th><th>Reason</th><th>Closed At</th></tr></thead>
          <tbody id="fx-history-body"><tr class="fx-empty"><td colspan="9">No trade history.</td></tr></tbody>
        </table>
      </div>

      <!-- Transactions Tab -->
      <div class="fx-tab-content" id="tab-transactions">
        <table class="fx-table">
          <thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Note</th><th>Time</th></tr></thead>
          <tbody id="fx-tx-body"><tr class="fx-empty"><td colspan="6">No transactions.</td></tr></tbody>
        </table>
      </div>

      <!-- Performance Tab -->
      <div class="fx-tab-content" id="tab-stats">
        <div class="fx-stats-grid" id="fx-stats-grid">
          <div class="fx-stat-tile"><span>Total Trades</span><strong id="st-total">—</strong></div>
          <div class="fx-stat-tile"><span>Wins</span><strong id="st-wins" style="color:#10b981">—</strong></div>
          <div class="fx-stat-tile"><span>Losses</span><strong id="st-losses" style="color:#ef4444">—</strong></div>
          <div class="fx-stat-tile"><span>Win Rate</span><strong id="st-wr">—</strong></div>
          <div class="fx-stat-tile"><span>Profit Factor</span><strong id="st-pf">—</strong></div>
          <div class="fx-stat-tile"><span>Net PnL</span><strong id="st-pnl">—</strong></div>
          <div class="fx-stat-tile"><span>Gross Profit</span><strong id="st-gp" style="color:#10b981">—</strong></div>
          <div class="fx-stat-tile"><span>Gross Loss</span><strong id="st-gl" style="color:#ef4444">—</strong></div>
        </div>
      </div>
    </div>

  </main>

  <!-- Loading overlay -->
  <div id="fx-loading-overlay"><div class="fx-spinner"></div><p>Initializing PropFirm System…</p></div>

  <!-- Mobile watchlist toggle -->
  <button class="fx-mobile-watchlist-toggle" onclick="fxTerminal.toggleMobileWatchlist()" title="Toggle watchlist">☰</button>
</div>
