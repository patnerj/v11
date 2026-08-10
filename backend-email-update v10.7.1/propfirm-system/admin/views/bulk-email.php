<?php defined('ABSPATH') || exit;
global $wpdb;
$seg_counts = [
  'all'    => (int)$wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}users"),
  'active' => (int)$wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status='active'"),
  'funded' => (int)$wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status='funded'"),
  'failed' => (int)$wpdb->get_var("SELECT COUNT(DISTINCT user_id) FROM {$wpdb->prefix}fxsim_challenge_accounts WHERE status='failed'"),
];
?>
<div class="wrap fxsim-admin">
  <h1>Bulk Email</h1>
  <p class="description">Send a branded HTML email to a segment of traders. Use <code>{name}</code> for personalisation. Sent via your WordPress email configuration.</p>

  <div class="fxsim-tool-card" style="max-width:700px">
    <div style="display:grid;gap:14px">

      <div>
        <label for="bulk-segment" style="display:block;font-weight:600;margin-bottom:6px">Recipient Segment</label>
        <select id="bulk-segment" class="regular-text" onchange="fxsimAdmin.updateSegmentCount()" style="width:100%">
          <option value="all">All Traders (<?= $seg_counts['all'] ?> users)</option>
          <option value="active">Active Challenges (<?= $seg_counts['active'] ?> users)</option>
          <option value="funded">Funded Accounts (<?= $seg_counts['funded'] ?> users)</option>
          <option value="failed">Failed Challenges (<?= $seg_counts['failed'] ?> users)</option>
        </select>
        <div id="bulk-segment-hint" style="font-size:12px;color:#888;margin-top:4px">
          Will send to <?= $seg_counts['all'] ?> recipients
        </div>
      </div>

      <div>
        <label for="bulk-subject" style="display:block;font-weight:600;margin-bottom:6px">Subject Line</label>
        <input type="text" id="bulk-subject" class="large-text" placeholder="Your email subject…">
      </div>

      <div>
        <label for="bulk-message" style="display:block;font-weight:600;margin-bottom:6px">Message (HTML supported)</label>
        <textarea id="bulk-message" rows="8" class="large-text"
          placeholder="Hi {name},&#10;&#10;Your message here..."></textarea>
      </div>

      <div style="display:flex;align-items:center;gap:12px">
        <button class="button button-primary" onclick="fxsimAdmin.sendBulkEmail()" id="bulk-send-btn">
          📤 Send Email
        </button>
        <span id="bulk-email-msg" style="font-size:13px;font-weight:600"></span>
      </div>
    </div>
  </div>
</div>
