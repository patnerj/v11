<?php defined('ABSPATH') || exit;
$maintenance = get_option('fxsim_maintenance', ['enabled' => false, 'message' => '']);
$announcement = get_option('fxsim_announcement', []);
?>
<div class="wrap fxsim-admin">
  <h1>Admin Tools</h1>

  <!-- ── Impersonation ─────────────────────────────────────────────────── -->
  <div class="fxsim-tool-card">
    <h3>Impersonate Trader</h3>
    <p class="description">View the platform as a specific trader. You will be redirected to their dashboard. Your admin session is preserved — return via WP Admin.</p>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px">
      <input type="number" id="impersonate-uid" placeholder="User ID" style="width:140px" class="regular-text">
      <button class="button button-primary" onclick="fxsimAdmin.doImpersonate()">Impersonate →</button>
    </div>
    <div id="impersonate-msg" style="margin-top:8px;font-size:13px"></div>
  </div>

  <!-- ── Announcement banner ───────────────────────────────────────────── -->
  <div class="fxsim-tool-card">
    <h3>Platform Announcement</h3>
    <p class="description">Show a dismissible banner to all logged-in traders. Leave blank to clear.</p>
    <div style="display:grid;gap:10px;margin-top:10px">
      <textarea id="ann-message" rows="2" class="large-text" placeholder="Announcement text... (blank to clear)"><?= esc_textarea($announcement['message'] ?? '') ?></textarea>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="ann-type" class="regular-text">
          <option value="info" <?= ($announcement['type'] ?? '') === 'info'    ? 'selected':'' ?>>ℹ Info</option>
          <option value="success" <?= ($announcement['type'] ?? '') === 'success' ? 'selected':'' ?>>✅ Success</option>
          <option value="warning" <?= ($announcement['type'] ?? '') === 'warning' ? 'selected':'' ?>>⚠ Warning</option>
          <option value="error" <?= ($announcement['type'] ?? '') === 'error'   ? 'selected':'' ?>>❌ Error</option>
        </select>
        <input type="number" id="ann-expires" placeholder="Expires in N hours (0 = never)" style="width:220px" class="regular-text" value="0">
        <button class="button button-primary" onclick="fxsimAdmin.saveAnnouncement()">Save</button>
        <button class="button" onclick="fxsimAdmin.clearAnnouncement()">Clear</button>
      </div>
    </div>
    <?php if (!empty($announcement['message'])): ?>
    <div style="margin-top:8px;font-size:12px;color:#888">
      Active: <strong><?= esc_html($announcement['message']) ?></strong>
      (<?= esc_html($announcement['type'] ?? 'info') ?>)
    </div>
    <?php endif; ?>
    <div id="ann-msg" style="margin-top:8px;font-size:13px;font-weight:600"></div>
  </div>

  <!-- ── Maintenance mode ──────────────────────────────────────────────── -->
  <div class="fxsim-tool-card">
    <h3>Maintenance Mode</h3>
    <p class="description">Block all plugin pages with a maintenance message. Admin users are never blocked.</p>
    <div style="display:grid;gap:10px;margin-top:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <label class="fxsim-toggle">
          <input type="checkbox" id="maintenance-toggle"
            <?= !empty($maintenance['enabled']) ? 'checked' : '' ?>
            onchange="fxsimAdmin.setMaintenance(this.checked)">
          <span class="fxsim-toggle-track"></span>
        </label>
        <span id="maintenance-status" style="font-weight:700;color:<?= !empty($maintenance['enabled']) ? '#ff4757' : '#00e5a0' ?>">
          <?= !empty($maintenance['enabled']) ? '🔴 ACTIVE — Platform locked' : '🟢 OFF — Platform live' ?>
        </span>
      </div>
      <textarea id="maintenance-msg" rows="2" class="large-text"
        placeholder="Maintenance message shown to traders"><?= esc_textarea($maintenance['message'] ?? 'Platform under maintenance. Back soon.') ?></textarea>
      <button class="button" onclick="fxsimAdmin.saveMaintenance()">Update Message</button>
    </div>
  </div>

  <div id="fxsim-tools-msg" style="margin-top:12px;font-weight:600;color:#888"></div>
</div>
