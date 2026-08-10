<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>PropFirm System — Dashboard</h1>
  <div class="fxsim-admin-stats" id="fxsim-stats-grid">
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">Total Accounts</span><span class="fxsim-stat-val" id="stat-users">—</span></div>
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">Active Challenges</span><span class="fxsim-stat-val" id="stat-active-challenges">—</span></div>
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">Funded Accounts</span><span class="fxsim-stat-val" id="stat-funded" style="color:#00e5a0">—</span></div>
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">⏳ Pending Payments</span><span class="fxsim-stat-val" id="stat-pending-payments" style="color:#ffd32a">—</span></div>
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">Open Positions</span><span class="fxsim-stat-val" id="stat-positions">—</span></div>
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">Total Trades</span><span class="fxsim-stat-val" id="stat-trades">—</span></div>
    <div class="fxsim-stat-card"><span class="fxsim-stat-label">Total P&L</span><span class="fxsim-stat-val" id="stat-pnl">—</span></div>
  </div>
  <p style="margin-top:16px">
    <button class="button button-primary" onclick="fxsimAdmin.forcePrices()">Force Price Refresh</button>
    <a href="admin.php?page=fxsim-payments" class="button" style="margin-left:8px">Review Payments</a>
  </p>

  <!-- System Health -->
  <h2 style="margin-top:24px">System Health</h2>
  <div id="fxsim-health-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:12px">
    <div class="fxsim-stat-card" id="health-cron">
      <span class="fxsim-stat-label">Price Cron</span>
      <span class="fxsim-stat-val" style="font-size:16px">Checking…</span>
    </div>
    <div class="fxsim-stat-card" id="health-feed">
      <span class="fxsim-stat-label">Price Feed</span>
      <span class="fxsim-stat-val" style="font-size:16px">Checking…</span>
    </div>
  </div>
</div>
