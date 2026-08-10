<?php defined('ABSPATH') || exit; ?>
<div class="fxsim-dash" id="fxsim-challenges">

  <?php $active = 'challenges'; include FXSIM_DIR . 'templates/nav.php'; ?>

  <div class="fxdb-body">

    <div class="fxdb-header">
      <div>
        <h1 class="fxdb-title">Challenge Programs</h1>
        <p class="fxdb-subtitle">Choose your account size and start your funded trader journey</p>
      </div>
    </div>

    <!-- Plans grid (loaded by JS) -->
    <div class="fxch-plans-grid" id="fxch-plans-grid">
      <div class="fxdb-loading">Loading programs…</div>
    </div>

    <!-- How It Works — 3-card grid -->
    <section class="fxch-hiw-section">
      <h2 class="fxch-section-title">How It Works</h2>
      <div class="fxch-hiw-grid">
        <div class="fxch-hiw-card">
          <div class="fxch-hiw-num">1</div>
          <div class="fxch-hiw-icon"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('target','28') : '' ?></div>
          <h3>Phase 1 — Evaluation</h3>
          <p>Hit your profit target while respecting daily and maximum drawdown limits within the allowed timeframe.</p>
        </div>
        <div class="fxch-hiw-card fxch-hiw-featured">
          <div class="fxch-hiw-num">2</div>
          <div class="fxch-hiw-icon"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('activity','28') : '' ?></div>
          <h3>Phase 2 — Verification</h3>
          <p>Demonstrate consistency with a lower profit target under the same risk rules over more trading days.</p>
        </div>
        <div class="fxch-hiw-card">
          <div class="fxch-hiw-num">3</div>
          <div class="fxch-hiw-icon"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('payout','28') : '' ?></div>
          <h3>Funded — Trade & Earn</h3>
          <p>Receive a funded account, trade our capital, and keep up to 85% of your profits. Request payouts anytime.</p>
        </div>
      </div>
    </section>

    <!-- My payment orders -->
    <div class="fxdb-card" style="margin-top:24px">
      <div class="fxdb-card-title">My Payment Orders</div>
      <table class="fxdb-table">
        <thead><tr><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Submitted</th><th>Note</th></tr></thead>
        <tbody id="fxch-orders-body"><tr class="fxdb-tr-empty"><td colspan="6">No payment orders yet.</td></tr></tbody>
      </table>
    </div>

    <!-- My challenges history -->
    <div class="fxdb-card" style="margin-top:24px">
      <div class="fxdb-card-title">My Challenge History</div>
      <table class="fxdb-table">
        <thead><tr><th>Plan</th><th>Account Size</th><th>Phase</th><th>Status</th><th>Started</th><th>Action</th></tr></thead>
        <tbody id="fxch-history-body"><tr class="fxdb-tr-empty"><td colspan="6">No challenges yet.</td></tr></tbody>
      </table>
    </div>

  </div>

  <!-- Start challenge / payment modal -->
  <div class="fxdb-modal-overlay" id="fxch-modal" style="display:none">
    <div class="fxdb-modal-box">
      <h3 id="fxch-modal-title">Challenge</h3>
      <div id="fxch-modal-body"></div>
      <div class="fxdb-modal-actions" id="fxch-modal-actions"></div>
      <div id="fxch-modal-msg" style="margin-top:10px;font-size:13px"></div>
    </div>
  </div>

</div>
