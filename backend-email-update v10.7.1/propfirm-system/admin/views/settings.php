<?php defined('ABSPATH') || exit;
$news_lock = get_option('fxsim_news_lock', false);
?>
<div class="wrap fxsim-admin">
  <h1>System Settings</h1>

  <h2 style="margin-top:20px">Trading Controls</h2>
  <table class="form-table">
    <tr>
      <th>News Trading Lock</th>
      <td>
        <label>
          <input type="checkbox" id="fxsim-news-lock" <?= $news_lock ? 'checked' : '' ?>
            onchange="fxsimAdmin.toggleNewsLock(this.checked)">
          Lock all trades during news events
        </label>
        <p class="description">When enabled, traders on news-restricted plans cannot open positions. Toggle off after news passes.</p>
        <div id="fxsim-news-lock-status" style="margin-top:6px;font-weight:600;color:<?= $news_lock ? '#ff4757' : '#00e5a0' ?>">
          <?= $news_lock ? '🔒 LOCKED — Trading paused' : '✅ UNLOCKED — Trading active' ?>
        </div>
      </td>
    </tr>
    <tr>
      <th>Force Price Refresh</th>
      <td><button class="button button-primary" onclick="fxsimAdmin.forcePrices()">Refresh Now</button></td>
    </tr>
    <tr>
      <th>Clear Price Cache</th>
      <td><button class="button" onclick="fxsimAdmin.clearCache()">Clear Cache</button></td>
    </tr>
  </table>

  <h2 style="margin-top:28px">⏱ Cron Reliability</h2>
  <p class="description" style="margin-bottom:10px">
    Prices update every 30 seconds via WordPress cron. On low-traffic sites, WP-Cron can drift.
    For reliable price feeds and SL/TP execution, add a real server cron job.
  </p>
  <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px 20px;max-width:680px;margin-bottom:20px">
    <p style="margin:0 0 8px;font-weight:600;font-size:13px">Add this to your server crontab (<code>crontab -e</code>):</p>
    <code style="display:block;background:#f4f4f4;padding:10px 12px;border-radius:4px;font-size:12px;word-break:break-all">
      * * * * * wget -q -O - <?= esc_url(site_url('/?doing_wp_cron')) ?> &gt; /dev/null 2&gt;&amp;1
    </code>
    <p style="margin:10px 0 0;font-size:12px;color:#666">
      Or with WP-CLI: <code>wp cron event run fxsim_price_update --due-now</code><br>
      The admin health widget on the dashboard shows the last cron run time. Alerts are emailed if cron lags &gt; 10 minutes.
    </p>
  </div>

  <h2 style="margin-top:28px">📡 Price Feed</h2>
  <p class="description" style="margin-bottom:12px">
    Configure an alternative price data source. <strong>Twelve Data</strong> is more reliable than Yahoo Finance
    (no scraping — official API). <a href="https://twelvedata.com" target="_blank">Get a free key →</a>
    Leave blank to use Yahoo Finance (default, no key needed).
  </p>
  <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px 20px;max-width:520px;margin-bottom:20px">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:8px 0;font-weight:600;width:160px">Twelve Data API Key</td>
        <td>
          <input type="text" id="td-api-key" class="regular-text"
            value="<?= esc_attr(get_option('fxsim_twelve_data_key','')) ?>"
            placeholder="Leave blank to use Yahoo Finance">
        </td>
      </tr>
    </table>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center">
      <button class="button button-primary" onclick="fxsimAdmin.savePriceFeed()">Save</button>
      <span id="pricefeed-msg" style="font-size:13px;font-weight:600"></span>
      <?php $src = get_option('fxsim_price_source','yahoo'); ?>
      <span style="font-size:12px;color:#888">Current source:
        <strong><?= esc_html($src === 'twelve_data' ? 'Twelve Data ✅' : 'Yahoo Finance') ?></strong>
      </span>
    </div>
  </div>

  <h2 style="margin-top:28px">Rate Limiting</h2>
  <p class="description" style="margin-bottom:12px">
    Requests per 60-second window per user. Set to <code>0</code> to disable a tier.
    Admin users are always exempt. Changes take effect immediately.
  </p>
  <table class="form-table">
    <?php
    $tiers = [
        'trading_write' => ['Trading writes (open/close/orders)',   20, 'POST /open, /close, /pending-order/place etc.'],
        'trading_read'  => ['Trading reads (account/positions)',    60, 'GET /account, /positions, /history etc.'],
        'auth_write'    => ['Payment & challenge writes',           10, 'POST /payment/create, /challenge/start etc.'],
        'stream'        => ['SSE stream connections',                5, 'GET /stream — EventSource reconnects'],
        'public'        => ['Public endpoints (per IP)',            30, 'GET /prices, /challenge/plans, /leaderboard'],
    ];
    foreach ($tiers as $slug => [$label, $default, $desc]):
        $current = get_option("fxsim_rl_{$slug}_limit", $default);
    ?>
    <tr>
      <th><?= esc_html($label) ?></th>
      <td>
        <input type="number" min="0" max="600" value="<?= (int)$current ?>"
               id="fxsim-rl-<?= esc_attr($slug) ?>"
               style="width:80px" placeholder="<?= $default ?>">
        <button class="button" onclick="fxsimAdmin.saveRateLimit('<?= esc_js($slug) ?>')">Save</button>
        <span style="margin-left:8px;color:#8b9eb0;font-size:12px"><?= esc_html($desc) ?></span>
      </td>
    </tr>
    <?php endforeach; ?>
  </table>

  <div id="fxsim-settings-msg" style="margin-top:12px;font-weight:600"></div>
</div>

<!-- SMTP SETTINGS SECTION (appended below rate limiting) -->
<?php
$smtp_host    = get_option('fxsim_smtp_host', '');
$smtp_port    = get_option('fxsim_smtp_port', 587);
$smtp_user    = get_option('fxsim_smtp_user', '');
$smtp_secure  = get_option('fxsim_smtp_secure', 'tls');
$smtp_from    = get_option('fxsim_smtp_from_email', get_option('admin_email'));
$smtp_name    = get_option('fxsim_smtp_from_name', '');
?>
<div class="wrap fxsim-admin" style="max-width:1200px">
  <h2 style="margin-top:28px">📧 Email (SMTP)</h2>
  <p class="description" style="margin-bottom:12px">
    Configure SMTP for reliable email delivery. Leave <strong>Host</strong> blank to use WordPress default (PHP mail).
    Works with SendGrid, Mailgun, Gmail, Postmark, etc.
  </p>

  <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px 24px;max-width:600px">
    <table style="width:100%;border-collapse:collapse">
      <tr style="margin-bottom:10px">
        <td style="padding:8px 0;font-weight:600;width:140px">SMTP Host</td>
        <td><input id="smtp-host" type="text" class="regular-text" placeholder="smtp.sendgrid.net"
             value="<?= esc_attr($smtp_host) ?>"></td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600">Port</td>
        <td>
          <input id="smtp-port" type="number" style="width:80px" value="<?= esc_attr($smtp_port) ?>">
          <select id="smtp-secure" style="margin-left:10px">
            <option value="tls"  <?= $smtp_secure === 'tls'  ? 'selected' : '' ?>>TLS (587)</option>
            <option value="ssl"  <?= $smtp_secure === 'ssl'  ? 'selected' : '' ?>>SSL (465)</option>
            <option value=""     <?= $smtp_secure === ''     ? 'selected' : '' ?>>None (25)</option>
          </select>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600">Username</td>
        <td><input id="smtp-user" type="text" class="regular-text" placeholder="apikey or username"
             value="<?= esc_attr($smtp_user) ?>"></td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600">Password</td>
        <td><input id="smtp-pass" type="password" class="regular-text" placeholder="••••••••"
             autocomplete="new-password"></td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600">From Email</td>
        <td><input id="smtp-from-email" type="email" class="regular-text"
             value="<?= esc_attr($smtp_from) ?>"></td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600">From Name</td>
        <td><input id="smtp-from-name" type="text" class="regular-text"
             placeholder="PropFirm System" value="<?= esc_attr($smtp_name) ?>"></td>
      </tr>
    </table>
    <div style="margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="button button-primary" onclick="fxsimAdmin.saveSMTP()">Save SMTP Settings</button>
      <input type="email" id="smtp-test-email" placeholder="Send test to…" style="width:200px" class="regular-text">
      <button class="button" onclick="fxsimAdmin.testSMTP()">Send Test Email</button>
    </div>
    <div id="smtp-msg" style="margin-top:8px;font-size:13px;font-weight:600"></div>
  </div>
</div>
