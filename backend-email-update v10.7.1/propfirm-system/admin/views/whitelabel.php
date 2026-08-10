<?php defined('ABSPATH') || exit;
$webhook_url = rest_url('fxsim/v1/stripe/webhook');
?>
<div class="wrap fxsim-admin">
  <h1>White Label Settings</h1>

  <!-- Stripe webhook helper -->
  <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:14px 18px;margin-bottom:20px;max-width:700px">
    <strong>Stripe Setup</strong>
    <p style="margin:6px 0 4px;font-size:13px">Your Stripe Webhook URL (add this in your Stripe Dashboard → Developers → Webhooks):</p>
    <div style="display:flex;align-items:center;gap:8px">
      <code id="fxsim-webhook-url" style="background:#f8f9fa;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:12px;flex:1"><?= esc_url($webhook_url) ?></code>
      <button class="button button-small" onclick="navigator.clipboard.writeText('<?= esc_js($webhook_url) ?>').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
    </div>
    <p style="margin:6px 0 0;font-size:12px;color:#666">Listen for: <code>checkout.session.completed</code></p>
  </div>

  <div id="fxsim-wl-form">
    <h2>Branding</h2>
    <table class="form-table"><tbody id="fxsim-wl-body"><tr><td>Loading…</td></tr></tbody></table>
    <h2>Payment & Stripe Settings</h2>
    <table class="form-table"><tbody id="fxsim-wl-payment-body"><tr><td>Loading…</td></tr></tbody></table>
    <p>
      <button class="button button-primary" onclick="fxsimAdmin.saveWhitelabel()">Save All Settings</button>
    </p>
    <div id="fxsim-wl-msg" style="margin-top:8px;color:green;font-weight:600"></div>
  </div>
</div>
