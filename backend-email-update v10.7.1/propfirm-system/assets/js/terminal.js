/* ── PropFirm System — Terminal JS ──────────────────────────────────────────── */
/* globals FXSIM */

// Apply saved theme immediately to prevent flash
(function(){ document.documentElement.dataset.theme = localStorage.getItem('fxsim_theme') || 'dark'; })();

const fxTerminal = (() => {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  let state = {
    symbols:        [],
    prices:         {},
    positions:      [],
    account:        null,
    activeSymbol:   'EURUSD',
    orderMode:      'market',   // 'market' | 'pending' — default is market
    chart:          null,
    chartWidget:    null,
    priceInterval:  null,
    posInterval:    null,
    sseSource:      null,       // EventSource instance when SSE is active
    sseActive:      false,      // true while SSE connection is established
    editingInputs:  new Set(),  // track focused sltp inputs
    lastPrices:     {},
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    if (!FXSIM.user.loggedIn) { location.href = '/login/'; return; }

    await Promise.all([loadSymbols(), loadAccount()]);
    await loadPrices();
    // Restore last visited symbol from localStorage
    const lastSym = loadLastSymbol();
    if (state.symbols.find(s => s.symbol === lastSym)) state.activeSymbol = lastSym;
    renderWatchlist();
    const savedTf = loadChartPref(state.activeSymbol);
    renderChart(state.activeSymbol, savedTf);
    updateOrderPanel();
    refreshPositions();
    loadHistory();
    loadTransactions();
    loadStats();

    // ── Real-time updates: SSE preferred, polling fallback ────────────────
    // startSSE() returns true if EventSource connected successfully.
    // On success, it clears priceInterval — SSE takes over price + account updates.
    // On failure, startPollingFallback() ensures 8s polling continues as before.
    // The 15s position interval always runs (SSE does not push position rows).
    const sseStarted = startSSE();
    if (!sseStarted) {
      // SSE not available or failed immediately — start polling fallback
      state.priceInterval = setInterval(priceTick, 8000);
    }
    // Position interval always runs regardless of SSE status
    state.posInterval = setInterval(() => {
      if (state.editingInputs.size === 0) refreshPositions();
    }, 15000);

    // Tab switching
    document.querySelectorAll('.fx-tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Symbol search
    document.getElementById('fx-symbol-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.fx-wl-item').forEach(el => {
        el.style.display = el.dataset.sym.toLowerCase().includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.fx-wl-category').forEach(el => el.style.display = '');
    });

    // Lot preview
    document.getElementById('fx-lot-input').addEventListener('input', updateOrderPreview);
    document.getElementById('fx-sl-input').addEventListener('input', updateOrderPreview);
    document.getElementById('fx-tp-input').addEventListener('input', updateOrderPreview);

    // TF buttons
    document.querySelectorAll('.fx-tf-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fx-tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tf = btn.dataset.tf;
        saveChartPref(state.activeSymbol, tf);
        renderChart(state.activeSymbol, tf);
      });
    });

    // Hide loading overlay
    const ov = document.getElementById('fx-loading-overlay');
    ov.style.opacity = '0';
    setTimeout(() => ov.style.display = 'none', 400);

    // Update user display
    document.getElementById('fx-user-display').textContent = `UID: ${FXSIM.user.id}`;
  }

  // ── API helpers ──────────────────────────────────────────────────────────
  /**
   * Central fetch wrapper. Returns parsed JSON on success, or null on any
   * failure (network error, timeout, non-JSON response).
   * Callers already check for null/error — this prevents uncaught rejections
   * that would crash the terminal's polling intervals.
   */
  async function api(path, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': FXSIM.nonce },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(FXSIM.api + path, opts);
      // Surface non-2xx as structured error objects — same pattern as dashboard req().
      // Without this, a 429/403 JSON body is stored as symbols/account data and
      // causes "state.symbols.find is not a function" and similar downstream crashes.
      if (!r.ok) {
        let errBody = {};
        try { errBody = await r.json(); } catch (_) { /* non-JSON */ }
        console.warn('[PropFirm] API', method, path, '→ HTTP', r.status, errBody);
        return null;
      }
      return await r.json();
    } catch (e) {
      // Network error or non-JSON body — log and return null
      // Callers handle null gracefully; nothing crashes
      console.warn('[PropFirm] API', method, path, '→', e.message);
      return null;
    }
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  async function loadSymbols() {
    const data = await api('/symbols');
    // Guard: api() returns null on error, or an object on non-2xx JSON responses.
    // Only store if the response is actually an array to prevent .find() crashes.
    if (Array.isArray(data)) state.symbols = data;
  }

  async function loadAccount() {
    const data = await api('/account');
    if (!data || data.no_challenge || data.error) {
      // No active challenge — account summary shows zeroed state
      state.account = null;
      renderAccountSummary();
      checkWeekendWarning();
      return;
    }
    state.account = data;
    renderAccountSummary();
    checkWeekendWarning();
  }

  /**
   * Show or hide the weekend close warning banner.
   * Uses client UTC time — no extra REST call.
   * Warning appears Friday 21:45–22:00 UTC for plans without weekend holding.
   * The banner is injected once into the terminal and toggled via display.
   */
  function checkWeekendWarning() {
    const now  = new Date();
    const dow  = now.getUTCDay();   // 0=Sun, 5=Fri, 6=Sat
    const h    = now.getUTCHours();
    const m    = now.getUTCMinutes();
    const mins = h * 60 + m;

    // Warning window: Friday 21:45–22:00 UTC
    const isFridayWarning = (dow === 5 && mins >= (21 * 60 + 45) && mins < (22 * 60));
    // After close: Friday ≥22:00, Saturday, or Sunday — market is closed
    const isWeekend = (dow === 6 || dow === 0 || (dow === 5 && mins >= (22 * 60)));

    let el = document.getElementById('fx-weekend-warning');
    if (!el) {
      // Create the element once and insert it at the top of the bottom panel
      el = document.createElement('div');
      el.id        = 'fx-weekend-warning';
      el.className = 'fx-weekend-warning';
      el.style.display = 'none';
      const panel = document.getElementById('fx-bottom-panel');
      if (panel) panel.insertBefore(el, panel.firstChild);
    }

    if (isFridayWarning) {
      el.className     = 'fx-weekend-warning fx-weekend-warning--alert';
      el.innerHTML     = '⚠ Market closes at 22:00 UTC (in less than 15 minutes). Open positions on weekend-restricted plans will be automatically closed.';
      el.style.display = 'block';
    } else if (isWeekend) {
      el.className     = 'fx-weekend-warning fx-weekend-warning--info';
      el.innerHTML     = 'ℹ Forex market is closed over the weekend. Trading resumes Monday 00:00 UTC.';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  async function loadPrices() {
    const data = await api('/prices');
    if (data) state.prices = data; // null-safe: keep last known prices on error
  }

  async function priceTick() {
    state.lastPrices = { ...state.prices };
    await loadPrices();
    updateWatchlistPrices();
    updateOrderPanel();
  }

  // ════════════════════════════════════════════════════════════════════════
  // SERVER-SENT EVENTS (SSE) — real-time stream client
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Start the SSE stream connection.
   *
   * Connects to /fxsim/v1/stream?_wpnonce=X — the nonce is required because
   * EventSource cannot send custom headers, so WP validates via query param.
   *
   * On success: clears polling intervals (SSE replaces them).
   * On failure / unsupported: falls back to existing polling silently.
   *
   * Event types handled:
   *   prices  → update state.prices, refresh watchlist + order panel
   *   account → update state.account, refresh account summary
   *   pending → update pending orders table if tab is open
   *   ping    → no-op (keepalive)
   *   close   → server-initiated graceful close; EventSource reconnects automatically
   *
   * Connection lifecycle:
   *   Server closes after ~25s. Browser EventSource reconnects automatically
   *   (retry interval set by server). Each reconnect sends full state immediately.
   */
  function startSSE() {
    // Feature detect — not available in very old browsers or some mobile WebViews
    if (typeof EventSource === 'undefined') {
      console.info('[PropFirm] EventSource not supported — using polling fallback');
      return false;
    }

    if (!FXSIM.stream || !FXSIM.nonce) {
      console.info('[PropFirm] SSE config missing — using polling fallback');
      return false;
    }

    // Nonce passed as query param — the only way with EventSource (no custom headers)
    const url = FXSIM.stream + '?_wpnonce=' + encodeURIComponent(FXSIM.nonce);

    try {
      const es = new EventSource(url);
      state.sseSource = es;

      // ── prices event ─────────────────────────────────────────────────────
      es.addEventListener('prices', e => {
        try {
          const data = JSON.parse(e.data);
          if (data && typeof data === 'object') {
            state.lastPrices = { ...state.prices };
            state.prices     = data;
            updateWatchlistPrices();
            updateOrderPanel();
          }
        } catch (err) {
          console.warn('[PropFirm] SSE prices parse error:', err);
        }
      });

      // ── account event ─────────────────────────────────────────────────────
      es.addEventListener('account', e => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.id) {
            state.account = data;
            renderAccountSummary();
            checkWeekendWarning();
          }
        } catch (err) {
          console.warn('[PropFirm] SSE account parse error:', err);
        }
      });

      // ── pending event ─────────────────────────────────────────────────────
      es.addEventListener('pending', e => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data)) {
            // Update badge regardless of which tab is active
            const badge = document.getElementById('fx-pending-count');
            if (badge) badge.textContent = data.filter(o => o.status === 'pending').length;
            // Refresh table only if pending tab is currently visible
            const tab = document.getElementById('tab-pending');
            if (tab && tab.classList.contains('active')) {
              renderPendingTable(data);
            }
          }
        } catch (err) {
          console.warn('[PropFirm] SSE pending parse error:', err);
        }
      });

      // ── positions event — live PnL tick ──────────────────────────────────
      // Server pushes lightweight position objects {id, pnl, current_price}
      // whenever prices change. We update cells in-place to avoid table flicker
      // and preserve SL/TP focus state.
      es.addEventListener('positions', e => {
        try {
          const data = JSON.parse(e.data);
          if (!Array.isArray(data)) return;
          data.forEach(pos => {
            const row = document.querySelector(`tr[data-pos-id="${pos.id}"]`);
            if (!row) return;
            // Current price cell (index 5)
            const priceCell = row.cells[5];
            if (priceCell) priceCell.textContent = fmt(parseFloat(pos.current_price), pos.symbol);
            // PnL cell (index 8)
            const pnlCell = row.cells[8];
            if (pnlCell) {
              const pnl    = parseFloat(pos.pnl);
              const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
              pnlCell.textContent = pnlStr;
              pnlCell.className   = pnl >= 0 ? 'fx-pnl-pos' : 'fx-pnl-neg';
              // Brief flash to signal value just updated
              pnlCell.classList.add('fx-pnl-updated');
              setTimeout(() => pnlCell.classList.remove('fx-pnl-updated'), 500);
            }
          });
          // Update state.positions PnL for account summary accuracy
          data.forEach(pos => {
            const sp = state.positions.find(p => p.id == pos.id);
            if (sp) { sp.pnl = pos.pnl; sp.current_price = pos.current_price; }
          });
        } catch (err) {
          console.warn('[PropFirm] SSE positions parse error:', err);
        }
      });

      // ── close event — server-initiated graceful close ─────────────────────
      // EventSource will reconnect automatically after the retry interval.
      // We don't need to do anything — the reconnect re-sends full state.
      es.addEventListener('close', () => {
        // EventSource OPEN state: 0=connecting, 1=open, 2=closed
        // close event means server is finishing gracefully; browser will reconnect
        console.debug('[PropFirm] SSE graceful close — browser will reconnect');
      });

      // ── onopen — SSE connected successfully ───────────────────────────────
      es.onopen = () => {
        state.sseActive = true;
        // Clear polling intervals — SSE now handles prices and account updates
        // Positions interval kept: SSE doesn't push position rows (DB write path)
        if (state.priceInterval) {
          clearInterval(state.priceInterval);
          state.priceInterval = null;
        }
        console.debug('[PropFirm] SSE connected — price polling stopped');
      };

      // ── onerror — connection failed or dropped ────────────────────────────
      es.onerror = err => {
        state.sseActive = false;
        // EventSource readyState 2 = CLOSED (permanent failure or server error)
        // readyState 0 = CONNECTING (temporary; browser is retrying automatically)
        if (es.readyState === EventSource.CLOSED) {
          console.warn('[PropFirm] SSE closed permanently — restoring polling fallback');
          stopSSE();
          startPollingFallback();
        }
        // If CONNECTING, browser is retrying automatically — don't interfere
      };

      return true;

    } catch (err) {
      console.warn('[PropFirm] SSE init error — using polling fallback:', err);
      return false;
    }
  }

  /**
   * Stop SSE and clean up the EventSource.
   * Called when SSE fails permanently or on terminal unmount.
   */
  function stopSSE() {
    if (state.sseSource) {
      state.sseSource.close();
      state.sseSource = null;
    }
    state.sseActive = false;
  }

  /**
   * Start polling intervals as fallback when SSE is unavailable or failed.
   * Idempotent — does nothing if intervals are already running.
   */
  function startPollingFallback() {
    if (!state.priceInterval) {
      state.priceInterval = setInterval(priceTick, 8000);
      console.debug('[PropFirm] polling fallback started (8s prices, 15s positions)');
    }
  }

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const CATEGORIES = { forex:'Forex', metal:'Metals', crypto:'Crypto' };

  function renderWatchlist() {
    const container = document.getElementById('fx-watchlist-list');
    container.innerHTML = '';

    const grouped = {};
    state.symbols.forEach(s => {
      (grouped[s.category] = grouped[s.category] || []).push(s);
    });

    Object.entries(CATEGORIES).forEach(([cat, label]) => {
      const items = grouped[cat];
      if (!items) return;

      const hdr = document.createElement('div');
      hdr.className = 'fx-wl-category';
      hdr.textContent = label;
      container.appendChild(hdr);

      items.forEach(sym => {
        const price = state.prices[sym.symbol] || {};
        const el = document.createElement('div');
        el.className = 'fx-wl-item' + (sym.symbol === state.activeSymbol ? ' active' : '');
        el.dataset.sym = sym.symbol;
        el.innerHTML = `
          <div class="fx-wl-sym">${sym.symbol}</div>
          <div class="fx-wl-prices">
            <div class="fx-wl-bid" id="wl-bid-${sym.symbol}">${fmt(price.bid, sym.symbol)}</div>
            <div class="fx-wl-ask" id="wl-ask-${sym.symbol}">${fmt(price.ask, sym.symbol)}</div>
            <div class="fx-wl-chg" id="wl-chg-${sym.symbol}">—</div>
          </div>`;
        el.addEventListener('click', () => selectSymbol(sym.symbol));
        container.appendChild(el);
      });
    });
  }

  function updateWatchlistPrices() {
    state.symbols.forEach(sym => {
      const cur  = state.prices[sym.symbol] || {};
      const prev = state.lastPrices[sym.symbol] || {};
      const bidEl = document.getElementById(`wl-bid-${sym.symbol}`);
      const askEl = document.getElementById(`wl-ask-${sym.symbol}`);
      const chgEl = document.getElementById(`wl-chg-${sym.symbol}`);
      if (bidEl) bidEl.textContent = fmt(cur.bid, sym.symbol);
      if (askEl) askEl.textContent = fmt(cur.ask, sym.symbol);
      if (chgEl && prev.mid) {
        const delta = ((cur.mid - prev.mid) / prev.mid) * 100;
        chgEl.textContent = (delta >= 0 ? '+' : '') + delta.toFixed(3) + '%';
        chgEl.className = 'fx-wl-chg ' + (delta >= 0 ? 'up' : 'down');
      }
    });
    // Active symbol display
    const ap = state.prices[state.activeSymbol] || {};
    const dp = document.getElementById('fx-active-price-display');
    if (dp) dp.textContent = fmt(ap.mid || ap.ask, state.activeSymbol);
  }

  // ── Symbol selection ──────────────────────────────────────────────────────
  function selectSymbol(sym) {
    state.activeSymbol = sym;
    document.querySelectorAll('.fx-wl-item').forEach(el => el.classList.toggle('active', el.dataset.sym === sym));
    document.getElementById('fx-active-symbol-label').textContent = sym;
    document.getElementById('fx-order-symbol').textContent = sym;
    // If widget already live, setSymbol() preserves drawings + current TF
    // Only pass interval for first build (widget doesn't exist yet)
    const tf = document.querySelector('.fx-tf-btn.active')?.dataset.tf || '60';
    renderChart(sym, tf);
    updateOrderPanel();
    updateOrderPreview();
    updateChartOrders(sym);
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  function tvSymbol(sym) {
    const map = {
      EURUSD:'FX:EURUSD',GBPUSD:'FX:GBPUSD',USDJPY:'FX:USDJPY',USDCHF:'FX:USDCHF',
      AUDUSD:'FX:AUDUSD',USDCAD:'FX:USDCAD',NZDUSD:'FX:NZDUSD',EURGBP:'FX:EURGBP',
      EURJPY:'FX:EURJPY',GBPJPY:'FX:GBPJPY',XAUUSD:'OANDA:XAUUSD',XAGUSD:'OANDA:XAGUSD',
      BTCUSD:'BITSTAMP:BTCUSD',ETHUSD:'BITSTAMP:ETHUSD',
    };
    return map[sym] || `FX:${sym}`;
  }

  // ── Chart localStorage helpers ────────────────────────────────────────────
  function saveChartPref(sym, interval) {
    try { localStorage.setItem('fxsim_tf_' + sym, interval); } catch(e) {}
  }
  function loadChartPref(sym, fallback = '60') {
    try { return localStorage.getItem('fxsim_tf_' + sym) || fallback; } catch(e) { return fallback; }
  }
  function saveLastSymbol(sym) {
    try { localStorage.setItem('fxsim_last_sym', sym); } catch(e) {}
  }
  function loadLastSymbol() {
    try { return localStorage.getItem('fxsim_last_sym') || 'EURUSD'; } catch(e) { return 'EURUSD'; }
  }

  function renderChart(sym, interval = null) {
    // Load saved interval for this symbol if not explicitly passed
    const tf = interval || loadChartPref(sym);
    saveChartPref(sym, tf);
    saveLastSymbol(sym);

    const wrap = document.getElementById('fx-tradingview-chart');

    // If widget alive, setSymbol preserves drawings on the widget side
    // (TradingView free widget auto-saves drawings to its own cloud per symbol)
    if (state.chartWidget && state.chartWidget.iframe) {
      try {
        state.chartWidget.setSymbol(tvSymbol(sym), tf, () => {});
        // Sync our TF buttons to saved pref
        document.querySelectorAll('.fx-tf-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tf === tf);
        });
        return;
      } catch(e) { /* fall through to rebuild */ }
    }

    wrap.innerHTML = '';
    if (!window.TradingView) {
      const s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/tv.js';
      s.onload = () => _buildWidget(sym, tf);
      document.head.appendChild(s);
    } else {
      _buildWidget(sym, tf);
    }
  }

  function _buildWidget(sym, interval) {
    const wrap = document.getElementById('fx-tradingview-chart');
    wrap.innerHTML = '';
    const container = document.createElement('div');
    container.id = 'fx-tv-container';
    container.style.cssText = 'height:100%;';
    wrap.appendChild(container);

    state.chartWidget = new window.TradingView.widget({
      container_id:        'fx-tv-container',
      width:               '100%',
      height:              '100%',
      symbol:              tvSymbol(sym),
      interval,
      timezone:            'Etc/UTC',
      theme:               'dark',
      style:               '1',
      locale:              'en',
      toolbar_bg:          '#080e1a',
      enable_publishing:   false,
      hide_side_toolbar:   false,
      allow_symbol_change: false, // we control symbol switching ourselves
      save_image:          false,
      autosize:            true,
      backgroundColor:     '#060b14',
      gridColor:           '#0d1829',
      // These two enable drawing persistence per user via TradingView's own cloud
      // Works with the free widget — drawings saved by client_id + user_id
      withdateranges:      true,
      hide_volume:         false,
    });

    // Sync TF buttons after build
    document.querySelectorAll('.fx-tf-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tf === interval);
    });
  }

  // ── Market hours check (client-side display) ──────────────────────────────
  function isMarketOpen(symbol) {
    const crypto = ['BTCUSD', 'ETHUSD'];
    if (crypto.includes(symbol)) return true;
    const now = new Date();
    const dow = now.getUTCDay(); // 0=Sun, 6=Sat
    const h   = now.getUTCHours();
    const min = now.getUTCMinutes();
    const mins = h * 60 + min;
    if (dow === 6) return false; // Saturday
    if (dow === 0) return false; // Sunday
    if (dow === 5 && mins >= 22 * 60) return false; // Friday after 22:00 UTC
    return true;
  }

  function getMarketStatusText(symbol) {
    if (isMarketOpen(symbol)) return null;
    return 'Market Closed — ' + symbol + ' does not trade on weekends. Opens Monday 00:00 UTC.';
  }

  function updateOrderPanel() {
    const p = state.prices[state.activeSymbol] || {};
    document.getElementById('fx-bid-price').textContent = fmt(p.bid, state.activeSymbol);
    document.getElementById('fx-ask-price').textContent = fmt(p.ask, state.activeSymbol);
    document.getElementById('fx-sell-label').textContent = fmt(p.bid, state.activeSymbol);
    document.getElementById('fx-buy-label').textContent  = fmt(p.ask, state.activeSymbol);

    const sym = state.symbols.find(s => s.symbol === state.activeSymbol);
    if (sym && p.bid) {
      const spreadRaw = (p.ask - p.bid);
      // Convert to pips: JPY pairs = price diff × 100, others × 10000
      const isJPY = state.activeSymbol.includes('JPY');
      const pips  = isJPY ? (spreadRaw * 100).toFixed(1) : (spreadRaw * 10000).toFixed(1);
      const spreadEl = document.getElementById('fx-spread-display');
      if (spreadEl) {
        spreadEl.textContent = `${pips} pips`;
        // Flag wide spreads (> 3 pips for forex, > 50 for XAU, > 5 for indices)
        const wide = parseFloat(pips) > (state.activeSymbol === 'XAUUSD' ? 50
          : state.activeSymbol === 'XAGUSD' ? 20 : 3);
        spreadEl.classList.toggle('fx-spread-wide', wide);
      }
    }

    const dp = document.getElementById('fx-active-price-display');
    if (dp) dp.textContent = fmt(p.mid || p.ask, state.activeSymbol);

    // Market hours gate — disable Buy/Sell when market is closed
    const closedMsg = getMarketStatusText(state.activeSymbol);
    const buyBtn  = document.getElementById('fx-btn-buy');
    const sellBtn = document.getElementById('fx-btn-sell');
    const msgEl   = document.getElementById('fx-order-msg');
    if (closedMsg) {
      if (buyBtn)  { buyBtn.disabled  = true;  buyBtn.style.opacity  = '0.4'; }
      if (sellBtn) { sellBtn.disabled = true;  sellBtn.style.opacity = '0.4'; }
      if (msgEl && !msgEl.textContent.startsWith('✓') && !msgEl.textContent.startsWith('✗')) {
        msgEl.style.display = 'block';
        msgEl.className = 'fx-order-msg error';
        msgEl.textContent = '🕐 ' + closedMsg;
      }
    } else {
      if (buyBtn)  { buyBtn.disabled  = false; buyBtn.style.opacity  = '1'; }
      if (sellBtn) { sellBtn.disabled = false; sellBtn.style.opacity = '1'; }
      if (msgEl && msgEl.textContent.startsWith('🕐')) { msgEl.style.display = 'none'; }
    }

    updateOrderPreview();
  }

  function updateOrderPreview() {
    const lot    = parseFloat(document.getElementById('fx-lot-input').value) || 0;
    const sym    = state.symbols.find(s => s.symbol === state.activeSymbol);
    const acc    = state.account;
    const p      = state.prices[state.activeSymbol] || {};
    if (!sym || !acc || !p.ask) return;

    const price      = p.ask;
    const margin     = (lot * sym.contract_size * price) / acc.leverage;
    const commission = lot * sym.commission;
    document.getElementById('prev-margin').textContent     = '$' + margin.toFixed(2);
    document.getElementById('prev-commission').textContent = '$' + commission.toFixed(2);
  }

  // ── Place Order ──────────────────────────────────────────────────────────
  async function placeOrder(type) {
    const msgEl = document.getElementById('fx-order-msg');
    msgEl.style.display = 'none';

    const lot = parseFloat(document.getElementById('fx-lot-input').value);
    const sl  = document.getElementById('fx-sl-input').value;
    const tp  = document.getElementById('fx-tp-input').value;

    const payload = { symbol: state.activeSymbol, type, lot_size: lot };
    if (sl) payload.sl = parseFloat(sl);
    if (tp) payload.tp = parseFloat(tp);

    const res = await api('/open', 'POST', payload);
    showMsg(msgEl, res);

    if (res.success) {
      document.getElementById('fx-sl-input').value = '';
      document.getElementById('fx-tp-input').value = '';
      await loadAccount();
      refreshPositions();
    }
  }

  function showMsg(el, res) {
    el.style.display = 'block';
    // res could be null (network failure from api()) — treat as error
    const ok = res?.success;
    el.className  = 'fx-order-msg ' + (ok ? 'success' : 'error');
    el.textContent = ok
      ? `✓ Order opened @ ${res.open_price} | Margin: $${res.margin?.toFixed(2)} | Commission: $${res.commission?.toFixed(2)}`
      : `✗ ${res?.message || 'Request failed — check connection and try again.'}`;
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  // ── Positions ─────────────────────────────────────────────────────────────
  async function refreshPositions() {
    const data = await api('/positions');
    if (!data) return; // network error — keep current display
    state.positions = data;
    document.getElementById('fx-pos-count').textContent = data.length;
    renderPositionsTable(data);
    await loadAccount();
  }

  function renderPositionsTable(positions) {
    const tbody = document.getElementById('fx-positions-body');
    if (!positions.length) {
      tbody.innerHTML = '<tr class="fx-empty"><td colspan="11">No open positions.</td></tr>';
      updateChartOrders(state.activeSymbol);
      return;
    }

    tbody.innerHTML = positions.map(pos => {
      const pnl     = parseFloat(pos.pnl);
      const pnlCls  = pnl >= 0 ? 'fx-pnl-pos' : 'fx-pnl-neg';
      const pnlStr  = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
      const typeCls = pos.type === 'buy' ? 'fx-type-buy' : 'fx-type-sell';
      const slVal   = pos.sl || '';
      const tpVal   = pos.tp || '';

      return `<tr data-pos-id="${pos.id}">
        <td>${pos.id}</td>
        <td><strong style="cursor:pointer;color:var(--accent-gold)" onclick="fxTerminal.selectSym('${pos.symbol}')">${pos.symbol}</strong></td>
        <td class="${typeCls}">${pos.type.toUpperCase()}</td>
        <td>${pos.lot_size}</td>
        <td>${fmt(pos.open_price, pos.symbol)}</td>
        <td>${fmt(pos.current_price, pos.symbol)}</td>
        <td>
          <div class="fx-sltp-wrap">
            <input class="fx-sltp-input" data-orig="${slVal}" data-type="sl" data-pos="${pos.id}"
              value="${slVal}" placeholder="—" onfocus="fxTerminal.onSltpFocus(this)"
              onblur="fxTerminal.onSltpBlur(this)" onkeydown="fxTerminal.onSltpKey(event,this)">
            <button class="fx-sltp-save" id="sl-save-${pos.id}" onclick="fxTerminal.saveSltp(${pos.id})">Save</button>
          </div>
        </td>
        <td>
          <div class="fx-sltp-wrap">
            <input class="fx-sltp-input" data-orig="${tpVal}" data-type="tp" data-pos="${pos.id}"
              value="${tpVal}" placeholder="—" onfocus="fxTerminal.onSltpFocus(this)"
              onblur="fxTerminal.onSltpBlur(this)" onkeydown="fxTerminal.onSltpKey(event,this)">
            <button class="fx-sltp-save" id="tp-save-${pos.id}" onclick="fxTerminal.saveSltp(${pos.id})">Save</button>
          </div>
        </td>
        <td class="${pnlCls}">${pnlStr}</td>
        <td>$${parseFloat(pos.margin).toFixed(2)}</td>
        <td>
          <button class="fx-close-btn" onclick="fxTerminal.closePos(${pos.id})">✕ Close</button>
          <button class="fx-partial-btn" onclick="fxTerminal.partialClosePrompt(${pos.id}, ${pos.lot_size})">½ Partial</button>
        </td>
      </tr>`;
    }).join('');

    // Update chart order overlay for active symbol
    updateChartOrders(state.activeSymbol);
  }

  function selectSym(sym) { selectSymbol(sym); }

  // ── SL/TP inline editing ──────────────────────────────────────────────────
  function onSltpFocus(input) {
    state.editingInputs.add(input);
    const posId  = input.dataset.pos;
    const type   = input.dataset.type;
    const saveId = `${type}-save-${posId}`;
    const saveEl = document.getElementById(saveId);
    if (saveEl) saveEl.classList.add('visible');
  }

  function onSltpBlur(input) {
    // Delayed so Save button click fires first
    setTimeout(() => {
      state.editingInputs.delete(input);
      const posId  = input.dataset.pos;
      const type   = input.dataset.type;
      const saveEl = document.getElementById(`${type}-save-${posId}`);
      // If value unchanged, revert display
      if (input.value === input.dataset.orig) {
        if (saveEl) saveEl.classList.remove('visible');
      }
    }, 200);
  }

  function onSltpKey(e, input) {
    if (e.key === 'Enter') {
      const posId = input.dataset.pos;
      saveSltp(parseInt(posId));
    }
    if (e.key === 'Escape') {
      input.value = input.dataset.orig;
      input.blur();
      state.editingInputs.delete(input);
    }
  }

  async function saveSltp(posId) {
    const row     = document.querySelector(`tr[data-pos-id="${posId}"]`);
    if (!row) return;
    const slInput = row.querySelector('[data-type="sl"]');
    const tpInput = row.querySelector('[data-type="tp"]');
    const sl = slInput?.value !== '' ? parseFloat(slInput.value) : null;
    const tp = tpInput?.value !== '' ? parseFloat(tpInput.value) : null;

    const res = await api(`/sltp/${posId}`, 'POST', { sl: sl ?? '', tp: tp ?? '' });
    if (res.success) {
      if (slInput) { slInput.dataset.orig = slInput.value; document.getElementById(`sl-save-${posId}`)?.classList.remove('visible'); }
      if (tpInput) { tpInput.dataset.orig = tpInput.value; document.getElementById(`tp-save-${posId}`)?.classList.remove('visible'); }
    } else {
      alert('SL/TP error: ' + res.message);
    }
  }

  // ── Chart Order Visualization ─────────────────────────────────────────────
  function updateChartOrders(sym) {
    const overlay = document.getElementById('fx-chart-orders');
    const list    = document.getElementById('fx-co-list');
    const symEl   = document.getElementById('fx-co-symbol');
    if (!overlay || !list) return;

    const symPositions = state.positions.filter(p => p.symbol === sym);
    if (!symPositions.length) { overlay.style.display = 'none'; return; }

    overlay.style.display = 'block';
    if (symEl) symEl.textContent = sym;

    list.innerHTML = symPositions.map(pos => {
      const pnl     = parseFloat(pos.pnl);
      const pnlCls  = pnl >= 0 ? 'fx-co-pnl-pos' : 'fx-co-pnl-neg';
      const pnlStr  = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
      const typeCls = pos.type === 'buy' ? 'fx-co-type-buy' : 'fx-co-type-sell';
      const arrow   = pos.type === 'buy' ? '▲' : '▼';

      return `<div class="fx-co-item">
        <div class="fx-co-header">
          <span class="${typeCls}">${arrow} ${pos.type.toUpperCase()} ${pos.lot_size}L</span>
          <span class="${pnlCls}">${pnlStr}</span>
        </div>
        <div class="fx-co-line">
          <div class="fx-co-dot-entry"></div>
          <span>Entry: ${fmt(pos.open_price, sym)}</span>
        </div>
        ${pos.sl ? `<div class="fx-co-line"><div class="fx-co-dot-sl"></div><span>SL: ${fmt(pos.sl, sym)}</span></div>` : ''}
        ${pos.tp ? `<div class="fx-co-line"><div class="fx-co-dot-tp"></div><span>TP: ${fmt(pos.tp, sym)}</span></div>` : ''}
        <div class="fx-co-line" style="color:var(--text-dim)">
          Current: ${fmt(pos.current_price, sym)}
        </div>
      </div>`;
    }).join('');
  }

  async function closePos(posId) {
    if (!confirm('Close this position?')) return;
    const res = await api(`/close/${posId}`, 'POST');
    if (res.success) {
      await refreshPositions();
      loadHistory();
      loadTransactions();
      loadStats();
    } else {
      alert('Close failed: ' + res.message);
    }
  }

  // ── Account Summary ───────────────────────────────────────────────────────
  function renderAccountSummary() {
    const acc = state.account;
    if (!acc) {
      // No active challenge account
      ['acc-balance','acc-equity','acc-margin','acc-free'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '$0.00';
      });
      const lvlEl = document.getElementById('acc-level');
      if (lvlEl) lvlEl.textContent = '—';
      return;
    }
    const free     = acc.equity - acc.margin_used;
    const level    = acc.margin_used > 0 ? ((acc.equity / acc.margin_used) * 100) : null;
    const levelStr = level !== null ? level.toFixed(1) + '%' : '—';

    document.getElementById('acc-balance').textContent = '$' + parseFloat(acc.balance).toFixed(2);
    document.getElementById('acc-equity').textContent  = '$' + parseFloat(acc.equity).toFixed(2);
    document.getElementById('acc-margin').textContent  = '$' + parseFloat(acc.margin_used).toFixed(2);
    document.getElementById('acc-free').textContent    = '$' + free.toFixed(2);
    document.getElementById('acc-level').textContent   = levelStr;

    const lvlEl = document.getElementById('acc-level');
    if (level !== null) {
      lvlEl.className = level < 100 ? 'fx-margin-danger' : level < 150 ? 'fx-margin-warning' : 'fx-margin-ok';
    }
    const eqEl = document.getElementById('acc-equity');
    const diff  = parseFloat(acc.equity) - parseFloat(acc.balance);
    eqEl.style.color = diff >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // ── History / Transactions / Stats ────────────────────────────────────────
  async function loadHistory(cursor = 0) {
    const data = await api(cursor ? `/history?last_id=${cursor}` : '/history');
    const tbody = document.getElementById('fx-history-body');

    // Handle both response shapes:
    // new: { trades: [...], next_cursor: N, has_more: bool }
    // legacy fallback: plain array (safety net)
    const trades = Array.isArray(data) ? data : (data?.trades ?? []);
    const nextCursor = data?.next_cursor ?? null;

    if (!trades.length && cursor === 0) {
      tbody.innerHTML = '<tr class="fx-empty"><td colspan="9">No trade history.</td></tr>';
      return;
    }

    // First page: replace. Subsequent pages (lazy load): append.
    const rows = trades.map(t => {
      const pnl    = parseFloat(t.pnl);
      const pnlCls = pnl >= 0 ? 'fx-pnl-pos' : 'fx-pnl-neg';
      return `<tr>
        <td>${t.id}</td>
        <td>${t.symbol}</td>
        <td class="${t.type === 'buy' ? 'fx-type-buy' : 'fx-type-sell'}">${t.type.toUpperCase()}</td>
        <td>${t.lot_size}</td>
        <td>${fmt(t.open_price, t.symbol)}</td>
        <td>${fmt(t.close_price, t.symbol)}</td>
        <td class="${pnlCls}">${(pnl >= 0 ? '+' : '')}$${Math.abs(pnl).toFixed(2)}</td>
        <td style="text-transform:uppercase;color:var(--text-muted)">${t.close_reason}</td>
        <td>${new Date(t.closed_at).toLocaleString()}</td>
      </tr>`;
    }).join('');

    if (cursor === 0) {
      tbody.innerHTML = rows;
    } else {
      // Remove existing "Load more" row before appending, then re-add if needed
      const existing = tbody.querySelector('.fx-load-more-row');
      if (existing) existing.remove();
      tbody.insertAdjacentHTML('beforeend', rows);
    }

    // Append "Load more" row if there are more trades to fetch
    if (nextCursor) {
      tbody.insertAdjacentHTML('beforeend',
        `<tr class="fx-load-more-row">
           <td colspan="9" style="text-align:center;padding:10px">
             <button class="fx-refresh-btn"
                     onclick="fxTerminal.loadMoreHistory(${nextCursor})">
               ↓ Load more
             </button>
           </td>
         </tr>`
      );
    }
  }

  /** Load the next page of history (called from Load more button). */
  async function loadMoreHistory(cursor) {
    await loadHistory(cursor);
  }

  async function loadTransactions() {
    const data = await api('/transactions');
    const tbody = document.getElementById('fx-tx-body');
    if (!data || !data.length) { tbody.innerHTML = '<tr class="fx-empty"><td colspan="6">No transactions.</td></tr>'; return; }
    tbody.innerHTML = data.map(t => {
      const amt    = parseFloat(t.amount);
      const cls    = amt >= 0 ? 'fx-pnl-pos' : 'fx-pnl-neg';
      return `<tr>
        <td>${t.id}</td>
        <td style="text-transform:capitalize;color:var(--accent-gold)">${t.type}</td>
        <td class="${cls}">${(amt >= 0 ? '+' : '')}$${Math.abs(amt).toFixed(2)}</td>
        <td>$${parseFloat(t.balance_after).toFixed(2)}</td>
        <td style="color:var(--text-muted)">${t.note || '—'}</td>
        <td>${new Date(t.created_at).toLocaleString()}</td>
      </tr>`;
    }).join('');
  }

  async function loadStats() {
    const s = await api('/stats');
    if (!s) return; // network error — keep current stats display
    document.getElementById('st-total').textContent = s.total_trades;
    document.getElementById('st-wins').textContent  = s.wins;
    document.getElementById('st-losses').textContent= s.losses;
    document.getElementById('st-wr').textContent    = s.win_rate + '%';
    document.getElementById('st-pf').textContent    = s.profit_factor;
    const pnl = s.net_pnl;
    const pnlEl = document.getElementById('st-pnl');
    pnlEl.textContent  = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
    pnlEl.style.color  = pnl >= 0 ? 'var(--green)' : 'var(--red)';
    document.getElementById('st-gp').textContent = '+$' + s.gross_profit.toFixed(2);
    document.getElementById('st-gl').textContent = '-$' + s.gross_loss.toFixed(2);
  }

  // ── Lot adjustment ────────────────────────────────────────────────────────
  function adjustLot(delta) {
    const inp = document.getElementById('fx-lot-input');
    let v = Math.round((parseFloat(inp.value) + delta) * 100) / 100;
    const sym = state.symbols.find(s => s.symbol === state.activeSymbol);
    if (sym) v = Math.max(sym.min_lot, Math.min(sym.max_lot, v));
    inp.value = v.toFixed(2);
    updateOrderPreview();
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  function fmt(price, symbol) {
    if (!price) return '—';
    const n = parseFloat(price);
    if (symbol === 'USDJPY' || symbol === 'EURJPY' || symbol === 'GBPJPY') return n.toFixed(3);
    if (['XAUUSD'].includes(symbol)) return n.toFixed(2);
    if (['BTCUSD'].includes(symbol)) return n.toFixed(0);
    if (['ETHUSD'].includes(symbol)) return n.toFixed(1);
    return n.toFixed(5);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  // ── Partial close ─────────────────────────────────────────────────────────
  async function partialClosePrompt(posId, totalLots) {
    const lots = parseFloat(prompt(`Partial close — Enter lots to close (max ${totalLots}):`));
    if (!lots || isNaN(lots) || lots <= 0) return;
    if (lots >= totalLots) { if (!confirm('Close full position?')) return; }
    const res = await api(`/partial-close/${posId}`, 'POST', { lots });
    if (res.success) {
      const msgEl = document.getElementById('fx-order-msg');
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.className = 'fx-order-msg success';
        msgEl.textContent = `✓ Partial close: ${lots}L @ ${res.close_price} | P&L: $${res.pnl?.toFixed(2)} | Remaining: ${res.remaining_lots}L`;
        setTimeout(() => { msgEl.style.display = 'none'; }, 6000);
      }
      await refreshPositions();
      loadHistory();
    } else {
      alert('Partial close failed: ' + (res.message || 'Unknown error'));
    }
  }

  // ── One-click trading ─────────────────────────────────────────────────────
  function oneClickBuy()  { placeOrder('buy');  }
  function oneClickSell() { placeOrder('sell'); }

  // ── Risk Calculator ───────────────────────────────────────────────────────
  function calcRisk() {
    const acc        = state.account;
    const sym        = state.symbols.find(s => s.symbol === state.activeSymbol);
    const prices     = state.prices[state.activeSymbol] || {};
    if (!acc || !sym || !prices.ask) return;

    const balance    = parseFloat(acc.balance);
    const riskPctEl  = document.getElementById('fx-risk-pct');
    const slPxEl     = document.getElementById('fx-sl-input');
    const lotEl      = document.getElementById('fx-lot-input');
    const riskPct    = riskPctEl ? parseFloat(riskPctEl.value) || 1 : 1;
    const entryPrice = prices.ask;
    const slPrice    = slPxEl ? parseFloat(slPxEl.value) : 0;

    const riskAmt     = balance * (riskPct / 100);
    const riskDisplay = document.getElementById('fx-risk-amount-display');
    if (riskDisplay) riskDisplay.textContent = '$' + riskAmt.toFixed(2);

    // If SL is set, calculate recommended lot size
    if (slPrice > 0 && sym) {
      const priceDiff   = Math.abs(entryPrice - slPrice);
      const pipValue    = priceDiff * sym.contract_size;
      const recLot      = pipValue > 0 ? Math.min(sym.max_lot, Math.max(sym.min_lot, riskAmt / pipValue)) : 0;
      const recLotDisplay = document.getElementById('fx-rec-lot-display');
      if (recLotDisplay) recLotDisplay.textContent = recLot.toFixed(2) + ' lots';
      if (lotEl && recLot > 0) lotEl.value = recLot.toFixed(2);
      updateOrderPreview();
    }
  }

  // ── Mobile watchlist toggle ───────────────────────────────────────────────
  function toggleMobileWatchlist() {
    const wl = document.getElementById('fxsim-watchlist');
    if (wl) wl.classList.toggle('mobile-open');
  }

  // ════════════════════════════════════════════════════════════════════════
  // PENDING ORDERS — MODE TOGGLE, PLACEMENT, TABLE, CANCEL
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Toggle between Market and Pending order modes.
   * Market mode  → shows sell/buy buttons, hides pending fields.
   * Pending mode → shows pending fields + single submit, hides market buttons.
   * Preserves all existing market order functionality — no existing elements removed.
   */
  function setOrderMode(mode) {
    state.orderMode = mode;

    const isMarket = (mode === 'market');

    // Toggle mode buttons
    const mktBtn = document.getElementById('fx-mode-market');
    const pndBtn = document.getElementById('fx-mode-pending');
    if (mktBtn) mktBtn.classList.toggle('active', isMarket);
    if (pndBtn) pndBtn.classList.toggle('active', !isMarket);

    // Show/hide order panel sections
    const pendingFields = document.getElementById('fx-pending-fields');
    const marketBtns    = document.getElementById('fx-market-btns');
    const pendingBtns   = document.getElementById('fx-pending-btns');
    const orderPreview  = document.getElementById('fx-order-preview');

    if (pendingFields) pendingFields.style.display = isMarket ? 'none' : 'flex';
    if (marketBtns)    marketBtns.style.display    = isMarket ? ''     : 'none';
    if (pendingBtns)   pendingBtns.style.display   = isMarket ? 'none' : '';
    // Preview row (margin/commission) only meaningful for market mode
    if (orderPreview)  orderPreview.style.display  = isMarket ? ''     : 'none';

    // Clear any stale order message when switching modes
    const msgEl = document.getElementById('fx-order-msg');
    if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }
  }

  /**
   * Place a pending order.
   * Reads from: fx-pending-type, fx-lot-input, fx-pending-price,
   *             fx-sl-input, fx-tp-input, fx-pending-expiry.
   * POSTs to: /pending-order/place
   * Prevents duplicate submission via button disabled state.
   */
  async function placePendingOrder() {
    const msgEl = document.getElementById('fx-order-msg');
    const btn   = document.getElementById('fx-btn-pending-submit');

    // Clear previous message
    if (msgEl) { msgEl.style.display = 'none'; msgEl.textContent = ''; }

    // Read form values
    const orderType = document.getElementById('fx-pending-type')?.value;
    const lot       = parseFloat(document.getElementById('fx-lot-input')?.value);
    const target    = parseFloat(document.getElementById('fx-pending-price')?.value);
    const slVal     = document.getElementById('fx-sl-input')?.value;
    const tpVal     = document.getElementById('fx-tp-input')?.value;
    const expiryVal = document.getElementById('fx-pending-expiry')?.value;

    // Client-side validation — fast feedback before hitting the server
    if (!orderType) {
      return showPendingMsg('Select an order type.', false);
    }
    if (!lot || lot <= 0) {
      return showPendingMsg('Enter a valid lot size.', false);
    }
    if (!target || target <= 0) {
      return showPendingMsg('Enter a target price.', false);
    }

    // Build payload — only include optional fields if filled
    const payload = {
      symbol:       state.activeSymbol,
      type:         orderType,
      lot_size:     lot,
      target_price: target,
    };
    if (slVal && parseFloat(slVal) > 0) payload.sl = parseFloat(slVal);
    if (tpVal && parseFloat(tpVal) > 0) payload.tp = parseFloat(tpVal);
    if (expiryVal) {
      // datetime-local gives 'YYYY-MM-DDTHH:MM' — convert to ISO string
      payload.expires_at = new Date(expiryVal).toISOString();
    }

    // Prevent duplicate submission
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Placing…'; }

    try {
      const res = await api('/pending-order/place', 'POST', payload);

      if (res.success) {
        showPendingMsg(
          `✓ Order placed — Margin held: $${res.reserved_margin?.toFixed(2) ?? '—'}`,
          true
        );
        // Clear target price and expiry; keep lot/sl/tp for convenience
        const priceEl  = document.getElementById('fx-pending-price');
        const expiryEl = document.getElementById('fx-pending-expiry');
        if (priceEl)  priceEl.value  = '';
        if (expiryEl) expiryEl.value = '';

        // Refresh account (margin_used changed) and pending badge
        await loadAccount();
        await loadPendingOrders();
      } else {
        showPendingMsg(`✗ ${res.message || 'Could not place order.'}`, false);
      }
    } catch (e) {
      // Network/parse error — never leave UI stuck
      showPendingMsg('✗ Request failed. Check connection and try again.', false);
      console.error('[PropFirm] placePendingOrder error:', e);
    } finally {
      // Always re-enable button regardless of outcome
      if (btn) { btn.disabled = false; btn.textContent = '⏳ Place Pending Order'; }
    }
  }

  /** Show message in the order message element, styled by success/error. */
  function showPendingMsg(text, success) {
    const msgEl = document.getElementById('fx-order-msg');
    if (!msgEl) return;
    msgEl.style.display = 'block';
    msgEl.className     = 'fx-order-msg ' + (success ? 'success' : 'error');
    msgEl.textContent   = text;
  }

  /**
   * Load pending orders from REST API and render into the pending tab table.
   * Called when:
   *   - User clicks Pending tab (via switchTab)
   *   - After a successful placePendingOrder()
   *   - After a successful cancelPending()
   * Only loads if the pending tab is currently active (no background polling).
   */
  async function loadPendingOrders() {
    const tbody = document.getElementById('fx-pending-body');
    if (!tbody) return;

    // Show loading state immediately — prevents stale data visible during fetch
    tbody.innerHTML = '<tr class="fx-empty"><td colspan="11" style="color:var(--text-muted)">Loading…</td></tr>';

    try {
      const orders = await api('/pending-order/my');

      // Update badge count (pending status only)
      const pending = Array.isArray(orders)
        ? orders.filter(o => o.status === 'pending')
        : [];
      const badge = document.getElementById('fx-pending-count');
      if (badge) badge.textContent = pending.length;

      renderPendingTable(Array.isArray(orders) ? orders : []);
    } catch (e) {
      tbody.innerHTML = '<tr class="fx-empty"><td colspan="11" style="color:var(--red)">Failed to load orders. Try again.</td></tr>';
      console.error('[PropFirm] loadPendingOrders error:', e);
    }
  }

  /**
   * Render the pending orders table.
   * Shows all statuses (pending, filled, cancelled, expired, rejected) for
   * a complete order history. Pending orders get a Cancel button.
   */
  function renderPendingTable(orders) {
    const tbody = document.getElementById('fx-pending-body');
    if (!tbody) return;

    if (!orders.length) {
      tbody.innerHTML = '<tr class="fx-empty"><td colspan="11">No pending orders.</td></tr>';
      return;
    }

    // Status colour map — reuses existing CSS colour vars
    const statusColor = {
      pending:   'var(--yellow)',
      filled:    'var(--green)',
      cancelled: 'var(--text-muted)',
      expired:   'var(--text-muted)',
      rejected:  'var(--red)',
    };

    // Order type display labels — no ENUM exposed to user directly
    const typeLabel = {
      buy_limit:  'Buy Limit',
      sell_limit: 'Sell Limit',
      buy_stop:   'Buy Stop',
      sell_stop:  'Sell Stop',
    };
    const typeColor = {
      buy_limit:  'var(--green)',
      buy_stop:   'var(--green)',
      sell_limit: 'var(--red)',
      sell_stop:  'var(--red)',
    };

    tbody.innerHTML = orders.map(o => {
      const color     = statusColor[o.status] ?? 'var(--text)';
      const tLabel    = typeLabel[o.type]     ?? o.type;
      const tColor    = typeColor[o.type]     ?? 'var(--text)';
      const target    = parseFloat(o.target_price);
      const margin    = parseFloat(o.margin ?? 0);
      const sl        = o.sl  ? parseFloat(o.sl).toFixed(5)  : '—';
      const tp        = o.tp  ? parseFloat(o.tp).toFixed(5)  : '—';
      const expiry    = o.expires_at ? new Date(o.expires_at).toLocaleString()  : 'GTC';
      const placed    = new Date(o.created_at).toLocaleString();
      const targetFmt = fmt(target, o.symbol);

      // Cancel button only for pending orders
      const action = o.status === 'pending'
        ? `<button class="fx-cancel-pending-btn" onclick="fxTerminal.cancelPending(${o.id})"
                   title="Cancel this pending order">✕ Cancel</button>`
        : `<span style="color:${color};font-size:10px;font-weight:700;text-transform:uppercase">${o.status}</span>`;

      return `<tr data-order-id="${o.id}">
        <td>${o.id}</td>
        <td><strong style="color:var(--accent-gold);cursor:pointer"
            onclick="fxTerminal.selectSym('${o.symbol}')">${o.symbol}</strong></td>
        <td style="color:${tColor};font-weight:600">${tLabel}</td>
        <td>${o.lot_size}</td>
        <td style="font-family:var(--mono)">${targetFmt}</td>
        <td style="font-family:var(--mono);color:var(--red)">${sl}</td>
        <td style="font-family:var(--mono);color:var(--green)">${tp}</td>
        <td style="font-family:var(--mono)">$${margin.toFixed(2)}</td>
        <td style="font-size:10px;color:var(--text-muted)">${expiry}</td>
        <td style="font-size:10px;color:var(--text-muted)">${placed}</td>
        <td>${action}</td>
      </tr>`;
    }).join('');
  }

  /**
   * Cancel a pending order by ID.
   * Uses optimistic UI: removes row immediately, restores on failure.
   * Refreshes account (margin_used released) and reloads table.
   */
  async function cancelPending(orderId) {
    // Find and visually disable the cancel button immediately
    const row = document.querySelector(`tr[data-order-id="${orderId}"]`);
    const btn = row?.querySelector('.fx-cancel-pending-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }

    try {
      const res = await api(`/pending-order/${orderId}/cancel`, 'POST');

      if (res.success) {
        // Refresh account (margin released) then reload the full table
        await loadAccount();
        await loadPendingOrders();
      } else {
        // Restore button on failure — never leave it disabled
        if (btn) { btn.disabled = false; btn.textContent = '✕ Cancel'; }
        // Show error inline in the order message area
        showPendingMsg(`✗ ${res.message || 'Could not cancel order.'}`, false);
      }
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '✕ Cancel'; }
      showPendingMsg('✗ Request failed. Check connection and try again.', false);
      console.error('[PropFirm] cancelPending error:', e);
    }
  }

  // ── Tab switching (extended for pending tab) ──────────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.fx-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.fx-tab-content').forEach(el => el.classList.toggle('active', el.id === 'tab-' + name));
    if (name === 'history')      loadHistory();
    if (name === 'transactions') loadTransactions();
    if (name === 'stats')        loadStats();
    // Load pending orders only when tab is opened — no background polling
    if (name === 'pending')      loadPendingOrders();
  }

  // ── Page unload cleanup ────────────────────────────────────────────────────
  // Close SSE and intervals cleanly when user navigates away to avoid
  // dangling connections and memory leaks
  window.addEventListener('beforeunload', () => {
    stopSSE();
    if (state.priceInterval) clearInterval(state.priceInterval);
    if (state.posInterval)   clearInterval(state.posInterval);
  });

  return { placeOrder, closePos, refreshPositions, adjustLot, selectSym,
           saveSltp, onSltpFocus, onSltpBlur, onSltpKey,
           oneClickBuy, oneClickSell, calcRisk, toggleMobileWatchlist,
           partialClosePrompt,
           // Pending orders — exposed for onclick handlers in template
           setOrderMode, placePendingOrder, loadPendingOrders, cancelPending,
           loadMoreHistory,
           // SSE — exposed for debugging and admin tooling
           startSSE, stopSSE, startPollingFallback };
})();
