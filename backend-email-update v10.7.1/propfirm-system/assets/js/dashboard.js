/* ── PropFirm System — Dashboard + Challenges JS ──────────────────────────────── */
/* globals FXSIM, Chart */

// Apply saved theme immediately to prevent flash
(function() {
  const t = localStorage.getItem('fxsim_theme') || 'dark';
  document.documentElement.dataset.theme = t;
})();

const fxDash = (() => {
  'use strict';

  // Safe FXSIM access — fallback to REST URL detection if wp_localize_script failed
  const _fxsim   = (typeof FXSIM !== 'undefined') ? FXSIM : {};
  const API       = _fxsim.api   || (window.location.origin + '/wp-json/fxsim/v1');
  const nonce     = _fxsim.nonce || '';
  let state = { challenges: [], activeChallengeId: null, equityChart: null, plans: [] };

  // ── API helper ─────────────────────────────────────────────────────────────
  async function req(path, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce } };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(API + path, opts);
      // Surface HTTP errors (4xx/5xx) as structured error objects.
      // Without this check, a 403/500 JSON body would be treated as valid data
      // and silently fall through the caller's !plans.error guard.
      if (!r.ok) {
        let errBody = {};
        try { errBody = await r.json(); } catch (_) { /* non-JSON error body */ }
        return { error: errBody.message || errBody.code || r.status, status: r.status };
      }
      return r.json();
    } catch(e) { return { error: e.message }; }
  }

  function $$(id) { return document.getElementById(id); }
  function fmt$(n) { return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtPct(n) { return parseFloat(n || 0).toFixed(1) + '%'; }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function initDashboard() {
    if (!$$('fxsim-dashboard')) return;
    // Individual loaders run in parallel. A TypeError or unhandled rejection in any
    // one of them (e.g. loadRecentTrades) must not cancel the others — each loader
    // is already independent, but Promise.all rejects-fast on the first failure.
    // We wrap each in .catch() so all three always settle, then run Promise.all
    // on the wrapped versions so initDashboard itself never rejects unhandled.
    await Promise.all([
      loadAccountMetrics().catch(e => console.warn('[PropFirm] loadAccountMetrics:', e)),
      loadChallenges().catch(e      => console.warn('[PropFirm] loadChallenges:', e)),
      loadRecentTrades().catch(e    => console.warn('[PropFirm] loadRecentTrades:', e)),
    ]);
  }

  async function loadAccountMetrics() {
    const [acc, stats] = await Promise.all([req('/account'), req('/stats')]);

    // No active challenge — show onboarding state
    if (!acc || acc.no_challenge || acc.error) {
      const section = $$('fxdb-challenge-section');
      const empty   = $$('fxdb-empty');
      const cards   = $$('fxdb-metric-cards');
      if (section) section.style.display = 'none';
      if (empty)   { empty.style.display = ''; }
      if (cards) {
        cards.innerHTML = `
          <div class="fxdb-onboard-banner">
            <div class="fxdb-onboard-icon">🚀</div>
            <div>
              <h3>Welcome to PropFirm System</h3>
              <p>You don't have an active challenge yet. Purchase a challenge plan to get your funded account and start trading.</p>
            </div>
            <a href="${(typeof FXSIM_URLS !== 'undefined' ? FXSIM_URLS.challenges : '/challenges/')}" class="fxdb-btn-primary">Browse Challenge Plans →</a>
          </div>`;
      }
      return;
    }

    const equity   = parseFloat(acc.equity);
    const balance  = parseFloat(acc.balance);
    const floating = equity - balance;
    const pnlEl    = $$('m-pnl');

    setText('m-balance', fmt$(balance));
    if (pnlEl) {
      pnlEl.textContent = (floating >= 0 ? '+' : '') + fmt$(floating);
      pnlEl.style.color = floating >= 0 ? 'var(--green)' : 'var(--red)';
    }
    if (stats && !stats.error) {
      setText('m-winrate', fmtPct(stats.win_rate));
      setText('m-winrate-sub', `${stats.total_trades} closed trades`);
    }
  }

  async function loadChallenges() {
    const data = await req('/challenge/my');
    if (!data || data.error) return;
    state.challenges = data;

    const active = data.filter(c => c.status === 'active' || c.status === 'funded');
    setText('m-challenges', active.length);
    setText('m-challenges-sub', active.length === 1 ? '1 in progress' : active.length + ' in progress');

    if (!data.length) {
      show('fxdb-empty');
      hide('fxdb-challenge-section');
      return;
    }

    // Build challenge selector
    show('fxdb-challenge-section');
    hide('fxdb-empty');
    const sel = $$('fxdb-challenge-select');
    if (!sel) return;
    sel.innerHTML = data.map(c =>
      `<option value="${c.id}">[${c.status.toUpperCase()}] ${c.plan_name} — Phase ${c.phase}</option>`
    ).join('');
    sel.addEventListener('change', () => loadMetrics(parseInt(sel.value)));
    state.activeChallengeId = data[0].id;
    await loadMetrics(data[0].id);
  }

  async function loadMetrics(challengeId) {
    state.activeChallengeId = challengeId;
    const m = await req(`/challenge/${challengeId}/metrics`);
    if (!m || m.error) return;
    renderMetrics(m);
  }

  function renderMetrics(m) {
    // Status banner
    const banner = $$('fxdb-status-banner');
    if (banner) {
      if (m.status === 'failed') {
        banner.style.display = 'block';
        banner.className = 'fxdb-status-banner fxdb-banner-failed';
        banner.innerHTML = `<strong>❌ Challenge Failed</strong> — ${escHtml(m.breach_reason || 'Rule violation')}`;
      } else if (m.status === 'funded') {
        banner.style.display = 'block';
        banner.className = 'fxdb-status-banner fxdb-banner-funded';
        banner.innerHTML = '<strong>✅ Funded Account Active</strong> — Your funded account is now live on MT5. See your access details below.';
      } else if (m.status === 'passed') {
        banner.style.display = 'block';
        banner.className = 'fxdb-status-banner fxdb-banner-passed';
        banner.innerHTML = '<strong>🎉 All phases passed!</strong> Funded account being processed.';
      } else {
        banner.style.display = 'none';
      }
    }

    // ── Profit target ─────────────────────────────────────────────────────
    setText('rc-profit-cur', fmt$(m.current_profit));
    setText('rc-profit-tgt', fmt$(m.profit_target_val));
    setText('rc-profit-pct', fmtPct(m.profit_progress));
    setBar('rc-profit-bar', m.profit_progress, 'green');
    setBadge('rc-profit-badge', m.current_profit >= m.profit_target_val, 'REACHED', 'IN PROGRESS');

    // ── Max drawdown ──────────────────────────────────────────────────────
    setText('rc-maxdd-cur', fmt$(m.current_dd));
    setText('rc-maxdd-tgt', fmt$(m.max_dd_val));
    setText('rc-maxdd-rem', fmt$(m.dd_remaining));
    const ddPct = m.max_dd_progress;
    setBar('rc-maxdd-bar', ddPct, ddPct > 75 ? 'red-hot' : ddPct > 50 ? 'red' : 'yellow');
    setBadge('rc-maxdd-badge', ddPct < 100, 'SAFE', 'BREACHED', ddPct < 100);

    // ── Daily drawdown ────────────────────────────────────────────────────
    setText('rc-daily-cur', fmt$(m.current_daily_loss));
    setText('rc-daily-tgt', fmt$(m.daily_dd_val));
    const dailyPct = m.daily_dd_progress;
    setBar('rc-daily-bar', dailyPct, dailyPct > 75 ? 'red' : 'yellow');
    setBadge('rc-daily-badge', dailyPct < 100, 'SAFE', 'BREACHED', dailyPct < 100);

    // ── Trading days ──────────────────────────────────────────────────────
    setText('rc-days-done', m.trading_days_done);
    setText('rc-days-min',  m.min_trading_days);
    setText('rc-days-left', m.days_remaining + ' days');
    setBar('rc-days-bar', m.days_progress, 'cyan');
    setBadge('rc-days-badge', m.trading_days_done >= m.min_trading_days, 'MET', `${m.trading_days_done}/${m.min_trading_days}`);

    // ── Performance stats ─────────────────────────────────────────────────
    setText('ps-total',   m.total_trades);
    setText('ps-wr',      fmtPct(m.win_rate));
    setText('ps-pf',      m.profit_factor);
    const pnlEl = $$('ps-pnl');
    if (pnlEl) {
      pnlEl.textContent  = (m.net_pnl >= 0 ? '+' : '') + fmt$(m.net_pnl);
      pnlEl.style.color  = m.net_pnl >= 0 ? 'var(--green)' : 'var(--red)';
    }
    setText('ps-start',   fmt$(m.starting_balance));
    setText('ps-balance', fmt$(m.balance));
    setText('ps-phase',   `Phase ${m.phase}`);
    const statusEl = $$('ps-status');
    if (statusEl) {
      const colors = { active:'var(--accent)', funded:'var(--green)', failed:'var(--red)', passed:'var(--green)', suspended:'var(--yellow)' };
      statusEl.textContent  = m.status.charAt(0).toUpperCase() + m.status.slice(1);
      statusEl.style.color  = colors[m.status] || 'var(--text)';
    }

    // ── Actions ───────────────────────────────────────────────────────────
    const actionsEl = $$('fxdb-actions');
    if (actionsEl) {
      let btns = '';
      // Terminal button only for active (challenge phase) — NOT for funded
      if (m.status === 'active') {
        btns += `<a href="${(typeof FXSIM_URLS !== 'undefined' ? FXSIM_URLS.trading : '/trading/')}" target="_blank" rel="noopener" class="fxdb-btn-ghost fxdb-btn-sm">📈 Open Terminal ↗</a>`;
      }
      if (m.status === 'funded') {
        btns += `<button class="fxdb-btn-primary fxdb-btn-sm" onclick="fxDash.requestPayout(${m.challenge.id})">💰 Request Payout</button>`;
        const certUrl = (typeof FXSIM_URLS !== 'undefined' ? FXSIM_URLS.certificate : '/certificate/');
        btns += `<a href="${certUrl}" class="fxdb-btn-ghost fxdb-btn-sm" target="_blank">🏆 View Certificate</a>`;
      }
      if (m.status === 'failed') {
        btns += `<a href="${(typeof FXSIM_URLS !== 'undefined' ? FXSIM_URLS.challenges : '/challenges/')}" class="fxdb-btn-primary fxdb-btn-sm">🔄 New Challenge</a>`;
      }
      actionsEl.innerHTML = btns;
    }

    // ── MT5 details box (funded accounts only) ────────────────────────────
    const mt5Box = $$('fxdb-mt5-box');
    if (mt5Box) {
      if (m.status === 'funded' && m.challenge?.id) {
        mt5Box.style.display = 'block';
        loadMT5Details(m.challenge.id);
      } else {
        mt5Box.style.display = 'none';
      }
    }

    // ── Equity chart ──────────────────────────────────────────────────────
    renderEquityChart(m.equity_chart, m.starting_balance);
  }

  function renderEquityChart(data, startingBalance) {
    const canvas = $$('fxdb-equity-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Guard: data may be null, undefined, or non-array if the metrics endpoint
    // returned an error or the account has no snapshots yet.
    // Rendering a Chart with empty/null datasets causes an oversized blank canvas.
    if (!Array.isArray(data) || data.length === 0) return;

    // Guard: a single datapoint cannot form a visible line. Chart.js auto-scales
    // the y-axis from 0 → balance, placing the lone point at the very top edge.
    // Show a placeholder instead and wait for a second day's snapshot.
    if (data.length < 2) {
      if (state.equityChart) { state.equityChart.destroy(); state.equityChart = null; }
      const wrap = canvas.parentElement;
      if (wrap) wrap.innerHTML =
        '<div style="height:100%;display:flex;align-items:center;justify-content:center;' +
        'flex-direction:column;gap:6px;color:var(--text-muted);font-size:12px;text-align:center;padding:16px">' +
        '<span style="font-size:24px">📈</span>' +
        '<span>Equity curve available after your first trading day.</span>' +
        '</div>';
      return;
    }

    const labels  = data.map(d => d.date);
    const values  = data.map(d => d.balance);
    const isProfit = values.length && values[values.length - 1] >= startingBalance;
    const lineColor = isProfit ? '#00e5a0' : '#ff4757';
    const fillColor = isProfit ? 'rgba(0,229,160,0.08)' : 'rgba(255,71,87,0.08)';

    // y-axis suggested bounds: pad ±5 % around starting_balance so small daily
    // fluctuations fill the chart vertically instead of being crushed near zero.
    // Chart.js treats these as suggestions — actual data outside the range expands
    // the axis automatically, so large drawdowns or gains are never clipped.
    const base        = startingBalance > 0 ? startingBalance : (values[0] || 0);
    const yPad        = base * 0.05;
    const dataMin     = Math.min(...values);
    const dataMax     = Math.max(...values);
    const ySuggestMin = Math.min(dataMin, base - yPad);
    const ySuggestMax = Math.max(dataMax, base + yPad);

    if (state.equityChart) state.equityChart.destroy();

    state.equityChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: lineColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.35,
          pointRadius: labels.length > 20 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ' $' + ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })
            }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(26,45,74,0.6)' }, ticks: { color: '#4a6580', maxTicksLimit: 8 } },
          y: {
            grid: { color: 'rgba(26,45,74,0.6)' },
            ticks: { color: '#4a6580', callback: v => '$' + v.toLocaleString() },
            suggestedMin: ySuggestMin,
            suggestedMax: ySuggestMax,
          }
        }
      }
    });
  }

  async function loadRecentTrades() {
    const data  = await req('/history');
    const tbody = $$('fxdb-trades-body');
    if (!tbody) return;
    if (!data || data.error) return;

    // /history returns { trades: [...], next_cursor: N, has_more: bool }
    // It previously returned a flat array — guard both shapes for backwards compat.
    const trades = Array.isArray(data) ? data : (Array.isArray(data.trades) ? data.trades : []);

    if (!trades.length) {
      tbody.innerHTML = '<tr class="fxdb-tr-empty"><td colspan="7">No trades yet.</td></tr>';
      return;
    }
    tbody.innerHTML = trades.slice(0, 10).map(t => {
      const pnl = parseFloat(t.pnl);
      return `<tr>
        <td><strong>${t.symbol}</strong></td>
        <td style="color:${t.type==='buy'?'var(--green)':'var(--red)'}">${t.type.toUpperCase()}</td>
        <td>${t.lot_size}</td>
        <td>${parseFloat(t.open_price).toFixed(5)}</td>
        <td>${parseFloat(t.close_price).toFixed(5)}</td>
        <td style="color:${pnl>=0?'var(--green)':'var(--red)'};font-weight:600">${(pnl>=0?'+':'') + fmt$(pnl)}</td>
        <td style="color:var(--text-muted)">${new Date(t.closed_at).toLocaleDateString()}</td>
      </tr>`;
    }).join('');
  }

  async function requestPayout(challengeId) {
    // Build a clean inline modal instead of browser prompt()
    const saved = await req('/payout-method');
    const savedMethod  = saved?.method  || '';
    const savedAddress = saved?.address || '';
    const savedDetails = saved?.details || '';

    const methods = ['Wise','USDT (TRC20)','USDT (BEP20)','Other'];
    const opts    = methods.map(m =>
      `<option value="${m}" ${m === savedMethod ? 'selected' : ''}>${m}</option>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id        = 'fxpayout-overlay';
    overlay.className = 'fxdb-modal-overlay';
    overlay.innerHTML = `
      <div class="fxdb-modal-box" style="min-width:360px;max-width:440px;width:100%">
        <h3 style="margin:0 0 6px">💸 Request Payout</h3>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 18px">
          Profit will be calculated at time of processing. Admin reviews within 1–3 business days.
        </p>
        <div style="display:grid;gap:12px">
          <div>
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px">Payment Method</label>
            <select id="fxpo-method" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px;font-size:13px">
              <option value="">Select…</option>${opts}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px">Wallet / Account Address</label>
            <input id="fxpo-address" type="text" value="${escHtml(savedAddress)}"
              placeholder="Email, wallet address, IBAN…"
              style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px;font-size:13px;box-sizing:border-box">
          </div>
          <div>
            <label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px">Additional Details <small>(optional)</small></label>
            <input id="fxpo-details" type="text" value="${escHtml(savedDetails)}"
              placeholder="Account name, memo, network…"
              style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px;font-size:13px;box-sizing:border-box">
          </div>
          <div style="display:flex;gap:8px;margin-top:4px">
            <button id="fxpo-submit-btn" class="fxdb-btn-primary" style="flex:1;justify-content:center">
              Submit Request
            </button>
            <button class="fxdb-btn-ghost" style="flex:0 0 auto"
              onclick="document.getElementById('fxpayout-overlay').remove()">
              Cancel
            </button>
          </div>
          <div id="fxpo-msg" style="font-size:12px;font-weight:600"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('fxpo-submit-btn').onclick = async () => {
      const method  = document.getElementById('fxpo-method')?.value  || '';
      const address = document.getElementById('fxpo-address')?.value || '';
      const details = document.getElementById('fxpo-details')?.value || '';
      const msgEl   = document.getElementById('fxpo-msg');
      const btn     = document.getElementById('fxpo-submit-btn');

      if (!method || !address) {
        if (msgEl) { msgEl.textContent = 'Method and address are required.'; msgEl.style.color = 'var(--red)'; }
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

      const res = await req(`/challenge/${challengeId}/payout`, 'POST', { method, address, details });
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Request'; }

      if (res?.success) {
        overlay.remove();
        // Show confirmation in announcement area
        const el = $$('fxdb-announcement');
        if (el) {
          el.style.display = 'block';
          el.innerHTML = `<div style="background:rgba(0,229,160,.1);border-bottom:2px solid var(--green);
            padding:10px 24px;display:flex;align-items:center;justify-content:space-between">
            <span style="color:var(--green);font-size:13px;font-weight:700">
              ✅ Payout requested — your share: ${fmt$(res.trader_amount)}. Admin review within 1–3 business days.
            </span>
            <button onclick="this.parentElement.parentElement.style.display='none'"
              style="background:none;border:none;color:var(--green);cursor:pointer;font-size:18px">✕</button>
          </div>`;
        }
        // Reload metrics to reflect pending payout
        await loadMetrics();
      } else {
        if (msgEl) { msgEl.textContent = '✗ ' + (res?.message || 'Request failed.'); msgEl.style.color = 'var(--red)'; }
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHALLENGES PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function initChallenges() {
    // Run on challenges page OR anywhere plans grid exists
    if (!$$('fxsim-challenges') && !$$('fxch-plans-grid')) return;
    await Promise.all([loadPlans(), loadChallengeHistory(), loadPaymentOrders()]);
  }

  async function loadPaymentOrders() {
    const data  = await req('/payment/my-orders');
    const tbody = $$('fxch-orders-body');
    if (!tbody || !data || data.error) return;
    if (!data.length) return;
    const sc = { pending:'var(--yellow)', approved:'var(--green)', rejected:'var(--red)', expired:'var(--text-muted)' };
    tbody.innerHTML = data.map(o => `<tr>
      <td><strong>${escHtml(o.plan_name)}</strong><br><small style="color:var(--text-muted)">$${parseFloat(o.account_size).toLocaleString()}</small></td>
      <td style="font-family:var(--mono);font-weight:700">$${parseFloat(o.amount).toFixed(2)}</td>
      <td style="text-transform:capitalize">${o.gateway}</td>
      <td><span style="color:${sc[o.status]||'var(--text)'};font-weight:700;text-transform:uppercase;font-size:11px">${o.status}</span>
          ${o.status==='pending' ? '<br><small style="color:var(--text-muted)">Awaiting admin review</small>' : ''}
          ${o.admin_note ? `<br><small style="color:var(--text-muted)" title="${escHtml(o.admin_note)}">Note: ${escHtml(o.admin_note.substring(0,40))}${o.admin_note.length>40?'…':''}</small>` : ''}</td>
      <td style="color:var(--text-muted);font-size:11px">${new Date(o.created_at).toLocaleString()}</td>
      <td style="font-size:11px;color:var(--text-muted)">${o.proof_url ? '<span style="color:var(--green)">✓ Proof submitted</span>' : '—'}</td>
    </tr>`).join('');
  }

  async function loadPlans() {
    const grid = $$('fxch-plans-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="fxdb-loading">Loading programs…</div>';

    let plans = null;
    try {
      plans = await req('/challenge/plans');
    } catch(e) {
      grid.innerHTML = '<div class="fxdb-empty-small">Unable to load plans. Please refresh the page.</div>';
      return;
    }

    state.plans = plans || [];

    if (!plans || plans.error || !Array.isArray(plans) || !plans.length) {
      grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">
        <div style="font-size:40px;margin-bottom:12px">📋</div>
        <p>No challenge programs available yet.</p>
        <p style="font-size:13px">Please check back soon or contact support.</p>
      </div>`;
      return;
    }

    grid.innerHTML = plans.map((p, i) => {
      const isFeatured = plans.length >= 2 && i === Math.floor(plans.length / 2);
      return `
      <div class="fxch-plan-card ${isFeatured ? 'featured' : ''}" style="animation-delay:${i * .08}s">
        ${isFeatured ? '<div class="fxch-plan-tag">MOST POPULAR</div>' : ''}
        <div class="fxch-plan-name">${escHtml(p.name)}</div>
        <div class="fxch-plan-size">$${Number(p.account_size).toLocaleString()}</div>
        <div class="fxch-plan-price">${parseFloat(p.price) > 0 ? '$' + parseFloat(p.price).toFixed(0) : '<span style="color:var(--green)">FREE</span>'}</div>
        <ul class="fxch-plan-rules">
          <li>Phase 1 Target: <strong>${p.p1_profit_target}%</strong></li>
          <li>Phase 2 Target: <strong>${p.p2_profit_target}%</strong></li>
          <li>Daily Drawdown: <strong>${p.p1_daily_dd}%</strong></li>
          <li>Max Drawdown: <strong>${p.p1_max_dd}%</strong></li>
          <li>Min. Trading Days: <strong>${p.p1_min_days} days</strong></li>
          <li>Leverage: <strong>1:${p.max_leverage}</strong></li>
          <li class="fxch-plan-split">Profit Split: <strong>${p.funded_profit_split}%</strong></li>
        </ul>
        <button class="fxdb-btn-primary fxch-start-btn" onclick="fxDash.openStartModal(${p.id})">
          Start Challenge →
        </button>
      </div>`;
    }).join('');
  }

  async function loadChallengeHistory() {
    const data = await req('/challenge/my');
    const tbody = $$('fxch-history-body');
    if (!tbody || !data || data.error) return;
    if (!data.length) return;
    const statusColor = { active:'var(--accent)', funded:'var(--green)', failed:'var(--red)', passed:'var(--green)', suspended:'var(--yellow)' };
    tbody.innerHTML = data.map(c => `<tr>
      <td>${escHtml(c.plan_name)}</td>
      <td>${fmt$(c.account_size)}</td>
      <td>Phase ${c.phase}</td>
      <td style="color:${statusColor[c.status]||'var(--text)'};font-weight:700">${c.status.toUpperCase()}</td>
      <td style="color:var(--text-muted)">${new Date(c.created_at).toLocaleDateString()}</td>
      <td><a href="/dashboard/" class="fxdb-link">View →</a></td>
    </tr>`).join('');
  }

  function openStartModal(planId) {
    const plan = state.plans.find(p => parseInt(p.id) === planId);
    if (!plan) return;
    const modal      = $$('fxch-modal');
    const titleEl    = $$('fxch-modal-title');
    const bodyEl     = $$('fxch-modal-body');
    const actionsEl  = modal ? modal.querySelector('.fxdb-modal-actions') : null;
    const msgEl      = $$('fxch-modal-msg');
    if (!modal) return;

    if (titleEl) titleEl.textContent = plan.name;
    if (msgEl) { msgEl.textContent = ''; msgEl.style.color = ''; }

    const isPaid = parseFloat(plan.price) > 0;

    // ── Step 1: Plan summary ──────────────────────────────────────────────
    const showStep1 = () => {
      if (titleEl) titleEl.textContent = plan.name;
      if (bodyEl) bodyEl.innerHTML = `
        <div class="fxch-modal-summary">
          <div class="fxch-modal-row"><span>Account Size</span><strong>${fmt$(plan.account_size)}</strong></div>
          <div class="fxch-modal-row"><span>Phase 1 Target</span><strong>${plan.p1_profit_target}%</strong></div>
          <div class="fxch-modal-row"><span>Max Drawdown</span><strong>${plan.p1_max_dd}%</strong></div>
          <div class="fxch-modal-row"><span>Daily Drawdown</span><strong>${plan.p1_daily_dd}%</strong></div>
          <div class="fxch-modal-row"><span>Profit Split</span><strong>${plan.funded_profit_split}%</strong></div>
          ${isPaid ? `<div class="fxch-modal-row fxch-price-row"><span>Challenge Fee</span><strong style="color:var(--accent);font-size:18px">${fmt$(plan.price)}</strong></div>` : '<div class="fxch-modal-row"><span>Price</span><strong style="color:var(--green)">FREE</strong></div>'}
        </div>`;
      if (actionsEl) actionsEl.innerHTML = `
        <button class="fxdb-btn-primary" id="fxch-confirm-btn">
          ${isPaid ? '💳 Pay with Card (Stripe)' : '🚀 Activate Challenge'}
        </button>
        ${isPaid ? `<button class="fxdb-btn-ghost" id="fxch-manual-btn" style="margin-top:6px;width:100%;justify-content:center">Manual Payment</button>` : ''}
        <button class="fxdb-btn-ghost" onclick="document.getElementById('fxch-modal').style.display='none'" style="margin-top:6px">Cancel</button>`;
      const btn = $$('fxch-confirm-btn');
      if (btn) btn.onclick = () => isPaid ? handleStripePay() : activateFree();
      const manualBtn = $$('fxch-manual-btn');
      if (manualBtn) manualBtn.onclick = () => showStep2();
    };

    // ── Step 2: Payment instructions + proof upload ───────────────────────
    const showStep2 = async () => {
      if (titleEl) titleEl.textContent = 'Submit Payment';
      if (msgEl) msgEl.textContent = '';

      // Fetch payment display config — /payment/config is authenticated-user-safe.
      // /admin/whitelabel (previously called here) is admin-only and returned 403
      // for regular users, causing empty crypto address and bank details.
      let instructions = 'Please transfer the challenge fee and upload proof below.';
      let bankDetails  = '';
      let cryptoAddr   = '';
      let hasCoinpayments = false;
      try {
        const pc = await req('/payment/config');
        if (pc && !pc.error) {
          instructions    = pc.instructions    || instructions;
          cryptoAddr      = pc.crypto_address  || '';
          hasCoinpayments = !!pc.has_coinpayments;
        }
      } catch(e) {}

      if (bodyEl) bodyEl.innerHTML = `
        <div style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:var(--r-md);padding:14px 16px;margin-bottom:16px">
          <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Amount Due</div>
          <div style="font-size:24px;font-weight:800;color:var(--text);font-family:var(--mono)">${fmt$(plan.price)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${plan.name}</div>
        </div>
        ${hasCoinpayments ? `<div style="background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.3);border-radius:var(--r-md);padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--text-dim)">
          🪙 <strong style="color:var(--accent)">Crypto accepted (manual verification)</strong> — send payment to the wallet address below, then upload a screenshot of your transaction as proof. The admin will verify your payment manually and activate your account (typically within 24 hours). There is no automated crypto checkout.
        </div>` : ''}
        ${instructions ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">${escHtml(instructions)}</p>` : ''}
        ${bankDetails ? `<div style="background:var(--card2);border:1px solid var(--border2);border-radius:var(--r-md);padding:10px 12px;margin-bottom:12px;font-size:12px;font-family:var(--mono);color:var(--text-dim);white-space:pre-wrap">${escHtml(bankDetails)}</div>` : ''}
        ${cryptoAddr ? `<div style="background:var(--card2);border:1px solid var(--border2);border-radius:var(--r-md);padding:10px 12px;margin-bottom:12px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Crypto Address</div>
          <code style="font-size:12px;color:var(--accent);word-break:break-all">${escHtml(cryptoAddr)}</code>
        </div>` : ''}
        <div style="margin-top:14px">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">
            Upload Payment Screenshot / Receipt *
          </label>
          <input type="file" id="fxch-proof-file" accept="image/*,.pdf"
            style="display:block;width:100%;font-size:13px;color:var(--text-dim);
                   background:var(--card2);border:1px solid var(--border2);
                   border-radius:var(--r-md);padding:8px 10px;cursor:pointer">
          <p style="font-size:11px;color:var(--text-muted);margin-top:4px">JPG, PNG, WebP, or PDF · Max 5MB</p>
        </div>
        <div style="margin-top:10px">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px">
            Transaction ID / Notes (optional)
          </label>
          <input type="text" id="fxch-proof-notes" placeholder="e.g. TxID: 0xabc123 or bank ref..."
            style="width:100%;background:var(--card2);border:1px solid var(--border2);
                   border-radius:var(--r-md);color:var(--text);padding:8px 10px;
                   font-size:13px;outline:none;font-family:var(--font)">
        </div>`;

      if (actionsEl) actionsEl.innerHTML = `
        <button class="fxdb-btn-primary" id="fxch-submit-proof-btn">📤 Submit Payment Proof</button>
        <button class="fxdb-btn-ghost" onclick="fxDash._showStep1(${planId})">← Back</button>`;

      const submitBtn = $$('fxch-submit-proof-btn');
      if (submitBtn) submitBtn.onclick = () => submitProof(planId, plan);
    };

    // ── Step 3: Pending confirmation ──────────────────────────────────────
    const showStep3 = () => {
      if (titleEl) titleEl.textContent = 'Payment Submitted';
      if (bodyEl) bodyEl.innerHTML = `
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:48px;margin-bottom:14px">⏳</div>
          <h3 style="color:var(--text);font-size:18px;margin-bottom:8px">Awaiting Admin Review</h3>
          <p style="color:var(--text-muted);font-size:14px;line-height:1.7;margin-bottom:16px">
            Your payment proof has been submitted successfully.<br>
            We'll activate your challenge account within <strong style="color:var(--accent)">24 hours</strong>.
          </p>
          <p style="font-size:12px;color:var(--text-muted)">You'll receive an email confirmation once approved.</p>
        </div>`;
      if (actionsEl) actionsEl.innerHTML = `
        <button class="fxdb-btn-primary" onclick="document.getElementById('fxch-modal').style.display='none'">Got it</button>`;
    };

    // ── Submit proof ──────────────────────────────────────────────────────
    const submitProof = async (pId, pPlan) => {
      const fileInput  = $$('fxch-proof-file');
      const notesInput = $$('fxch-proof-notes');
      const submitBtn  = $$('fxch-submit-proof-btn');
      if (!fileInput || !fileInput.files[0]) {
        if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Please select a payment screenshot to upload.'; }
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }
      if (msgEl) msgEl.textContent = '';

      // Step 1: create order
      const orderRes = await req('/payment/create', 'POST', { plan_id: pId, gateway: 'manual' });
      if (!orderRes.success) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📤 Submit Payment Proof'; }
        if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = orderRes.message || 'Failed to create order.'; }
        return;
      }

      // Step 2: upload proof
      const formData = new FormData();
      formData.append('order_id', orderRes.order_id);
      formData.append('notes', notesInput ? notesInput.value : '');
      formData.append('proof', fileInput.files[0]);
      formData.append('_wpnonce', FXSIM.nonce);

      try {
        const r = await fetch(FXSIM.api + '/payment/submit-proof', {
          method: 'POST',
          headers: { 'X-WP-Nonce': FXSIM.nonce },
          body: formData,
        });
        const proofRes = await r.json();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📤 Submit Payment Proof'; }
        if (proofRes.success) {
          showStep3();
        } else {
          if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = proofRes.message || 'Upload failed. Try again.'; }
        }
      } catch(e) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '📤 Submit Payment Proof'; }
        if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Network error. Please try again.'; }
      }
    };

    // ── Stripe pay ────────────────────────────────────────────────────────
    const handleStripePay = async () => {
      const btn = $$('fxch-confirm-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to Stripe…'; }
      if (msgEl) msgEl.textContent = '';
      const res = await req('/payment/stripe-checkout', 'POST', { plan_id: planId });
      if (res.success && res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        if (btn) { btn.disabled = false; btn.textContent = '💳 Pay with Card (Stripe)'; }
        // Stripe not configured — fall back to manual
        if (res.message && res.message.includes('not configured')) {
          showStep2();
        } else {
          if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = res.message || 'Stripe unavailable. Use manual payment.'; }
          setTimeout(() => showStep2(), 1500);
        }
      }
    };

    // ── Free plan activation ──────────────────────────────────────────────
    const activateFree = async () => {
      const btn = $$('fxch-confirm-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Activating…'; }
      const res = await req('/challenge/start', 'POST', { plan_id: planId });
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Activate Challenge'; }
      if (res.success) {
        modal.style.display = 'none';
        window.location.href = (typeof FXSIM_URLS !== 'undefined' ? FXSIM_URLS.dashboard : '/dashboard/');
      } else {
        if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = res.message || 'Error activating challenge.'; }
      }
    };

    // Expose step1 for Back button
    fxDash._showStep1 = (id) => { state.plans.find(p=>parseInt(p.id)===id) && openStartModal(id); };

    modal.style.display = 'flex';
    showStep1();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setText(id, val) { const el = $$(id); if (el) el.textContent = val; }
  function show(id) { const el = $$(id); if (el) el.style.display = ''; }
  function hide(id) { const el = $$(id); if (el) el.style.display = 'none'; }
  function escHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  function setBar(id, pct, color) {
    const el = $$(id);
    if (!el) return;
    const w = Math.min(100, Math.max(0, pct));
    el.style.width = w + '%';
    el.className = 'fxdb-progress-fill ' + (color || 'cyan');
  }

  function setBadge(id, passed, passLabel, failLabel, isGood = null) {
    const el = $$(id);
    if (!el) return;
    el.textContent  = passed ? passLabel : failLabel;
    el.className    = 'fxdb-rule-badge ' + ((isGood !== null ? isGood : passed) ? 'badge-ok' : 'badge-warn');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATISTICS PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function initStatistics() {
    if (!$$('fxsim-statistics')) return;
    const data = await req('/stats/full');
    if (!data || data.no_challenge || data.error) {
      show('fxst-no-challenge'); hide('fxst-content'); return;
    }
    show('fxst-content'); hide('fxst-no-challenge');

    const kpiEl = $$('fxst-kpis');
    if (kpiEl) kpiEl.innerHTML = [
      ['Total Trades', data.total_trades, 'var(--text)'],
      ['Win Rate', fmtPct(data.win_rate), data.win_rate >= 50 ? 'var(--green)' : 'var(--red)'],
      ['Profit Factor', data.profit_factor, data.profit_factor >= 1 ? 'var(--green)' : 'var(--red)'],
      ['Net P&L', (data.net_pnl >= 0 ? '+' : '') + fmt$(data.net_pnl), data.net_pnl >= 0 ? 'var(--green)' : 'var(--red)'],
      ['Best Trade', '+' + fmt$(data.best_trade), 'var(--green)'],
      ['Worst Trade', fmt$(data.worst_trade), 'var(--red)'],
      ['Max Drawdown', fmtPct(data.max_drawdown_pct), 'var(--red)'],
      ['Avg Win', fmt$(data.avg_win), 'var(--green)'],
    ].map(([label, val, color]) =>
      `<div class="fxst-kpi-card"><span>${label}</span><strong style="color:${color}">${val}</strong></div>`
    ).join('');

    if (data.equity_curve?.length && typeof Chart !== 'undefined') {
      const ctx = $$('fxst-equity-chart');
      if (ctx) {
        // Destroy any existing Chart instance on this canvas before re-creating.
        // Without this, navigating away and back stacks multiple Chart instances,
        // causing the canvas height to grow unboundedly.
        const existing = Chart.getChart(ctx);
        if (existing) existing.destroy();

        // A single datapoint cannot form a visible line — show placeholder instead.
        if (data.equity_curve.length < 2) {
          const wrap = ctx.parentElement;
          if (wrap) wrap.innerHTML =
            '<div style="height:100%;display:flex;align-items:center;justify-content:center;' +
            'flex-direction:column;gap:6px;color:var(--text-muted);font-size:12px;text-align:center;padding:16px">' +
            '<span style="font-size:24px">📈</span>' +
            '<span>Equity curve available after your first trading day.</span>' +
            '</div>';
        } else {
          const vals   = data.equity_curve.map(d => d.balance);
          const isUp   = vals[vals.length - 1] >= (vals[0] || 0);
          // Pad y-axis ±5 % around the first snapshot (= starting balance on day 1)
          // so small fluctuations fill the chart rather than being crushed near zero.
          const base        = vals[0] || 0;
          const yPad        = base * 0.05;
          const ySuggestMin = Math.min(Math.min(...vals), base - yPad);
          const ySuggestMax = Math.max(Math.max(...vals), base + yPad);
          new Chart(ctx, {
            type: 'line',
            data: { labels: data.equity_curve.map(d => d.date), datasets: [{ data: vals, borderColor: isUp ? '#00e5a0' : '#ff4757', backgroundColor: isUp ? 'rgba(0,229,160,.07)' : 'rgba(255,71,87,.07)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' $' + c.parsed.y.toFixed(2) } } }, scales: { x: { grid: { color: 'rgba(26,45,74,.5)' }, ticks: { color: '#4a6580', maxTicksLimit: 6 } }, y: { grid: { color: 'rgba(26,45,74,.5)' }, ticks: { color: '#4a6580', callback: v => '$' + v.toLocaleString() }, suggestedMin: ySuggestMin, suggestedMax: ySuggestMax } } }
          });
        }
      }
    }

    if (typeof Chart !== 'undefined') {
      const ctx2 = $$('fxst-winloss-chart');
      if (ctx2 && data.total_trades > 0) {
        const existing2 = Chart.getChart(ctx2);
        if (existing2) existing2.destroy();
        new Chart(ctx2, { type: 'doughnut', data: { labels: ['Wins','Losses'], datasets: [{ data: [data.wins, data.losses], backgroundColor: ['#00e5a0','#ff4757'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#8ba4c0', font: { size: 12 } } } } } });
      }
    }

    const symBody = $$('fxst-symbol-body');
    if (symBody) symBody.innerHTML = Object.entries(data.by_symbol || {}).map(([sym, s]) => {
      const pnl = parseFloat(s.pnl);
      return `<tr><td><strong>${sym}</strong></td><td>${s.trades}</td><td>${s.trades ? ((s.wins/s.trades)*100).toFixed(1)+'%' : '0%'}</td><td style="color:${pnl>=0?'var(--green)':'var(--red)'};font-weight:600">${(pnl>=0?'+':'')}${fmt$(pnl)}</td></tr>`;
    }).join('') || '<tr class="fxdb-tr-empty"><td colspan="4">No trades yet</td></tr>';

    const metricsEl = $$('fxst-metrics');
    if (metricsEl) metricsEl.innerHTML = [
      ['Wins', data.wins], ['Losses', data.losses], ['Avg Win', fmt$(data.avg_win)], ['Avg Loss', fmt$(data.avg_loss)],
      ['Best Trade', '+'+fmt$(data.best_trade)], ['Worst Trade', fmt$(data.worst_trade)],
      ['Max Consec. Wins', data.max_consec_wins], ['Max Consec. Losses', data.max_consec_losses],
      ['Gross Profit', '+'+fmt$(data.gross_profit)], ['Gross Loss', '-'+fmt$(data.gross_loss)],
    ].map(([k,v]) => `<div class="fxdb-stat-row"><span>${k}</span><strong>${v}</strong></div>`).join('');

    const trBody = $$('fxst-trades-body');
    if (trBody && data.trades) trBody.innerHTML = data.trades.slice(-20).reverse().map(t => {
      const pnl = parseFloat(t.pnl);
      return `<tr><td><strong>${t.symbol}</strong></td><td style="color:${t.type==='buy'?'var(--green)':'var(--red)'}">${t.type.toUpperCase()}</td><td>${t.lot_size}</td><td>${parseFloat(t.open_price).toFixed(5)}</td><td>${parseFloat(t.close_price).toFixed(5)}</td><td style="color:${pnl>=0?'var(--green)':'var(--red)'};font-weight:600">${(pnl>=0?'+':'')}${fmt$(pnl)}</td><td style="color:var(--text-muted)">${new Date(t.closed_at).toLocaleDateString()}</td></tr>`;
    }).join('') || '<tr class="fxdb-tr-empty"><td colspan="7">No trades yet</td></tr>';

    // Also load advanced analytics section (non-blocking — runs in parallel)
    loadAdvancedStats();
  }

  // ── Advanced analytics (R/R, heatmaps, drawdown) ──────────────────────────
  async function loadAdvancedStats() {
    if (!$$('fxst-advanced')) return;
    const data = await req('/stats/advanced');
    if (!data || data.no_challenge || data.error || !data.total_trades) return;

    show('fxst-advanced');

    // Average R:R
    setText('fxst-avg-rr', data.avg_rr ? data.avg_rr + ':1' : 'N/A');

    // R:R scatter — last 50 trades
    if (typeof Chart !== 'undefined' && data.rr_list?.length) {
      const rrCtx = $$('fxst-rr-chart');
      if (rrCtx) {
        const color = data.avg_rr >= 1 ? '#00e5a0' : '#ffd32a';
        new Chart(rrCtx, {
          type: 'bar',
          data: {
            labels: data.rr_list.map((_, i) => 'T' + (i + 1)),
            datasets: [{ label: 'R:R', data: data.rr_list,
              backgroundColor: data.rr_list.map(v => v >= 1 ? 'rgba(0,229,160,.7)' : 'rgba(255,71,87,.7)'),
              borderRadius: 2 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              annotation: { annotations: { line1: { type: 'line', yMin: 1, yMax: 1,
                borderColor: 'rgba(255,211,42,.5)', borderDash: [4,4], borderWidth: 1 } } } },
            scales: {
              x: { grid: { color: 'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580', maxTicksLimit:10 } },
              y: { grid: { color: 'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580' }, min: 0 },
            },
          },
        });
      }
    }

    // Drawdown curve
    if (typeof Chart !== 'undefined' && data.drawdown_curve?.length) {
      const ddCtx = $$('fxst-dd-chart');
      if (ddCtx) {
        new Chart(ddCtx, {
          type: 'line',
          data: {
            labels: data.drawdown_curve.map(d => d.date),
            datasets: [{ label: 'Drawdown %',
              data: data.drawdown_curve.map(d => d.drawdown_pct),
              borderColor: '#ff4757', backgroundColor: 'rgba(255,71,87,.08)',
              fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: {
              callbacks: { label: c => ' ' + c.parsed.y.toFixed(2) + '% drawdown' },
            }},
            scales: {
              x: { grid: { color:'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580', maxTicksLimit:6 } },
              y: { grid: { color:'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580',
                callback: v => v + '%' }, reverse: false },
            },
          },
        });
      }
    }

    // Trading hours bar chart
    if (typeof Chart !== 'undefined' && data.hours) {
      const hCtx = $$('fxst-hours-chart');
      if (hCtx) {
        new Chart(hCtx, {
          type: 'bar',
          data: {
            labels: data.hours.map(h => h.hour + ':00'),
            datasets: [
              { label: 'P&L ($)', data: data.hours.map(h => h.pnl), yAxisID: 'y',
                backgroundColor: data.hours.map(h => h.pnl >= 0 ? 'rgba(0,229,160,.7)' : 'rgba(255,71,87,.7)'),
                borderRadius: 2 },
              { label: 'Trades', data: data.hours.map(h => h.trades), yAxisID: 'y2',
                type: 'line', borderColor: 'rgba(0,212,255,.6)', fill: false,
                tension: 0.3, pointRadius: 2, borderWidth: 1.5 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { color:'#8ba4c0', font:{size:11} } } },
            scales: {
              x: { grid: { color:'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580', maxRotation: 45 } },
              y:  { grid: { color:'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580' }, position:'left' },
              y2: { grid: { display:false }, ticks: { color:'#4a6580' }, position:'right' },
            },
          },
        });
      }
    }

    // Trading days bar chart
    if (typeof Chart !== 'undefined' && data.days) {
      const dCtx = $$('fxst-days-chart');
      if (dCtx) {
        new Chart(dCtx, {
          type: 'bar',
          data: {
            labels: data.days.filter(d => d.dow >= 2 && d.dow <= 6).map(d => d.name),
            datasets: [{
              label: 'Net P&L ($)',
              data: data.days.filter(d => d.dow >= 2 && d.dow <= 6).map(d => d.pnl),
              backgroundColor: data.days.filter(d => d.dow >= 2 && d.dow <= 6)
                .map(d => d.pnl >= 0 ? 'rgba(0,229,160,.7)' : 'rgba(255,71,87,.7)'),
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display:false } },
            scales: {
              x: { grid: { color:'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580' } },
              y: { grid: { color:'rgba(26,45,74,.4)' }, ticks: { color:'#4a6580' } },
            },
          },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function initLeaderboard() {
    if (!$$('fxsim-leaderboard')) return;
    const data  = await req('/stats/leaderboard');
    const tbody = $$('fxlb-body');
    if (!tbody) return;
    if (!data || !data.length) { tbody.innerHTML = '<tr class="fxdb-tr-empty"><td colspan="7">No traders yet. Be the first!</td></tr>'; return; }
    const medals = ['🥇','🥈','🥉'];
    const sc = { active:'var(--accent)', funded:'var(--green)', passed:'var(--green)' };
    tbody.innerHTML = data.map((row, i) => `<tr>
      <td style="font-size:18px;text-align:center">${medals[i] || (i+1)}</td>
      <td><strong>${escHtml(row.trader_name)}</strong></td>
      <td style="color:var(--text-muted);font-size:12px">${escHtml(row.plan_name)}</td>
      <td style="font-family:var(--mono)">$${parseFloat(row.account_size).toLocaleString()}</td>
      <td style="color:var(--green);font-weight:700;font-size:15px">+${parseFloat(row.profit_pct).toFixed(2)}%</td>
      <td>${row.trading_days} days</td>
      <td><span style="color:${sc[row.status]||'var(--text)'};font-weight:700;text-transform:uppercase;font-size:11px">${row.status}</span></td>
    </tr>`).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CERTIFICATE PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  async function initCertificate() {
    if (!$$('fxsim-certificate-page')) return;
    const challenges = await req('/challenge/my');
    const funded     = (challenges || []).find(c => c.status === 'funded' || c.status === 'passed');
    hide('fxcert-loading');
    if (!funded) { show('fxcert-error'); return; }
    const data = await req(`/certificate/${funded.id}`);
    if (!data || data.error) { show('fxcert-error'); return; }
    show('fxcert-card');
    setText('fxcert-brand',        data.brand);
    setText('fxcert-trader-name',  data.trader_name);
    setText('fxcert-plan-name',    data.plan_name);
    setText('fxcert-account-size', '$' + parseFloat(data.account_size).toLocaleString());
    setText('fxcert-split',        data.profit_split + '% profit split');
    setText('fxcert-date',         data.issued_date);
    setText('fxcert-id',           String(data.challenge_id).padStart(6, '0'));
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initChallenges();
    initStatistics();
    initLeaderboard();
    initCertificate();
    // UX systems — run on all dashboard pages
    initNotifications();
    initTheme();
    checkAnnouncement();
    checkMaintenance();
    showOnboardingIfNew();
    init2FA();
    handleStripeReturn();
    loadPayoutMethod();
    handleVerifyBanner();
  });

  function handleVerifyBanner() {
    const params   = new URLSearchParams(window.location.search);
    const verify   = params.get('verify');
    const reg      = params.get('registered');
    const msg      = params.get('msg');
    if (!verify && !reg) return;
    window.history.replaceState({}, '', window.location.pathname);
    const el = $$('fxdb-announcement');
    if (!el) return;
    el.style.display = 'block';

    if (reg === '1') {
      el.innerHTML = `<div class="fxsim-verify-banner success">
        <span style="font-size:18px">📧</span>
        <div>
          <strong>Welcome! One more step — verify your email.</strong><br>
          <span style="font-weight:400;font-size:13px">We sent a verification link to your email address. Click it to fully activate your account.</span>
        </div>
        <button onclick="this.parentElement.parentElement.style.display='none'"
          style="background:none;border:none;color:var(--green);cursor:pointer;font-size:18px;margin-left:auto;flex-shrink:0">✕</button>
      </div>`;
    } else if (verify === 'success') {
      el.innerHTML = `<div class="fxsim-verify-banner success">
        ✅ Email verified successfully! Your account is fully activated.
        <button onclick="this.parentElement.parentElement.style.display='none'"
          style="background:none;border:none;color:var(--green);cursor:pointer;font-size:18px;margin-left:auto">✕</button>
      </div>`;
    } else {
      el.innerHTML = `<div class="fxsim-verify-banner error">
        ⚠ ${escHtml(msg || 'Verification failed. Please request a new link from your profile.')}
        <button onclick="this.parentElement.parentElement.style.display='none'"
          style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;margin-left:auto">✕</button>
      </div>`;
    }
  }
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * When Stripe redirects back to /dashboard/?stripe=success or ?stripe=cancelled,
   * show an appropriate message and clean the URL so refreshing doesn't re-trigger.
   */
  function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    const stripe = params.get('stripe');
    if (!stripe) return;

    // Clean the URL without reload
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    // Show result in announcement banner area (reuse existing infrastructure)
    const el = $$('fxdb-announcement');
    if (!el) return;

    if (stripe === 'success') {
      el.style.display = 'block';
      el.innerHTML = `<div style="background:rgba(0,229,160,.1);border-bottom:2px solid var(--green);
        padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span style="color:var(--green);font-size:14px;font-weight:700">
          ✅ Payment successful! Your challenge account is being activated — refresh in a moment.
        </span>
        <button onclick="this.parentElement.parentElement.style.display='none'"
          style="background:none;border:none;color:var(--green);cursor:pointer;font-size:18px">✕</button>
      </div>`;
      // Auto-reload after 3s to show activated challenge
      setTimeout(() => window.location.reload(), 3000);
    } else if (stripe === 'cancelled') {
      el.style.display = 'block';
      el.innerHTML = `<div style="background:rgba(255,211,42,.08);border-bottom:2px solid var(--yellow);
        padding:10px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span style="color:var(--yellow);font-size:13px;font-weight:600">
          Payment cancelled. Your challenge was not activated. Try again whenever you're ready.
        </span>
        <button onclick="this.parentElement.parentElement.style.display='none'"
          style="background:none;border:none;color:var(--yellow);cursor:pointer;font-size:18px">✕</button>
      </div>`;
    }
  }
  // ═══════════════════════════════════════════════════════════════════════════

  let _notifOpen = false;

  async function initNotifications() {
    if (!$$('fxdb-notif-wrap')) return;
    await refreshNotifications();
    // Close panel on outside click
    document.addEventListener('click', e => {
      if (_notifOpen && !e.target.closest('#fxdb-notif-wrap')) {
        closeNotifications();
      }
    });
  }

  async function refreshNotifications() {
    const data = await req('/notifications');
    if (!data) return;
    const badge = $$('fxdb-notif-badge');
    if (badge) {
      badge.style.display = data.unread_count > 0 ? 'inline' : 'none';
      badge.textContent   = data.unread_count > 9 ? '9+' : data.unread_count;
    }
    renderNotifList(data.notifications || []);
  }

  function renderNotifList(notifications) {
    const list = $$('fxdb-notif-list');
    if (!list) return;
    if (!notifications.length) {
      list.innerHTML = '<div class="fxdb-notif-empty">No notifications yet</div>';
      return;
    }
    const iconMap = { success:'✅', error:'❌', warning:'⚠', info:'ℹ' };
    list.innerHTML = notifications.map(n => {
      const icon = iconMap[n.type] || 'ℹ';
      const time = new Date(n.created_at).toLocaleDateString();
      const cls  = n.is_read == 1 ? 'fxdb-notif-item fxdb-notif-read' : 'fxdb-notif-item fxdb-notif-unread';
      const link = n.link ? ` onclick="location.href='${n.link}'"` : '';
      return `<div class="${cls}"${link} style="${n.link ? 'cursor:pointer' : ''}">
        <div class="fxdb-notif-icon">${icon}</div>
        <div class="fxdb-notif-body">
          <div class="fxdb-notif-title">${n.title}</div>
          <div class="fxdb-notif-msg">${n.message}</div>
          <div class="fxdb-notif-time">${time}</div>
        </div>
      </div>`;
    }).join('');
  }

  function toggleNotifications() {
    _notifOpen ? closeNotifications() : openNotifications();
  }

  function openNotifications() {
    const panel = $$('fxdb-notif-panel');
    if (panel) panel.style.display = 'block';
    _notifOpen = true;
    // Mark visible — refresh to show read state
    refreshNotifications();
  }

  function closeNotifications() {
    const panel = $$('fxdb-notif-panel');
    if (panel) panel.style.display = 'none';
    _notifOpen = false;
  }

  async function markAllRead() {
    await req('/notifications/read', 'POST', {});
    await refreshNotifications();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DARK / LIGHT MODE TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  function initTheme() {
    const saved = localStorage.getItem('fxsim_theme') || 'dark';
    applyTheme(saved, false);
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  function applyTheme(theme, save) {
    document.documentElement.dataset.theme = theme;
    // Update all theme buttons (multiple templates may have one)
    document.querySelectorAll('.fxdb-theme-btn, #fxdb-theme-btn').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀' : '🌙';
      btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
    if (save) localStorage.setItem('fxsim_theme', theme);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNOUNCEMENT BANNER
  // ═══════════════════════════════════════════════════════════════════════════

  async function checkAnnouncement() {
    const el = $$('fxdb-announcement');
    if (!el) return;
    const ann = await req('/admin/announcement');
    if (!ann || !ann.message) return;
    const colorMap = { info:'#00d4ff', success:'#00e5a0', warning:'#ffd32a', error:'#ff4757' };
    const bgMap    = { info:'rgba(0,212,255,.08)', success:'rgba(0,229,160,.08)', warning:'rgba(255,211,42,.08)', error:'rgba(255,71,87,.08)' };
    const color    = colorMap[ann.type] || colorMap.info;
    const bg       = bgMap[ann.type] || bgMap.info;
    el.style.display = 'block';
    el.innerHTML = `
      <div style="background:${bg};border-bottom:2px solid ${color};padding:10px 24px;
                  display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span style="color:${color};font-size:13px;font-weight:600">${ann.message}</span>
        <button onclick="this.parentElement.parentElement.style.display='none'"
                style="background:none;border:none;color:${color};cursor:pointer;font-size:18px;
                       line-height:1;padding:0 4px;flex-shrink:0">✕</button>
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTENANCE MODE GATE
  // ═══════════════════════════════════════════════════════════════════════════

  async function checkMaintenance() {
    // Only run on non-admin users
    if (typeof FXSIM !== 'undefined' && FXSIM.user?.isAdmin) return;
    const state = await req('/admin/maintenance');
    if (!state?.enabled) return;
    // Replace page content with maintenance screen
    document.body.innerHTML = `
      <div style="min-height:100vh;background:#060b14;display:flex;align-items:center;
                  justify-content:center;padding:20px;font-family:system-ui">
        <div style="text-align:center;max-width:420px">
          <div style="font-size:56px;margin-bottom:20px">🔧</div>
          <h1 style="color:#dde8f5;font-size:22px;margin-bottom:12px">Under Maintenance</h1>
          <p style="color:#8ba4c0;font-size:14px;line-height:1.6">
            ${state.message || 'Platform maintenance in progress. Back soon.'}
          </p>
        </div>
      </div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING MODAL
  // ═══════════════════════════════════════════════════════════════════════════

  function showOnboardingIfNew() {
    const modal = $$('fxdb-onboarding-modal');
    if (!modal) return;
    // Show once — stored in localStorage
    const key  = 'fxsim_onboarded_' + (FXSIM?.user?.id || 0);
    const done = localStorage.getItem(key);
    if (!done) modal.style.display = 'flex';
  }

  function closeOnboarding() {
    const modal = $$('fxdb-onboarding-modal');
    if (modal) modal.style.display = 'none';
    const key = 'fxsim_onboarded_' + (FXSIM?.user?.id || 0);
    localStorage.setItem(key, '1');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MT5 DETAILS (FUNDED ACCOUNTS)
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadMT5Details(challengeId) {
    const box = $$('fxdb-mt5-content');
    if (!box) return;
    box.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Loading MT5 details…</div>';

    const data = await req(`/challenge/${challengeId}/mt5-details`);
    if (!data) {
      box.innerHTML = '<div style="color:var(--red);font-size:13px">Failed to load MT5 details.</div>';
      return;
    }
    if (!data.ready) {
      box.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;color:var(--yellow);font-size:13px">
          <span style="font-size:20px">⏳</span>
          <span>${escHtml(data.message || 'MT5 details are being prepared. Check back shortly.')}</span>
        </div>`;
      return;
    }

    // Render MT5 credentials with show/hide password
    box.innerHTML = `
      <div class="fxdb-mt5-grid">
        <div class="fxdb-mt5-field">
          <span class="fxdb-mt5-label">Login ID</span>
          <div class="fxdb-mt5-value-row">
            <code id="mt5-login-val">${escHtml(data.mt5_login)}</code>
            <button class="fxdb-mt5-copy" onclick="fxDash.copyMT5('mt5-login-val')" title="Copy">⎘</button>
          </div>
        </div>
        <div class="fxdb-mt5-field">
          <span class="fxdb-mt5-label">Password</span>
          <div class="fxdb-mt5-value-row">
            <code id="mt5-pass-val" data-real="${escHtml(data.mt5_password)}" class="mt5-masked">••••••••••</code>
            <button class="fxdb-mt5-copy" onclick="fxDash.toggleMT5Pass()" title="Show/hide">👁</button>
            <button class="fxdb-mt5-copy" onclick="fxDash.copyMT5('mt5-pass-val')" title="Copy">⎘</button>
          </div>
        </div>
        <div class="fxdb-mt5-field">
          <span class="fxdb-mt5-label">Server</span>
          <div class="fxdb-mt5-value-row">
            <code id="mt5-server-val">${escHtml(data.mt5_server)}</code>
            <button class="fxdb-mt5-copy" onclick="fxDash.copyMT5('mt5-server-val')" title="Copy">⎘</button>
          </div>
        </div>
        <div class="fxdb-mt5-field">
          <span class="fxdb-mt5-label">Account Type</span>
          <div class="fxdb-mt5-value-row">
            <code>${escHtml(data.mt5_account_type || 'Live')}</code>
          </div>
        </div>
      </div>
      <div class="fxdb-mt5-instructions">
        <strong>How to connect:</strong>
        <ol>
          <li>Download <a href="https://www.metatrader5.com/en/download" target="_blank" rel="noopener" style="color:var(--accent)">MetaTrader 5</a> for desktop or mobile.</li>
          <li>Open MT5 → File → Login to Trade Account (or Open an Account).</li>
          <li>Search for your server: <strong>${escHtml(data.mt5_server)}</strong></li>
          <li>Enter your Login ID and Password above.</li>
          <li>Click OK — your funded account will appear.</li>
        </ol>
      </div>`;
  }

  function toggleMT5Pass() {
    const el = document.getElementById('mt5-pass-val');
    if (!el) return;
    if (el.classList.contains('mt5-masked')) {
      el.textContent = el.dataset.real || '';
      el.classList.remove('mt5-masked');
    } else {
      el.textContent = '••••••••••';
      el.classList.add('mt5-masked');
    }
  }

  function copyMT5(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const val = el.dataset.real || el.textContent;
    navigator.clipboard.writeText(val).then(() => {
      const orig = el.textContent;
      // Brief visual feedback — don't alter password masking
      if (!el.classList.contains('mt5-masked')) {
        el.style.background = 'rgba(0,229,160,.15)';
        setTimeout(() => el.style.background = '', 800);
      }
    }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYOUT METHOD MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  async function loadPayoutMethod() {
    const data = await req('/payout-method');
    if (!data) return;
    const method  = document.getElementById('pm-method');
    const address = document.getElementById('pm-address');
    const details = document.getElementById('pm-details');
    if (method && data.method) {
      // Try to match existing option; if not found, select "Other"
      const opt = [...method.options].find(o => o.value === data.method);
      method.value = opt ? data.method : (data.method ? 'Other' : '');
    }
    if (address) address.value = data.address || '';
    if (details) details.value = data.details || '';
  }

  async function savePayoutMethod() {
    const method  = document.getElementById('pm-method')?.value  || '';
    const address = document.getElementById('pm-address')?.value || '';
    const details = document.getElementById('pm-details')?.value || '';
    const msgEl   = document.getElementById('pm-msg');
    if (!method || !address) {
      if (msgEl) { msgEl.textContent = 'Please select a method and enter an address.'; msgEl.style.color = 'var(--red)'; }
      return;
    }
    const res = await req('/payout-method', 'POST', { method, address, details });
    if (msgEl) {
      msgEl.textContent = res?.success ? '✓ Saved.' : '✗ Failed.';
      msgEl.style.color = res?.success ? 'var(--green)' : 'var(--red)';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2FA SECURITY TOGGLE
  // ═══════════════════════════════════════════════════════════════════════════

  let _2faEnabled = false;

  async function init2FA() {
    const btn = $$('fxdb-2fa-btn');
    const lbl = $$('fxdb-2fa-status');
    if (!btn) return;
    const data = await req('/auth/2fa/status');
    // If the API call failed (network error, 500, etc.), data will be {error:...}.
    // Do NOT assume disabled — that would show wrong UI state if DB has it enabled.
    // Instead hide the toggle row so the user sees nothing rather than wrong info.
    if (!data || data.error) {
      const row = btn.closest('.fxdb-setting-row') || btn.parentElement;
      if (row) row.style.display = 'none';
      return;
    }
    _2faEnabled = !!data.enabled;
    update2FAUI();
  }

  function update2FAUI() {
    const btn = $$('fxdb-2fa-btn');
    const lbl = $$('fxdb-2fa-status');
    if (lbl) {
      lbl.textContent = _2faEnabled ? 'Enabled' : 'Disabled';
      lbl.style.color = _2faEnabled ? 'var(--green)' : 'var(--text-muted)';
    }
    if (btn) btn.textContent = _2faEnabled ? 'Disable' : 'Enable';
  }

  async function toggle2FA() {
    const btn = $$('fxdb-2fa-btn');
    if (btn) btn.disabled = true;
    const newState = !_2faEnabled;
    const res = await req('/auth/2fa/toggle', 'POST', { enable: newState });
    if (res?.success) {
      _2faEnabled = newState;
      update2FAUI();
    }
    if (btn) btn.disabled = false;
  }

  return {
    requestPayout, openStartModal, loadMetrics, _showStep1: (id) => openStartModal(id),
    // UX — exposed for onclick handlers in templates
    toggleNotifications, markAllRead, toggleTheme, closeOnboarding, toggle2FA,
    savePayoutMethod, toggleMT5Pass, copyMT5,
  };
})();
