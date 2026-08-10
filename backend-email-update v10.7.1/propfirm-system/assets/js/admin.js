/* ── PropFirm System — Admin JS ──────────────────────────────────────────── */
/* globals FXSIM_ADMIN */

const fxsimAdmin = (() => {
  'use strict';

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


  const { api: API, nonce } = FXSIM_ADMIN;

  /**
   * Central API request helper.
   * Returns parsed JSON on success, or { error, status } on any failure.
   * NEVER throws — callers check res.error to detect failure.
   * This prevents a single bad API response from breaking unrelated admin pages.
   */
  async function req(path, method = 'GET', body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
      // 15-second timeout via AbortController
      signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const r = await fetch(API + path, opts);
      // Parse JSON regardless of HTTP status (WP REST returns errors as JSON)
      const data = await r.json().catch(() => ({ error: 'Invalid JSON response', status: r.status }));
      if (!r.ok) {
        // Log to console but never throw — caller decides how to handle
        console.warn(`[PropFirm] API ${method} ${path} → HTTP ${r.status}`, data);
        return { error: data.message || data.error || `HTTP ${r.status}`, status: r.status, ...data };
      }
      return data;
    } catch (e) {
      // Network error, timeout, CORS, etc.
      console.error(`[PropFirm] API ${method} ${path} → ${e.name}: ${e.message}`);
      return { error: e.message, network_error: true };
    }
  }

  function f2(n) { return '$' + parseFloat(n || 0).toFixed(2); }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async function loadDashboard() {
    const s = await req('/admin/stats');

    // If API failed (network error, 500, DB not ready on fresh install), show error
    // instead of leaving page in "Loading…" state forever
    if (!s || s.error) {
      const grid = document.getElementById('fxsim-stats-grid');
      if (grid) grid.innerHTML = `<div style="color:#ff4757;padding:12px;font-size:13px">
        ⚠ Could not load stats: ${s?.error || 'Unknown error'}.
        Check that the plugin is fully activated (Settings → Permalinks → Save).
        <a href="" style="color:#00d4ff;margin-left:8px" onclick="location.reload();return false">Retry</a>
      </div>`;
      return;
    }

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stat-users',             s.users            ?? '—');
    set('stat-active-challenges', s.active_challenges ?? '—');
    set('stat-funded',            s.funded_accounts   ?? '—');
    set('stat-pending-payments',  s.pending_payments  ?? 0);
    set('stat-positions',         s.open_positions    ?? '—');
    set('stat-trades',            s.total_trades      ?? '—');

    const pnl  = parseFloat(s.total_pnl || 0);
    const pnlEl = document.getElementById('stat-pnl');
    if (pnlEl) {
      pnlEl.textContent  = (pnl >= 0 ? '+' : '') + f2(pnl);
      pnlEl.style.color  = pnl >= 0 ? '#00e5a0' : '#ff4757';
    }

    // Blink pending payments counter when > 0 (admin action needed)
    const ppEl = document.getElementById('stat-pending-payments');
    if (ppEl && (s.pending_payments ?? 0) > 0) ppEl.style.animation = 'fx-blink 2s infinite';

    // Load system health
    loadHealth();
  }

  async function loadHealth() {
    const data = await req('/admin/health');
    if (!data) return;

    const setHealth = (id, ok, msg) => {
      const card = document.getElementById(id);
      if (!card) return;
      const val  = card.querySelector('.fxsim-stat-val');
      if (val) {
        val.textContent = ok ? '✅ OK' : '⚠ Alert';
        val.style.color = ok ? '#00a060' : '#c0392b';
      }
      // Add detail line
      let detail = card.querySelector('.fxsim-health-detail');
      if (!detail) { detail = document.createElement('span'); detail.className = 'fxsim-health-detail'; detail.style.cssText = 'font-size:11px;color:#888;margin-top:4px;display:block'; card.appendChild(detail); }
      detail.textContent = msg;
    };

    setHealth('health-cron', data.cron?.ok, data.cron?.message || '');
    setHealth('health-feed', data.price_feed?.ok, data.price_feed?.message || '');
  }

  // ── Users ─────────────────────────────────────────────────────────────────
  async function searchUsers() {
    const q     = document.getElementById('fxsim-user-search')?.value || '';
    const data  = await req(`/admin/users?search=${encodeURIComponent(q)}`);
    const tbody = document.getElementById('fxsim-users-body');
    if (!tbody) return;
    if (!data || data.error || !data.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:16px;color:#888">No users found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(u => {
      const hasAccount  = u.status !== 'no_account';
      const statusColor = { active: '#10d8a0', inactive: '#ff5370', suspended: '#ffd166', no_account: '#3e5275' };
      const statusLabel = { active: 'Active', inactive: 'Inactive', suspended: 'Suspended', no_account: 'No Account' };
      const sc = statusColor[u.status] || '#888';
      const sl = statusLabel[u.status] || u.status;
      const joined = u.user_registered ? new Date(u.user_registered).toLocaleDateString() : '—';
      return `<tr>
        <td style="color:#7a8fb0;font-size:11px">${u.user_id}</td>
        <td><strong style="color:#e8edf8">${escHtml(u.user_login)}</strong></td>
        <td style="color:#7a8fb0;font-size:12px">${escHtml(u.user_email)}</td>
        <td style="font-family:monospace">${hasAccount ? '$'+parseFloat(u.balance).toFixed(2) : '—'}</td>
        <td style="font-family:monospace">${hasAccount ? '$'+parseFloat(u.equity).toFixed(2) : '—'}</td>
        <td>${u.active_challenges > 0 ? `<span style="color:#10d8a0;font-weight:700">${u.active_challenges} active</span>` : (u.funded_challenges > 0 ? `<span style="color:#6c63ff;font-weight:700">${u.funded_challenges} funded</span>` : '<span style="color:#3e5275">—</span>')}</td>
        <td style="font-size:11px;color:#7a8fb0">${joined}</td>
        <td><span style="color:${sc};font-weight:700;font-size:11px;text-transform:uppercase">${sl}</span></td>
        <td>
          ${hasAccount ? `<button class="button button-small" onclick="fxsimAdmin.openAdjust(${u.user_id},'${escHtml(u.user_login)}')">Adjust Balance</button>` : ''}
          ${hasAccount ? `<button class="button button-small" onclick="fxsimAdmin.toggleStatus(${u.user_id},'${u.status}')"
            style="margin-left:4px;color:${u.status==='active'?'#c0392b':'#27ae60'}">${u.status==='active'?'Freeze':'Activate'}</button>` : ''}
          <button class="button button-small" onclick="fxsimAdmin.doImpersonate(${u.user_id})"
            style="margin-left:4px">Login As</button>
        </td>
      </tr>`;
    }).join('');
  }

  function openAdjust(userId, login) {
    document.getElementById('modal-user-id').value    = userId;
    document.getElementById('modal-username').textContent = login;
    document.getElementById('modal-amount').value     = '';
    document.getElementById('modal-note').value       = '';
    document.getElementById('fxsim-adjust-modal').style.display = 'flex';
  }

  async function submitAdjust() {
    const userId = document.getElementById('modal-user-id').value;
    const amount = parseFloat(document.getElementById('modal-amount').value);
    const note   = document.getElementById('modal-note').value;
    if (!amount) { alert('Enter an amount.'); return; }
    const res = await req('/admin/adjust-balance', 'POST', { user_id: userId, amount, note });
    if (res.success) {
      alert(`Balance adjusted. New balance: ${f2(res.new_balance)}`);
      document.getElementById('fxsim-adjust-modal').style.display = 'none';
      searchUsers();
    } else { alert('Error: ' + (res.error || 'Unknown')); }
  }

  // ── Trades ────────────────────────────────────────────────────────────────
  async function loadTrades() {
    const data  = await req('/admin/trades');
    const tbody = document.getElementById('fxsim-trades-body');
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="10">No trades.</td></tr>'; return; }
    tbody.innerHTML = data.map(t => {
      const pnl = parseFloat(t.pnl);
      return `<tr>
        <td>${t.id}</td>
        <td>${t.user_login}</td>
        <td>${t.symbol}</td>
        <td style="color:${t.type==='buy'?'green':'red'}">${t.type.toUpperCase()}</td>
        <td>${t.lot_size}</td>
        <td>${t.open_price}</td>
        <td>${t.close_price}</td>
        <td style="color:${pnl>=0?'green':'red'}">${(pnl>=0?'+':'') + f2(pnl)}</td>
        <td>${t.close_reason}</td>
        <td>${new Date(t.closed_at).toLocaleString()}</td>
      </tr>`;
    }).join('');
  }

  // ── Symbols ───────────────────────────────────────────────────────────────
  async function loadSymbols() {
    const data  = await req('/admin/symbols');
    const tbody = document.getElementById('fxsim-symbols-body');
    if (!tbody) return;
    tbody.innerHTML = data.map(s => `<tr id="sym-row-${s.id}">
      <td><strong>${s.symbol}</strong></td>
      <td>${s.display_name}</td>
      <td style="text-transform:capitalize">${s.category}</td>
      <td><input type="number" step="0.00001" value="${s.spread}"     data-field="spread"      style="width:80px" id="s${s.id}_spread"></td>
      <td><input type="number" step="0.01"    value="${s.commission}" data-field="commission"   style="width:60px" id="s${s.id}_commission"></td>
      <td><input type="number" step="0.01"    value="${s.min_lot}"    data-field="min_lot"      style="width:55px" id="s${s.id}_min_lot"></td>
      <td><input type="number" step="0.01"    value="${s.max_lot}"    data-field="max_lot"      style="width:60px" id="s${s.id}_max_lot"></td>
      <td><input type="number" step="0.0001"  value="${s.swap_long}"  data-field="swap_long"    style="width:60px" id="s${s.id}_swap_long"></td>
      <td><input type="number" step="0.0001"  value="${s.swap_short}" data-field="swap_short"   style="width:60px" id="s${s.id}_swap_short"></td>
      <td><select id="s${s.id}_active"><option value="1" ${s.is_active?'selected':''}>Yes</option><option value="0" ${!s.is_active?'selected':''}>No</option></select></td>
      <td><button class="button button-small button-primary" onclick="fxsimAdmin.saveSymbol(${s.id})">Save</button></td>
    </tr>`).join('');
  }

  async function saveSymbol(id) {
    const get = field => document.getElementById(`s${id}_${field}`)?.value;
    const payload = {
      spread:      parseFloat(get('spread')),
      commission:  parseFloat(get('commission')),
      min_lot:     parseFloat(get('min_lot')),
      max_lot:     parseFloat(get('max_lot')),
      swap_long:   parseFloat(get('swap_long')),
      swap_short:  parseFloat(get('swap_short')),
      is_active:   parseInt(get('active')),
    };
    const res = await req(`/admin/symbol/${id}`, 'POST', payload);
    alert(res.success ? 'Symbol updated.' : 'Update failed.');
  }

  // ── Audit Log ─────────────────────────────────────────────────────────────
  async function loadLog() {
    const data  = await req('/admin/log');
    const tbody = document.getElementById('fxsim-log-body');
    if (!tbody) return;
    tbody.innerHTML = data.map(l => `<tr>
      <td>${l.id}</td>
      <td>${l.user_login}</td>
      <td>${l.action}</td>
      <td>${l.target_user_id || '—'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${l.details || '—'}</td>
      <td><code>${l.ip_address || '—'}</code></td>
      <td>${new Date(l.created_at).toLocaleString()}</td>
    </tr>`).join('');
  }

  // ── Settings ──────────────────────────────────────────────────────────────
  async function toggleNewsLock(locked) {
    const res = await req('/admin/news-lock', 'POST', { locked });
    const el  = document.getElementById('fxsim-news-lock-status');
    if (el) {
      el.style.color = locked ? '#ff4757' : '#00e5a0';
      el.textContent = locked ? '🔒 LOCKED — Trading paused' : '✅ UNLOCKED — Trading active';
    }
  }

  async function forcePrices() {
    const res = await req('/admin/force-prices', 'POST');
    const msg = document.getElementById('fxsim-settings-msg');
    if (msg) { msg.style.color = '#00e5a0'; msg.textContent = res.message || 'Done.'; }
    else alert(res.message || 'Done.');
  }

  function clearCache() { forcePrices(); }

  async function savePriceFeed() {
    const key = document.getElementById('td-api-key')?.value?.trim() || '';
    const res = await req('/admin/price-feed/save', 'POST', { twelve_data_key: key });
    const msg = document.getElementById('pricefeed-msg');
    if (msg) {
      msg.textContent = res?.success ? '✓ Saved.' : '✗ Failed.';
      msg.style.color = res?.success ? '#00a060' : '#c0392b';
    }
  }

  async function saveSMTP() {
    const get = id => document.getElementById(id)?.value || '';
    const body = {
      host:       get('smtp-host'),
      port:       parseInt(get('smtp-port') || '587'),
      auth:       true,
      user:       get('smtp-user'),
      pass:       get('smtp-pass'),
      secure:     get('smtp-secure'),
      from_email: get('smtp-from-email'),
      from_name:  get('smtp-from-name'),
    };
    const res = await req('/admin/smtp/save', 'POST', body);
    const msg = document.getElementById('smtp-msg');
    if (msg) {
      msg.textContent = res?.success ? '✓ SMTP settings saved.' : '✗ ' + (res?.error || 'Failed.');
      msg.style.color = res?.success ? '#00a060' : '#c0392b';
    }
  }

  async function testSMTP() {
    const to  = document.getElementById('smtp-test-email')?.value?.trim();
    const msg = document.getElementById('smtp-msg');
    if (!to) { if (msg) { msg.textContent = 'Enter a test email address first.'; msg.style.color = '#c0392b'; } return; }
    if (msg) { msg.textContent = 'Sending…'; msg.style.color = '#888'; }
    const res = await req('/admin/smtp/test', 'POST', { to });
    if (msg) {
      msg.textContent = (res?.success ? '✓ ' : '✗ ') + (res?.message || 'Unknown result.');
      msg.style.color = res?.success ? '#00a060' : '#c0392b';
    }
  }

  /**
   * Save a rate limit tier value to wp_options via direct AJAX.
   * Rate limits are stored as wp_options — no REST endpoint needed.
   * Uses wp.ajax or direct fetch to admin-ajax.php.
   * Simplest approach: use the existing WP AJAX nonce.
   */
  async function saveRateLimit(tier) {
    const input = document.getElementById('fxsim-rl-' + tier);
    const msg   = document.getElementById('fxsim-settings-msg');
    if (!input) return;

    const value = parseInt(input.value, 10);
    if (isNaN(value) || value < 0) {
      if (msg) { msg.style.color = '#ff4757'; msg.textContent = 'Invalid value — enter a number ≥ 0.'; }
      return;
    }

    const res = await req('/admin/rate-limit', 'POST', { tier, limit: value });
    if (msg) {
      if (res && !res.error) {
        msg.style.color = '#00e5a0';
        msg.textContent = `✓ Rate limit for "${tier}" set to ${value} req/min.`;
      } else {
        msg.style.color = '#ff4757';
        msg.textContent = `✗ ${res?.error || 'Failed to save.'}`;
      }
    }
  }

  async function toggleStatus(userId, current) {
    const newStatus = current === 'active' ? 'frozen' : 'active';
    if (!confirm(`Set account to ${newStatus}?`)) return;
    const res = await req('/admin/set-status', 'POST', { user_id: userId, status: newStatus });
    if (res.success) searchUsers();
    else alert('Failed to update status.');
  }

  // ── Challenges ────────────────────────────────────────────────────────────
  async function loadAdminChallenges() {
    const data  = await req('/admin/challenges');
    const tbody = document.getElementById('fxsim-challenges-body');
    if (!tbody || !data) return;
    const { challenges, pending_payouts } = data;
    const summary = document.getElementById('fxsim-challenge-summary');
    if (summary && challenges) {
      const counts = { active:0, funded:0, failed:0, passed:0 };
      challenges.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
      summary.innerHTML = Object.entries(counts).map(([k,v]) =>
        `<div style="background:#0a1020;border:1px solid #142038;border-radius:8px;padding:10px 16px">
           <div style="font-size:11px;color:#4a6580;text-transform:uppercase;letter-spacing:1px">${k}</div>
           <div style="font-size:22px;font-weight:700;color:#dde8f5">${v}</div></div>`
      ).join('');
    }
    if (!challenges || !challenges.length) { tbody.innerHTML = '<tr><td colspan="9">No challenges found.</td></tr>'; return; }
    const sc = { active:'#00d4ff', funded:'#00e5a0', failed:'#ff4757', passed:'#00e5a0', suspended:'#ffd32a' };
    tbody.innerHTML = challenges.map(c => `<tr>
      <td>${c.id}</td>
      <td><strong>${c.user_login}</strong><br><small style="color:#4a6580">${c.user_email}</small></td>
      <td>${c.plan_name}</td>
      <td>$${parseFloat(c.account_size).toLocaleString()}</td>
      <td>Phase ${c.phase}</td>
      <td><span style="color:${sc[c.status]||'#dde8f5'};font-weight:700;text-transform:uppercase">${c.status}</span>
          ${c.breach_reason ? `<br><small style="color:#ff4757" title="${c.breach_reason}">⚠ Breached</small>` : ''}</td>
      <td>$${parseFloat(c.current_balance||0).toFixed(2)}</td>
      <td>${new Date(c.created_at).toLocaleDateString()}</td>
      <td><span style="color:#4a6580;font-size:11px">ID ${c.fxsim_account_id}</span>${
        c.status === 'funded'
          ? `<br><button class="button button-small button-primary" style="margin-top:4px"
               onclick="fxsimAdmin.openMT5Modal(${c.id})">🖥 MT5 Details</button>`
          : ''
      }</td>
    </tr>`).join('');
  }

  // ── Plans ─────────────────────────────────────────────────────────────────
  let currentPlans = [];

  async function loadAdminPlans() {
    const data  = await req('/admin/plans');
    currentPlans = data || [];
    const tbody = document.getElementById('fxsim-plans-body');
    if (!tbody) return;
    if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="10">No plans. Click "+ New Plan" to create one.</td></tr>'; return; }
    tbody.innerHTML = data.map(p => `<tr>
      <td><strong>${p.name}</strong></td>
      <td>$${parseFloat(p.account_size).toLocaleString()}</td>
      <td>$${parseFloat(p.price).toFixed(2)}</td>
      <td>${p.p1_profit_target}%</td><td>${p.p1_daily_dd}%</td><td>${p.p1_max_dd}%</td>
      <td>${p.p2_profit_target}%</td><td>${p.funded_profit_split}%</td>
      <td style="color:${p.is_active?'#00e5a0':'#ff4757'}">${p.is_active ? 'Yes' : 'No'}</td>
      <td><button class="button button-small button-primary" onclick="fxsimAdmin.editPlan(${p.id})">Edit</button></td>
    </tr>`).join('');
  }

  function newPlan() {
    document.getElementById('plan-id').value = '0';
    document.getElementById('fxsim-plan-modal-title').textContent = 'New Plan';
    document.getElementById('fxsim-plan-modal').style.display = 'flex';
  }

  function editPlan(id) {
    const p = currentPlans.find(x => parseInt(x.id) === id);
    if (!p) return;
    const s = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val ?? ''; };
    s('plan-id', p.id); s('plan-name', p.name); s('plan-size', p.account_size);
    s('plan-price', p.price); s('plan-phases', p.phases);
    s('plan-is-instant-funding', p.is_instant_funding || '0');
    s('plan-drawdown-type', p.drawdown_type || 'static');
    s('plan-p1pt', p.p1_profit_target); s('plan-p1dd', p.p1_daily_dd); s('plan-p1mdd', p.p1_max_dd);
    s('plan-p1min', p.p1_min_days); s('plan-p1max', p.p1_max_days);
    s('plan-p2pt', p.p2_profit_target); s('plan-p2dd', p.p2_daily_dd); s('plan-p2mdd', p.p2_max_dd);
    s('plan-p2min', p.p2_min_days); s('plan-p2max', p.p2_max_days);
    s('plan-p3pt', p.p3_profit_target || '3'); s('plan-p3dd', p.p3_daily_dd || '5'); s('plan-p3mdd', p.p3_max_dd || '10');
    s('plan-p3min', p.p3_min_days || '5'); s('plan-p3max', p.p3_max_days || '60');
    s('plan-split', p.funded_profit_split); s('plan-lev', p.max_leverage);
    s('plan-active', p.is_active); s('plan-sort', p.sort_order);
    s('plan-consistency', p.consistency_rule || '0'); s('plan-consistency-pct', p.consistency_pct || '50');
    s('plan-news-trading', p.news_trading ?? '1');
    s('plan-scaling-enabled', p.scaling_enabled || '0');
    s('plan-scaling-growth-pct', p.scaling_growth_pct || '25');
    s('plan-scaling-interval-months', p.scaling_interval_months || '4');
    s('plan-scaling-required-profit-pct', p.scaling_required_profit_pct || '10');
    s('plan-scaling-max-balance', p.scaling_max_balance || '2000000');
    document.getElementById('fxsim-plan-modal-title').textContent = 'Edit Plan';
    document.getElementById('fxsim-plan-modal').style.display = 'flex';
    if (typeof fxsimTogglePlanFields === 'function') fxsimTogglePlanFields();
  }

  async function savePlan() {
    const g = id => document.getElementById(id)?.value;
    const payload = {
      id: parseInt(g('plan-id')) || 0, name: g('plan-name'),
      account_size: parseFloat(g('plan-size')), price: parseFloat(g('plan-price')),
      phases: parseInt(g('plan-phases')),
      is_instant_funding: parseInt(g('plan-is-instant-funding') || '0'),
      drawdown_type: g('plan-drawdown-type') || 'static',
      p1_profit_target: parseFloat(g('plan-p1pt')), p1_daily_dd: parseFloat(g('plan-p1dd')),
      p1_max_dd: parseFloat(g('plan-p1mdd')), p1_min_days: parseInt(g('plan-p1min')), p1_max_days: parseInt(g('plan-p1max')),
      p2_profit_target: parseFloat(g('plan-p2pt')), p2_daily_dd: parseFloat(g('plan-p2dd')),
      p2_max_dd: parseFloat(g('plan-p2mdd')), p2_min_days: parseInt(g('plan-p2min')), p2_max_days: parseInt(g('plan-p2max')),
      p3_profit_target: parseFloat(g('plan-p3pt') || '3'), p3_daily_dd: parseFloat(g('plan-p3dd') || '5'),
      p3_max_dd: parseFloat(g('plan-p3mdd') || '10'), p3_min_days: parseInt(g('plan-p3min') || '5'), p3_max_days: parseInt(g('plan-p3max') || '60'),
      funded_profit_split: parseFloat(g('plan-split')), max_leverage: parseInt(g('plan-lev')),
      news_trading: parseInt(g('plan-news-trading') || '1'),
      is_active: parseInt(g('plan-active')), sort_order: parseInt(g('plan-sort')),
      consistency_rule: parseInt(g('plan-consistency') || '0'),
      consistency_pct: parseFloat(g('plan-consistency-pct') || '50'),
      scaling_enabled: parseInt(g('plan-scaling-enabled') || '0'),
      scaling_growth_pct: parseFloat(g('plan-scaling-growth-pct') || '25'),
      scaling_interval_months: parseInt(g('plan-scaling-interval-months') || '4'),
      scaling_required_profit_pct: parseFloat(g('plan-scaling-required-profit-pct') || '10'),
      scaling_max_balance: parseFloat(g('plan-scaling-max-balance') || '2000000'),
    };
    const res = await req('/admin/plans/save', 'POST', payload);
    const msg = document.getElementById('fxsim-plan-msg');
    if (res.success) {
      if (msg) msg.textContent = '✓ Saved!';
      setTimeout(() => { document.getElementById('fxsim-plan-modal').style.display = 'none'; loadAdminPlans(); }, 700);
    } else { if (msg) { msg.style.color='red'; msg.textContent='Save failed.'; } }
  }

  // ── Payouts ───────────────────────────────────────────────────────────────
  async function loadPayouts() {
    const filter = document.getElementById('payout-filter')?.value ?? 'pending';
    const data   = await req('/admin/challenges');
    const tbody  = document.getElementById('fxsim-payouts-body');
    if (!tbody || !data) return;

    let payouts = data.pending_payouts || [];
    if (filter) payouts = payouts.filter(p => p.status === filter);

    if (!payouts.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:16px;color:#888">No ${filter || ''} payouts found.</td></tr>`;
      return;
    }

    const statusColor = { pending:'#ffd32a', approved:'#00e5a0', rejected:'#ff4757' };

    tbody.innerHTML = payouts.map(p => {
      const sc = statusColor[p.status] || '#888';
      return `<tr>
        <td>${p.id}</td>
        <td><strong>${p.user_login}</strong><br><small style="color:#888">UID: ${p.user_id}</small></td>
        <td>#${p.challenge_id}</td>
        <td style="font-weight:700;color:#00e5a0">$${parseFloat(p.trader_amount||0).toFixed(2)}</td>
        <td style="color:#8ba4c0">${p.profit_split_pct||80}%</td>
        <td>${p.payment_method||'—'}</td>
        <td><code style="font-size:11px;word-break:break-all">${p.payment_address||'—'}</code></td>
        <td style="font-size:11px;color:#888">${p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
        <td><span style="color:${sc};font-weight:700;font-size:11px;text-transform:uppercase">${p.status}</span>
          ${p.admin_note ? `<br><small style="color:#888">${p.admin_note}</small>` : ''}</td>
        <td>
          ${p.status === 'pending' ? `
            <button class="button button-primary button-small" onclick="fxsimAdmin.openPayoutModal(${p.challenge_id},'approve')">✓ Approve</button>
            <button class="button button-small" style="color:#c0392b;margin-left:4px" onclick="fxsimAdmin.openPayoutModal(${p.challenge_id},'reject')">✗ Reject</button>
          ` : `<span style="color:#888;font-size:11px">${p.processed_at ? new Date(p.processed_at).toLocaleDateString() : 'Processed'}</span>`}
        </td>
      </tr>`;
    }).join('');
  }

  function openPayoutModal(challengeId, action) {
    document.getElementById('payout-modal-id').value     = challengeId;
    document.getElementById('payout-modal-action').value = action;
    document.getElementById('payout-reference').value    = '';
    document.getElementById('payout-note').value         = '';
    document.getElementById('payout-modal-msg').textContent = '';
    const title = document.getElementById('payout-modal-title');
    const btn   = document.getElementById('payout-confirm-btn');
    if (title) title.textContent = action === 'approve' ? '✓ Approve Payout' : '✗ Reject Payout';
    if (btn)   btn.className     = action === 'approve'
      ? 'button button-primary' : 'button button-small';
    document.getElementById('payout-action-modal').style.display = 'flex';
  }

  async function confirmPayoutAction() {
    const challengeId = document.getElementById('payout-modal-id')?.value;
    const action      = document.getElementById('payout-modal-action')?.value;
    const reference   = document.getElementById('payout-reference')?.value || '';
    const note        = document.getElementById('payout-note')?.value || '';
    const msgEl       = document.getElementById('payout-modal-msg');
    const btn         = document.getElementById('payout-confirm-btn');

    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }
    const res = await req(`/admin/challenge/${challengeId}/approve-payout`, 'POST',
      { action, note, reference });
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm'; }

    if (res?.success) {
      document.getElementById('payout-action-modal').style.display = 'none';
      await loadPayouts();
    } else {
      if (msgEl) { msgEl.textContent = '✗ ' + (res?.error || 'Failed.'); msgEl.style.color = '#c0392b'; }
    }
  }

  function exportPayoutsCSV() {
    const rows = document.querySelectorAll('#fxsim-payouts-body tr');
    if (!rows.length) return;
    const headers = ['ID','Trader','Challenge','Amount','Split%','Method','Address','Requested','Status'];
    const lines   = [headers.join(',')];
    rows.forEach(row => {
      const cells = Array.from(row.cells).map(c => `"${c.textContent.trim().replace(/"/g,'""')}"`);
      if (cells.length >= 9) lines.push(cells.slice(0, 9).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'payouts-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  }

  // Keep old name as alias — called from non-polished places
  async function approvePayoutAction(challengeId, action) {
    openPayoutModal(challengeId, action);
  }

  async function bulkApprovePayouts() {
    const data = await req('/admin/challenges');
    if (!data || !data.pending_payouts) return;
    
    // Simple Address Validation: alphanumeric, > 25 chars (covers most crypto), or contains @ (PayPal/Email)
    const isValidAddress = (addr) => {
      if (!addr) return false;
      if (addr.includes('@')) return true; // email based
      if (addr.length >= 26 && /^[a-zA-Z0-9]+$/.test(addr)) return true; // Crypto hash
      return false;
    };

    const validPayouts = data.pending_payouts.filter(p => p.status === 'pending' && isValidAddress(p.payment_address));
    
    if (!validPayouts.length) {
      alert('No pending payouts with valid addresses found to bulk approve.');
      return;
    }

    if (!confirm(`Auto-validated ${validPayouts.length} payout(s). Bulk approve them now?`)) return;
    
    const ids = validPayouts.map(p => p.challenge_id);
    const btn = document.getElementById('btn-bulk-payout');
    if (btn) btn.textContent = 'Processing...';

    const res = await req('/admin/bulk/payouts', 'POST', { ids, status: 'approved', note: 'Bulk approved via one-click automation.' });
    
    if (btn) btn.textContent = '⚡ Auto-Validate & Bulk Approve Pending';
    
    if (res.success) {
      alert(`✅ Successfully bulk approved ${res.processed} payouts.`);
      loadPayouts();
    } else {
      alert('Error processing bulk payouts.');
    }
  }

  // ── White Label ───────────────────────────────────────────────────────────
  async function loadWhitelabel() {
    const data = await req('/admin/whitelabel');
    const tbody = document.getElementById('fxsim-wl-body');
    const payBody = document.getElementById('fxsim-wl-payment-body');
    if (!data) return;

    const brandingLabels = {
      brand_name:'Brand Name', brand_tagline:'Tagline',
      primary_color:'Primary Color (hex)', secondary_color:'Secondary Color (hex)',
      logo_url:'Logo URL', favicon_url:'Favicon URL', support_email:'Support Email',
      discord_webhook:'Discord Webhook URL', telegram_bot:'Telegram Bot Token',
      telegram_chat:'Telegram Chat ID', footer_text:'Footer Text',
      challenge_label:'Challenge Label', funded_label:'Funded Account Label',
    };

    const paymentLabels = {
      manual_payment_instructions: 'Payment Instructions (shown to user)',
      manual_crypto_address:       'Crypto Wallet Address',
      coinpayments_pub_key:        'CoinPayments Public Key',
      coinpayments_priv_key:       'CoinPayments Private Key',
      stripe_public_key:           'Stripe Publishable Key (pk_live_...)',
      stripe_secret_key:           'Stripe Secret Key (sk_live_...)',
      stripe_webhook_secret:       'Stripe Webhook Secret (whsec_...)',
    };

    const renderRows = (labels, container) => {
      if (!container) return;
      const isTextarea = ['manual_payment_instructions'];
      container.innerHTML = Object.entries(labels).map(([k, label]) => {
        const val = (data[k] || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const input = isTextarea.includes(k)
          ? `<textarea id="wl-${k}" rows="3" style="width:100%;max-width:500px;padding:6px 8px;font-size:13px;border:1px solid #ccc;border-radius:4px">${(data[k]||'').replace(/</g,'&lt;')}</textarea>`
          : `<input type="text" id="wl-${k}" value="${val}" class="regular-text">`;
        return `<tr><th style="width:220px"><label for="wl-${k}">${label}</label></th><td>${input}</td></tr>`;
      }).join('');
    };

    renderRows(brandingLabels, tbody);
    renderRows(paymentLabels, payBody);
  }

  async function saveWhitelabel() {
    const keys = [
      'brand_name','brand_tagline','primary_color','secondary_color','logo_url',
      'favicon_url','support_email','discord_webhook','telegram_bot','telegram_chat',
      'footer_text','challenge_label','funded_label',
      'manual_payment_instructions','manual_crypto_address',
      'coinpayments_pub_key','coinpayments_priv_key',
      'stripe_public_key','stripe_secret_key','stripe_webhook_secret',
    ];
    const payload = {};
    keys.forEach(k => {
      const el = document.getElementById('wl-' + k);
      if (el) payload[k] = el.value;
    });
    const res = await req('/admin/whitelabel/save', 'POST', payload);
    const msg = document.getElementById('fxsim-wl-msg');
    if (msg) { msg.style.color = res.success ? 'green' : 'red'; msg.textContent = res.success ? '✓ Settings saved.' : 'Save failed.'; }
  }

  async function saveEmailTemplate(slug) {
    const subject = document.getElementById(`tpl-subj-${slug}`)?.value || '';
    const body = document.getElementById(`tpl-body-${slug}`)?.value || '';
    const res = await req('/admin/email-templates', 'POST', { slug, subject, body });
    const msg = document.getElementById('fxsim-email-templates-msg');
    if (msg) {
      msg.style.color = res.success ? 'green' : 'red';
      msg.textContent = res.success ? `✓ Template for '${slug}' saved.` : 'Save failed.';
      setTimeout(() => msg.textContent = '', 3000);
    }
  }

  // ── Payments ──────────────────────────────────────────────────────────────
  let currentPaymentFilter = 'pending';

  async function loadPayments(statusFilter) {
    currentPaymentFilter = statusFilter || 'pending';
    const all   = await req('/admin/payments');
    const tbody = document.getElementById('fxsim-payments-body');
    if (!tbody || !all) return;

    const filtered = currentPaymentFilter === 'all'
      ? all
      : all.filter(p => p.status === currentPaymentFilter);

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:#4a6580;padding:20px">No ${currentPaymentFilter} payments.</td></tr>`;
      return;
    }

    const sc = { pending:'#ffd32a', approved:'#00e5a0', rejected:'#ff4757', expired:'#4a6580' };

    tbody.innerHTML = filtered.map(p => {
      const proofCell = p.proof_url
        ? (p.proof_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            ? `<img src="${p.proof_url}" alt="Proof"
                   style="width:60px;height:45px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid #1a2d4a"
                   onclick="fxsimAdmin.viewProof('${p.proof_url}')"
                   title="Click to enlarge">`
            : `<a href="${p.proof_url}" target="_blank" class="button button-small">📄 View PDF</a>`)
        : '<span style="color:#4a6580">—</span>';

      const actionCell = p.status === 'pending'
        ? `<button class="button button-primary button-small"
               onclick="fxsimAdmin.approvePayment(${p.id},'${p.user_login}')">✓ Approve</button>
           <button class="button button-small" style="color:#ff4757;margin-left:4px"
               onclick="fxsimAdmin.openRejectModal(${p.id})">✗ Reject</button>`
        : `<span style="font-size:11px;color:#4a6580">
             ${p.reviewed_by_login ? 'by ' + p.reviewed_by_login : ''}
           </span>`;

      return `<tr>
        <td>${p.id}</td>
        <td><strong>${p.user_login}</strong><br><small style="color:#4a6580">${p.user_email}</small></td>
        <td>${p.plan_name}<br><small style="color:#4a6580">$${parseFloat(p.account_size).toLocaleString()}</small></td>
        <td style="font-weight:700">$${parseFloat(p.amount).toFixed(2)}</td>
        <td style="text-transform:capitalize">${p.gateway}</td>
        <td><span style="color:${sc[p.status]||'#dde8f5'};font-weight:700;text-transform:uppercase;font-size:11px">${p.status}</span></td>
        <td>${proofCell}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#8ba4c0"
            title="${(p.proof_notes||'').replace(/"/g,'')}">${p.proof_notes || '—'}</td>
        <td style="font-size:11px;color:#4a6580">${new Date(p.created_at).toLocaleString()}</td>
        <td>${actionCell}</td>
      </tr>`;
    }).join('');
  }

  function filterPayments(status) {
    loadPayments(status);
  }

  function viewProof(url) {
    const lb  = document.getElementById('fxsim-proof-lightbox');
    const img = document.getElementById('fxsim-proof-img');
    if (lb && img) { img.src = url; lb.style.display = 'flex'; }
  }

  async function approvePayment(orderId, userLogin) {
    if (!confirm(`Approve payment for ${userLogin}? This will activate their challenge account.`)) return;
    const note = prompt('Admin note (optional):') || '';
    const res  = await req(`/admin/payments/${orderId}/approve`, 'POST', { note });
    if (res.success) { alert('✅ Payment approved. Challenge account activated!'); loadPayments(currentPaymentFilter); }
    else alert('Error: ' + (res.message || 'Unknown error'));
  }

  let rejectOrderId = 0;
  function openRejectModal(orderId) {
    rejectOrderId = orderId;
    document.getElementById('reject-order-id').textContent = orderId;
    document.getElementById('reject-note').value = '';
    document.getElementById('fxsim-reject-modal').style.display = 'flex';
  }

  async function submitReject() {
    const note = document.getElementById('reject-note').value.trim();
    if (!note) { alert('Please provide a rejection reason.'); return; }
    const res  = await req(`/admin/payments/${rejectOrderId}/reject`, 'POST', { note });
    document.getElementById('fxsim-reject-modal').style.display = 'none';
    if (res.success) { loadPayments(currentPaymentFilter); }
    else alert('Error: ' + (res.message || 'Unknown error'));
  }

  // ── Auto-init ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const page = new URLSearchParams(location.search).get('page');
    if (page === 'fxsim')             loadDashboard();
    if (page === 'fxsim-users')       searchUsers();
    if (page === 'fxsim-trades')      loadTrades();
    if (page === 'fxsim-symbols')     loadSymbols();
    if (page === 'fxsim-log')         loadLog();
    if (page === 'fxsim-challenges')  loadAdminChallenges();
    if (page === 'fxsim-plans')       loadAdminPlans();
    if (page === 'fxsim-payments')    loadPayments('pending');
    if (page === 'fxsim-payouts')     loadPayouts();
    if (page === 'fxsim-whitelabel')  loadWhitelabel();
    if (page === 'fxsim-risk')        initRisk();
    // Inject floating theme toggle and apply saved preference on every fxsim page
    if (page && page.startsWith('fxsim')) initAdminTheme();
  });

  // ── Admin day/night theme toggle ──────────────────────────────────────────
  function initAdminTheme() {
    // Restore saved preference (defaults to dark)
    const saved = localStorage.getItem('fxsim_admin_theme') || 'dark';
    applyAdminTheme(saved, false);

    // Inject floating toggle button (once)
    if (!document.getElementById('fxsim-admin-theme-btn')) {
      const btn = document.createElement('button');
      btn.id        = 'fxsim-admin-theme-btn';
      btn.title     = 'Toggle admin theme';
      btn.setAttribute('aria-label', 'Toggle admin light/dark mode');
      btn.onclick   = () => {
        const current = document.body.classList.contains('fxsim-admin-light') ? 'light' : 'dark';
        applyAdminTheme(current === 'dark' ? 'light' : 'dark', true);
      };
      document.body.appendChild(btn);
      updateAdminThemeBtn(saved);
    }
  }

  function applyAdminTheme(theme, save) {
    document.body.classList.toggle('fxsim-admin-light', theme === 'light');
    updateAdminThemeBtn(theme);
    if (save) localStorage.setItem('fxsim_admin_theme', theme);
  }

  function updateAdminThemeBtn(theme) {
    const btn = document.getElementById('fxsim-admin-theme-btn');
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title       = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }

  // ════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ════════════════════════════════════════════════════════════════════════

  const anCharts = {}; // cache Chart.js instances

  function mkChart(id, config) {
    if (anCharts[id]) { anCharts[id].destroy(); }
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    anCharts[id] = new Chart(ctx, config);
    return anCharts[id];
  }

  function switchAnalyticsTab(tab) {
    document.querySelectorAll('.fxsim-atab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.fxsim-atab-content').forEach(el => el.classList.toggle('active', el.id === 'atab-' + tab));
    if (tab === 'revenue')    loadAnalyticsRevenue();
    if (tab === 'growth')     loadAnalyticsGrowth();
    if (tab === 'challenges') loadAnalyticsChallenges();
  }

  async function initAnalytics() {
    // Wire tabs
    document.querySelectorAll('.fxsim-atab').forEach(btn => {
      btn.addEventListener('click', () => switchAnalyticsTab(btn.dataset.tab));
    });
    // Load first tab
    loadAnalyticsRevenue();
  }

  async function loadAnalyticsRevenue() {
    const d = await req('/admin/analytics/revenue');
    if (!d || d.error) return;

    // KPIs
    const months  = d.monthly || [];
    const thisMonth = months[months.length - 1]?.total || 0;
    const total   = d.total || 0;
    const allSales = (d.by_plan || []).reduce((s, p) => s + (parseInt(p.sales) || 0), 0);
    const avg     = allSales > 0 ? total / allSales : 0;
    document.getElementById('an-rev-total')?.let?.(el => el.textContent = f2(total));
    document.getElementById('an-rev-month')?.let?.(el => el.textContent = f2(parseFloat(thisMonth)));
    document.getElementById('an-rev-avg')?.let?.(el => el.textContent = f2(avg));

    // Safer assignment
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('an-rev-total', f2(total));
    setEl('an-rev-month', f2(parseFloat(thisMonth)));
    setEl('an-rev-avg',   f2(avg));

    // Monthly revenue chart
    mkChart('an-revenue-chart', {
      type: 'bar',
      data: {
        labels:   months.map(m => m.month),
        datasets: [{
          label: 'Revenue ($)',
          data:  months.map(m => parseFloat(m.total || 0)),
          backgroundColor: 'rgba(0,212,255,0.7)',
          borderRadius: 4,
        }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });

    // By-plan doughnut
    const plans = d.by_plan || [];
    mkChart('an-plan-chart', {
      type: 'doughnut',
      data: {
        labels:   plans.map(p => p.plan_name),
        datasets: [{ data: plans.map(p => parseFloat(p.revenue || 0)),
          backgroundColor: ['#00d4ff','#00e5a0','#ffd32a','#ff6b8a','#a78bfa','#34d399'] }],
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } },
    });
  }

  async function loadAnalyticsGrowth() {
    const d = await req('/admin/analytics/growth');
    if (!d || d.error) return;

    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setEl('an-gr-users',      d.total_users);
    setEl('an-gr-challenges', d.total_challenges);
    setEl('an-gr-funded',     d.total_funded);

    // Build unified month labels
    const allMonths = [...new Set([
      ...(d.new_users || []).map(r => r.month),
      ...(d.new_challenges || []).map(r => r.month),
      ...(d.funded_monthly || []).map(r => r.month),
    ])].sort();

    const byMonth = (arr) => {
      const map = Object.fromEntries((arr || []).map(r => [r.month, parseInt(r.count)]));
      return allMonths.map(m => map[m] || 0);
    };

    mkChart('an-growth-chart', {
      type: 'line',
      data: {
        labels: allMonths,
        datasets: [
          { label: 'New Traders',   data: byMonth(d.new_users),       borderColor:'#00d4ff', tension:.3, fill:false },
          { label: 'Challenges',    data: byMonth(d.new_challenges),   borderColor:'#00e5a0', tension:.3, fill:false },
          { label: 'Funded',        data: byMonth(d.funded_monthly),   borderColor:'#ffd32a', tension:.3, fill:false },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'top' } } },
    });
  }

  async function loadAnalyticsChallenges() {
    const d = await req('/admin/analytics/challenges');
    if (!d || d.error) return;

    const statusColors = { active:'#00d4ff', funded:'#00e5a0', failed:'#ff4757', passed:'#a78bfa', expired:'#ffd32a' };
    const statuses = d.status_counts || [];
    mkChart('an-status-chart', {
      type: 'doughnut',
      data: {
        labels:   statuses.map(s => s.status),
        datasets: [{ data: statuses.map(s => parseInt(s.count)),
          backgroundColor: statuses.map(s => statusColors[s.status] || '#8ba4c0') }],
      },
      options: { responsive: true, plugins: { legend: { position: 'right' } } },
    });

    const breaches = d.breach_reasons || [];
    if (breaches.length) {
      mkChart('an-breach-chart', {
        type: 'bar',
        data: {
          labels:   breaches.map(b => b.breach_type),
          datasets: [{ label: 'Count', data: breaches.map(b => parseInt(b.count)),
            backgroundColor: '#ff4757', borderRadius: 4 }],
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display:false } } },
      });
    }

    // Pass rate table
    const tableEl = document.getElementById('an-passrate-table');
    if (tableEl) {
      tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f0f0f0">
          <th style="padding:8px;text-align:left">Plan</th>
          <th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Days</th>
        </tr></thead>
        <tbody>
          ${(d.pass_rates || []).map(p => {
            const pct = p.total > 0 ? Math.round(p.passed / p.total * 100) : 0;
            return `<tr style="border-bottom:1px solid #eee">
              <td style="padding:8px;font-weight:600">${p.plan_name}</td>
              <td style="text-align:center">${p.total}</td>
              <td style="text-align:center;color:#00a060">${p.passed}</td>
              <td style="text-align:center;color:#c0392b">${p.failed}</td>
              <td style="text-align:center;font-weight:700;color:${pct>=50?'#00a060':'#c0392b'}">${pct}%</td>
              <td style="text-align:center">${parseFloat(p.avg_trading_days||0).toFixed(1)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    }
  }

  // Auto-init analytics page
  if (document.getElementById('atab-revenue')) {
    document.addEventListener('DOMContentLoaded', initAnalytics);
  }

  // ════════════════════════════════════════════════════════════════════════
  // ADMIN TOOLS
  // ════════════════════════════════════════════════════════════════════════

  function showToolMsg(id, msg, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = ok ? '#00a060' : '#c0392b';
  }

  async function doImpersonate() {
    const uid = parseInt(document.getElementById('impersonate-uid')?.value || 0);
    if (!uid) return showToolMsg('impersonate-msg', 'Enter a valid User ID.', false);
    if (!confirm(`View platform as user ID ${uid}? You will be redirected.`)) return;
    const res = await req('/admin/impersonate', 'POST', { user_id: uid });
    if (res?.success) {
      showToolMsg('impersonate-msg', '✓ Redirecting…', true);
      setTimeout(() => { window.location.href = res.redirect_url; }, 800);
    } else {
      showToolMsg('impersonate-msg', '✗ ' + (res?.error || 'Failed.'), false);
    }
  }

  async function saveAnnouncement() {
    const message = document.getElementById('ann-message')?.value || '';
    const type    = document.getElementById('ann-type')?.value || 'info';
    const expires = parseInt(document.getElementById('ann-expires')?.value || 0);
    const res = await req('/admin/announcement', 'POST', { message, type, expires });
    showToolMsg('ann-msg', res?.success ? '✓ Announcement saved.' : '✗ Failed.', !!res?.success);
  }

  async function clearAnnouncement() {
    const res = await req('/admin/announcement', 'POST', { message: '' });
    const el = document.getElementById('ann-message');
    if (el) el.value = '';
    showToolMsg('ann-msg', res?.success ? '✓ Announcement cleared.' : '✗ Failed.', !!res?.success);
  }

  async function setMaintenance(enabled) {
    const msg   = document.getElementById('maintenance-msg')?.value || '';
    const res   = await req('/admin/maintenance', 'POST', { enabled, message: msg });
    const label = document.getElementById('maintenance-status');
    if (label && res?.success) {
      label.textContent = enabled ? '🔴 ACTIVE — Platform locked' : '🟢 OFF — Platform live';
      label.style.color = enabled ? '#c0392b' : '#00a060';
    }
  }

  async function saveMaintenance() {
    const enabled = document.getElementById('maintenance-toggle')?.checked || false;
    const msg     = document.getElementById('maintenance-msg')?.value || '';
    const res = await req('/admin/maintenance', 'POST', { enabled, message: msg });
    showToolMsg('fxsim-tools-msg', res?.success ? '✓ Saved.' : '✗ Failed.', !!res?.success);
  }

  // ════════════════════════════════════════════════════════════════════════
  // BULK EMAIL
  // ════════════════════════════════════════════════════════════════════════

  const segCounts = { all: 0, active: 0, funded: 0, failed: 0 };

  function updateSegmentCount() {
    const seg = document.getElementById('bulk-segment')?.value;
    const hint = document.getElementById('bulk-segment-hint');
    if (hint && seg && segCounts[seg] !== undefined) {
      hint.textContent = `Will send to ${segCounts[seg]} recipients`;
    }
  }

  async function sendBulkEmail() {
    const subject = document.getElementById('bulk-subject')?.value?.trim();
    const message = document.getElementById('bulk-message')?.value?.trim();
    const segment = document.getElementById('bulk-segment')?.value || 'all';
    const btn     = document.getElementById('bulk-send-btn');
    const msgEl   = document.getElementById('bulk-email-msg');

    if (!subject || !message) {
      if (msgEl) { msgEl.textContent = '✗ Subject and message required.'; msgEl.style.color = '#c0392b'; }
      return;
    }
    const count = segCounts[segment] || '?';
    if (!confirm(`Send to ${count} recipients? This cannot be undone.`)) return;

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }
    const res = await req('/admin/bulk-email', 'POST', { subject, message, segment });
    if (btn) { btn.disabled = false; btn.textContent = '📤 Send Email'; }
    if (msgEl) {
      if (res?.success) {
        msgEl.textContent = `✓ Sent to ${res.sent} / ${res.total} recipients.`;
        msgEl.style.color = '#00a060';
      } else {
        msgEl.textContent = `✗ ${res?.error || 'Failed.'}`;
        msgEl.style.color = '#c0392b';
      }
    }
  }


  // ── MT5 credential management ─────────────────────────────────────────────

  function openMT5Modal(challengeId) {
    document.getElementById('mt5-challenge-id').value   = challengeId;
    document.getElementById('mt5-login-input').value    = '';
    document.getElementById('mt5-password-input').value = '';
    document.getElementById('mt5-server-input').value   = '';
    document.getElementById('mt5-type-input').value     = 'Live';
    document.getElementById('mt5-modal-msg').textContent = '';
    document.getElementById('fxsim-mt5-modal').style.display = 'flex';
  }

  async function saveMT5Details() {
    const id  = document.getElementById('mt5-challenge-id')?.value;
    const msg = document.getElementById('mt5-modal-msg');
    const body = {
      mt5_login:        document.getElementById('mt5-login-input')?.value?.trim()    || '',
      mt5_password:     document.getElementById('mt5-password-input')?.value?.trim() || '',
      mt5_server:       document.getElementById('mt5-server-input')?.value?.trim()   || '',
      mt5_account_type: document.getElementById('mt5-type-input')?.value             || 'Live',
    };
    if (!body.mt5_login || !body.mt5_password || !body.mt5_server) {
      if (msg) { msg.textContent = 'Login, password, and server are required.'; msg.style.color = '#c0392b'; }
      return;
    }
    const res = await req('/admin/challenge/' + id + '/mt5-details', 'POST', body);
    if (msg) {
      msg.textContent = res?.success
        ? '✓ MT5 details saved. Trader has been notified.'
        : '✗ ' + (res?.error || 'Failed.');
      msg.style.color = res?.success ? '#00a060' : '#c0392b';
    }
    if (res?.success) {
      setTimeout(() => { document.getElementById('fxsim-mt5-modal').style.display = 'none'; }, 1500);
    }
  }

  return {
    searchUsers, openAdjust, submitAdjust, saveSymbol, forcePrices, clearCache,
    toggleStatus, newPlan, editPlan, savePlan, approvePayoutAction, saveWhitelabel, saveEmailTemplate,
    loadPayments, filterPayments, viewProof, approvePayment, openRejectModal, submitReject,
    toggleNewsLock, saveRateLimit, saveSMTP, testSMTP, savePriceFeed,
    openPayoutModal, confirmPayoutAction, exportPayoutsCSV, loadPayouts,
    openMT5Modal, saveMT5Details, bulkApprovePayouts,
    // Analytics
    initAnalytics, switchAnalyticsTab,
    // Admin tools
    doImpersonate, saveAnnouncement, clearAnnouncement, setMaintenance, saveMaintenance,
    // Bulk email
    sendBulkEmail, updateSegmentCount,
  };
})();
