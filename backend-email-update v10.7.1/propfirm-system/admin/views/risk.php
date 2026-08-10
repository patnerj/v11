<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Risk Management</h1>

  <div class="fxsim-analytics-tabs">
    <button class="fxsim-atab active" data-tab="exposure">Exposure Heatmap</button>
    <button class="fxsim-atab" data-tab="toxic">Toxic Flow / B-Book</button>
  </div>

  <!-- Exposure Tab -->
  <div class="fxsim-atab-content active" id="atab-exposure">
    <div class="fxsim-achart-card" style="max-width:100%">
      <div class="fxsim-achart-title">Live Firm Exposure (Net Lots)</div>
      <div id="fxsim-exposure-heatmap" style="display:flex; flex-wrap:wrap; gap:16px; margin-top:16px;">
        <!-- Heatmap blocks generated via JS -->
      </div>
    </div>
  </div>

  <!-- Toxic Flow Tab -->
  <div class="fxsim-atab-content" id="atab-toxic">
    <div class="fxsim-achart-card" style="max-width:100%">
      <div class="fxsim-achart-title">Toxic Flow Detection (Arbitrage / HFT)</div>
      <table class="wp-list-table widefat fixed striped">
        <thead>
          <tr>
            <th>Trader ID</th>
            <th>Username</th>
            <th>Flag Reason</th>
            <th>Detected Trades</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="fxsim-toxic-body">
          <tr><td colspan="5" style="text-align:center;padding:20px;color:#888;">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div id="fxsim-risk-msg" style="margin-top:12px;font-weight:600;color:#888"></div>
</div>
