<?php defined('ABSPATH') || exit; ?>
<div class="fxsim-dash" id="fxsim-statistics">
  <?php $active = 'statistics'; include FXSIM_DIR . 'templates/nav.php'; ?>

  <div class="fxdb-body">
    <div class="fxdb-header">
      <div>
        <h1 class="fxdb-title">Trading Statistics</h1>
        <p class="fxdb-subtitle">Detailed performance analysis of your active challenge</p>
      </div>
    </div>

    <!-- No challenge state -->
    <div id="fxst-no-challenge" style="display:none" class="fxdb-empty">
      <div class="fxdb-empty-icon">📊</div>
      <h3>No Active Challenge</h3>
      <p>Start a challenge to track your statistics.</p>
      <a href="<?= home_url('/challenges/') ?>" class="fxdb-btn-primary">Browse Challenges →</a>
    </div>

    <!-- Stats content -->
    <div id="fxst-content" style="display:none">

      <!-- Top KPI row -->
      <div class="fxst-kpi-grid" id="fxst-kpis"></div>

      <!-- Charts row -->
      <div class="fxst-charts-row">
        <div class="fxdb-card" style="flex:2">
          <div class="fxdb-card-title">Equity Curve</div>
          <div style="position:relative;height:220px">
            <canvas id="fxst-equity-chart"></canvas>
          </div>
        </div>
        <div class="fxdb-card" style="flex:1">
          <div class="fxdb-card-title">Win / Loss Ratio</div>
          <div style="position:relative;height:220px;display:flex;align-items:center;justify-content:center">
            <canvas id="fxst-winloss-chart"></canvas>
          </div>
        </div>
      </div>

      <!-- Symbol breakdown + trade metrics -->
      <div class="fxst-lower-row">
        <div class="fxdb-card">
          <div class="fxdb-card-title">By Symbol</div>
          <div class="fxdb-table-wrap">
            <table class="fxdb-table" id="fxst-symbol-table">
              <thead><tr><th>Symbol</th><th>Trades</th><th>Win Rate</th><th>Net P&L</th></tr></thead>
              <tbody id="fxst-symbol-body"></tbody>
            </table>
          </div>
        </div>
        <div class="fxdb-card">
          <div class="fxdb-card-title">Trade Metrics</div>
          <div class="fxdb-stat-list" id="fxst-metrics"></div>
        </div>
      </div>

      <!-- Recent trades -->
      <div class="fxdb-card" style="margin-top:16px">
        <div class="fxdb-card-title">Recent Trades</div>
        <div class="fxdb-table-wrap">
          <table class="fxdb-table">
            <thead><tr><th>Symbol</th><th>Type</th><th>Lots</th><th>Open</th><th>Close</th><th>P&L</th><th>Date</th></tr></thead>
            <tbody id="fxst-trades-body"></tbody>
          </table>
        </div>
      </div>

      <!-- ── Advanced Analytics ──────────────────────────────────────── -->
      <div id="fxst-advanced" style="display:none;margin-top:24px">
        <div class="fxdb-card-title" style="margin-bottom:14px;font-size:16px">⚡ Advanced Analytics</div>

        <!-- R/R + Drawdown row -->
        <div class="fxst-charts-row" style="margin-bottom:16px">
          <div class="fxdb-card">
            <div class="fxdb-card-title">Risk / Reward Tracker</div>
            <div style="margin-bottom:10px">
              <span style="font-size:12px;color:var(--text-muted)">Average R:R</span>
              <strong id="fxst-avg-rr" style="font-size:22px;font-family:var(--mono);margin-left:10px;color:var(--accent)">—</strong>
            </div>
            <div style="position:relative;height:160px"><canvas id="fxst-rr-chart"></canvas></div>
          </div>
          <div class="fxdb-card">
            <div class="fxdb-card-title">Drawdown Curve</div>
            <div style="position:relative;height:200px"><canvas id="fxst-dd-chart"></canvas></div>
          </div>
        </div>

        <!-- Hours / Days heatmap row -->
        <div class="fxst-charts-row">
          <div class="fxdb-card">
            <div class="fxdb-card-title">Best Trading Hours (UTC)</div>
            <div style="position:relative;height:180px"><canvas id="fxst-hours-chart"></canvas></div>
          </div>
          <div class="fxdb-card">
            <div class="fxdb-card-title">Best Trading Days</div>
            <div style="position:relative;height:180px"><canvas id="fxst-days-chart"></canvas></div>
          </div>
        </div>
      </div><!-- /fxst-advanced -->

    </div>
  </div>
</div>
<!-- statistics.js loaded via wp_enqueue_script (with Chart.js dependency) -->
