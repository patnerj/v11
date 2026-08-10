<?php defined('ABSPATH') || exit; ?>
<div class="wrap fxsim-admin">
  <h1>Analytics</h1>

  <!-- Tab bar -->
  <div class="fxsim-analytics-tabs">
    <button class="fxsim-atab active" data-tab="revenue">Revenue</button>
    <button class="fxsim-atab" data-tab="growth">Growth</button>
    <button class="fxsim-atab" data-tab="challenges">Challenges</button>
  </div>

  <!-- Revenue tab -->
  <div class="fxsim-atab-content active" id="atab-revenue">
    <div class="fxsim-analytics-kpis" id="an-revenue-kpis">
      <div class="fxsim-akpi"><span>Total Revenue</span><strong id="an-rev-total">—</strong></div>
      <div class="fxsim-akpi"><span>This Month</span><strong id="an-rev-month">—</strong></div>
      <div class="fxsim-akpi"><span>Avg per Sale</span><strong id="an-rev-avg">—</strong></div>
    </div>
    <div class="fxsim-analytics-row">
      <div class="fxsim-achart-card">
        <div class="fxsim-achart-title">Monthly Revenue (12 months)</div>
        <canvas id="an-revenue-chart" height="200"></canvas>
      </div>
      <div class="fxsim-achart-card">
        <div class="fxsim-achart-title">Revenue by Plan</div>
        <canvas id="an-plan-chart" height="200"></canvas>
      </div>
    </div>
  </div>

  <!-- Growth tab -->
  <div class="fxsim-atab-content" id="atab-growth">
    <div class="fxsim-analytics-kpis" id="an-growth-kpis">
      <div class="fxsim-akpi"><span>Total Traders</span><strong id="an-gr-users">—</strong></div>
      <div class="fxsim-akpi"><span>Total Challenges</span><strong id="an-gr-challenges">—</strong></div>
      <div class="fxsim-akpi"><span>Funded Accounts</span><strong id="an-gr-funded" style="color:#00e5a0">—</strong></div>
    </div>
    <div class="fxsim-achart-card" style="max-width:100%">
      <div class="fxsim-achart-title">Trader & Challenge Growth (12 months)</div>
      <canvas id="an-growth-chart" height="160"></canvas>
    </div>
  </div>

  <!-- Challenges tab -->
  <div class="fxsim-atab-content" id="atab-challenges">
    <div class="fxsim-analytics-row">
      <div class="fxsim-achart-card">
        <div class="fxsim-achart-title">Challenge Status Breakdown</div>
        <canvas id="an-status-chart" height="200"></canvas>
      </div>
      <div class="fxsim-achart-card">
        <div class="fxsim-achart-title">Failure Reasons</div>
        <canvas id="an-breach-chart" height="200"></canvas>
      </div>
    </div>
    <div class="fxsim-achart-card" style="max-width:100%;margin-top:16px">
      <div class="fxsim-achart-title">Pass Rate by Plan</div>
      <div id="an-passrate-table" style="overflow-x:auto"></div>
    </div>
  </div>

  <div id="fxsim-analytics-msg" style="margin-top:12px;font-weight:600;color:#888"></div>
</div>
