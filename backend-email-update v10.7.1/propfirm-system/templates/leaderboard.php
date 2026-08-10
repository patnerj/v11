<?php defined('ABSPATH') || exit;
$brand = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name','PropFirm System') : 'PropFirm System';
?>
<div class="fxsim-dash" id="fxsim-leaderboard">
  <?php $active = 'leaderboard'; include FXSIM_DIR . 'templates/nav.php'; ?>
  <div class="fxdb-body">
    <div style="text-align:center;margin-bottom:36px">
      <h1 class="fxdb-title" style="font-size:32px">🏆 Top Traders</h1>
      <p class="fxdb-subtitle">Live leaderboard of our best performing challenge traders</p>
    </div>
    <div class="fxdb-card">
      <table class="fxdb-table" id="fxlb-table">
        <thead>
          <tr>
            <th style="width:50px">Rank</th>
            <th>Trader</th>
            <th>Challenge</th>
            <th>Account Size</th>
            <th>Profit %</th>
            <th>Trading Days</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="fxlb-body"><tr class="fxdb-tr-empty"><td colspan="7">Loading…</td></tr></tbody>
      </table>
    </div>
    <p style="text-align:center;margin-top:28px">
      <a href="<?= home_url('/register/') ?>" class="fxdb-btn-primary">Join the Challenge →</a>
    </p>
  </div>
</div>
