<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Challenge Accounts</h1>
  <div id="fxsim-challenge-summary" style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap"></div>
  <table class="wp-list-table widefat fixed striped" id="fxsim-challenges-table">
    <thead><tr>
      <th>ID</th><th>User</th><th>Plan</th><th>Account Size</th>
      <th>Phase</th><th>Status</th><th>Balance</th><th>Started</th><th>Actions</th>
    </tr></thead>
    <tbody id="fxsim-challenges-body"><tr><td colspan="9">Loading…</td></tr></tbody>
  </table>

  <!-- MT5 Details Modal -->
  <div id="fxsim-mt5-modal" class="fxsim-modal" style="display:none">
    <div class="fxsim-modal-box" style="min-width:420px;max-width:500px">
      <h3>Assign MT5 Details</h3>
      <p style="font-size:13px;color:#666;margin:4px 0 16px">
        Assign MetaTrader 5 credentials to this funded account.
        The trader will see these on their dashboard.
      </p>
      <input type="hidden" id="mt5-challenge-id">
      <div style="display:grid;gap:12px">
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px">MT5 Login ID</label>
          <input type="text" id="mt5-login-input" class="large-text" placeholder="e.g. 12345678">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px">MT5 Password</label>
          <input type="text" id="mt5-password-input" class="large-text" placeholder="Trader's MT5 password">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px">MT5 Server</label>
          <input type="text" id="mt5-server-input" class="large-text" placeholder="e.g. BrokerName-Live">
        </div>
        <div>
          <label style="display:block;font-weight:600;margin-bottom:4px">Account Type</label>
          <select id="mt5-type-input" class="regular-text">
            <option value="Live">Live</option>
            <option value="Live Hedging">Live Hedging</option>
            <option value="ECN Live">ECN Live</option>
            <option value="Raw Spread">Raw Spread</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="button button-primary" onclick="fxsimAdmin.saveMT5Details()">Save & Notify Trader</button>
        <button class="button" onclick="document.getElementById('fxsim-mt5-modal').style.display='none'">Cancel</button>
      </div>
      <div id="mt5-modal-msg" style="margin-top:8px;font-size:13px;font-weight:600"></div>
    </div>
  </div>
</div>
