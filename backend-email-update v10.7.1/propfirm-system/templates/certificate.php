<?php defined('ABSPATH') || exit;
$brand   = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name','PropFirm System') : 'PropFirm System';
$primary = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('primary_color','#00d4ff') : '#00d4ff';
?>
<div class="fxsim-dash" id="fxsim-certificate-page">
  <?php $active = 'certificate'; include FXSIM_DIR . 'templates/nav.php'; ?>
  <div class="fxdb-body" style="max-width:860px">
    <div id="fxcert-loading" style="text-align:center;padding:80px 40px">
      <div style="width:44px;height:44px;border:3px solid var(--border2);border-top-color:var(--accent);border-radius:50%;animation:fx-spin 1s linear infinite;margin:0 auto 20px"></div>
      <p style="color:var(--text-muted);font-size:14px">Loading certificate…</p>
    </div>
    <div id="fxcert-error" style="display:none;text-align:center;padding:80px 40px">
      <div class="fxcert-empty-icon">
        <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('award','48') : '🏆' ?>
      </div>
      <h2 style="color:var(--text);font-size:22px;margin-bottom:12px">No Certificate Yet</h2>
      <p style="color:var(--text-dim);font-size:15px;max-width:420px;margin:0 auto 28px;line-height:1.6">
        Complete all challenge phases to earn your funded trader certificate. Start a challenge to begin your journey.
      </p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="<?= home_url('/challenges/') ?>" class="fxdb-btn-primary">Browse Challenges →</a>
        <a href="<?= home_url('/dashboard/') ?>" class="fxdb-btn-ghost">My Dashboard</a>
      </div>
    </div>

    <!-- Certificate card -->
    <div id="fxcert-card" style="display:none">
      <div class="fxcert-wrap" id="fxcert-printable">
        <div class="fxcert-border">
          <div class="fxcert-header">
            <div class="fxcert-logo"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('zap','20') : '⚡' ?> <span id="fxcert-brand"></span></div>
            <div class="fxcert-subtitle">Certificate of Achievement</div>
          </div>
          <div class="fxcert-body">
            <p class="fxcert-presents">This certifies that</p>
            <h1 class="fxcert-name" id="fxcert-trader-name"></h1>
            <p class="fxcert-text">has successfully completed all phases of the</p>
            <h2 class="fxcert-plan" id="fxcert-plan-name"></h2>
            <p class="fxcert-text">and has been awarded a</p>
            <div class="fxcert-funded-badge">
              <span id="fxcert-account-size"></span> Funded Account
            </div>
            <p class="fxcert-text" style="margin-top:20px">with a profit split of <strong id="fxcert-split"></strong></p>
          </div>
          <div class="fxcert-footer">
            <div class="fxcert-seal">✦</div>
            <div class="fxcert-date">Issued: <span id="fxcert-date"></span></div>
            <div class="fxcert-id">Certificate #<span id="fxcert-id"></span></div>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:24px;display:flex;gap:12px;justify-content:center" class="fxcert-actions">
        <button class="fxdb-btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <a href="<?= home_url('/dashboard/') ?>" class="fxdb-btn-ghost">← Dashboard</a>
      </div>
    </div>
  </div>
</div>

<style>
@media print {
  .fxdb-nav, .fxcert-actions, #wpadminbar { display:none !important; }
  .fxdb-body { max-width:100% !important; padding:0 !important; }
  .fxcert-wrap { box-shadow:none !important; }
}
.fxcert-wrap {
  background: linear-gradient(135deg, #060b14 0%, #0a1020 50%, #060b14 100%);
  border-radius: 16px;
  padding: 4px;
  box-shadow: 0 0 60px rgba(0,212,255,.15), 0 20px 60px rgba(0,0,0,.6);
}
.fxcert-border {
  border: 2px solid <?= esc_attr($primary) ?>;
  border-radius: 14px;
  padding: 48px 56px;
  position: relative;
  text-align: center;
  background: linear-gradient(135deg, #080e1a 0%, #0a1020 100%);
}
.fxcert-border::before, .fxcert-border::after {
  content: '◆';
  position: absolute;
  font-size: 20px;
  color: <?= esc_attr($primary) ?>;
  opacity: .4;
}
.fxcert-border::before { top:16px; left:20px; }
.fxcert-border::after  { bottom:16px; right:20px; }
.fxcert-logo {
  font-size: 22px;
  font-weight: 800;
  color: <?= esc_attr($primary) ?>;
  text-shadow: 0 0 24px <?= esc_attr($primary) ?>44;
  margin-bottom: 6px;
}
.fxcert-subtitle {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 4px;
  color: var(--text-muted);
  margin-bottom: 36px;
}
.fxcert-presents {
  font-size: 15px;
  color: var(--text-muted);
  margin-bottom: 10px;
}
.fxcert-name {
  font-size: 40px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -1px;
  margin: 0 0 16px;
}
.fxcert-text {
  font-size: 15px;
  color: var(--text-muted);
  margin: 8px 0;
}
.fxcert-plan {
  font-size: 22px;
  font-weight: 700;
  color: <?= esc_attr($primary) ?>;
  margin: 8px 0 14px;
}
.fxcert-funded-badge {
  display: inline-block;
  background: linear-gradient(135deg, rgba(0,212,255,.15), rgba(0,229,160,.1));
  border: 1px solid <?= esc_attr($primary) ?>;
  color: <?= esc_attr($primary) ?>;
  font-size: 20px;
  font-weight: 800;
  padding: 12px 32px;
  border-radius: 40px;
  margin: 10px 0;
}
.fxcert-footer {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}
.fxcert-seal {
  font-size: 28px;
  color: <?= esc_attr($primary) ?>;
  opacity: .6;
}
</style>
