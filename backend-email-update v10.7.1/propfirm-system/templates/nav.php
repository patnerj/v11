<?php
/**
 * Shared navigation bar — included by all dashboard page templates.
 * Usage: include with $active = 'dashboard' | 'challenges' | 'statistics' | etc.
 */
defined('ABSPATH') || exit;

$_brand     = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
$_logo_url  = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('logo_url', '') : '';
$_logged_in = is_user_logged_in();
$_active    = $active ?? '';

$_nav_items = [
    'dashboard'       => ['label' => 'Dashboard',   'url' => home_url('/dashboard/'),       'icon' => 'dashboard'],
    'challenges'      => ['label' => 'Challenges',  'url' => home_url('/challenges/'),      'icon' => 'challenges'],
    'challenge-rules' => ['label' => 'Rules',       'url' => home_url('/challenge-rules/'), 'icon' => 'rules'],
    'statistics'      => ['label' => 'Statistics',  'url' => home_url('/statistics/'),      'icon' => 'statistics'],
    'leaderboard'     => ['label' => 'Leaderboard', 'url' => home_url('/leaderboard/'),     'icon' => 'leaderboard'],
    'certificate'     => ['label' => 'Certificate', 'url' => home_url('/certificate/'),     'icon' => 'certificate'],
    'profile'         => ['label' => 'Profile',     'url' => home_url('/profile/'),         'icon' => 'profile'],
];
?>
<nav class="fxdb-nav" id="fxdb-nav">
  <!-- Logo -->
  <a href="<?= home_url('/dashboard/') ?>" class="fxdb-nav-logo">
    <?php if ($_logo_url): ?>
      <img src="<?= esc_url($_logo_url) ?>" alt="<?= esc_attr($_brand) ?>">
    <?php else: ?>
      <span class="fxdb-nav-logo-icon"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('zap', '18') : '' ?></span>
      <span class="fxdb-nav-logo-text"><?= esc_html($_brand) ?></span>
    <?php endif; ?>
  </a>

  <!-- Hamburger (mobile) -->
  <button class="fxdb-nav-hamburger" id="fxdb-hamburger"
    onclick="(function(){var l=document.getElementById('fxdb-nav-links'),o=document.getElementById('fxdb-nav-overlay'),b=document.getElementById('fxdb-hamburger'),open=l.classList.toggle('open');o&&o.classList.toggle('open',open);b.setAttribute('aria-expanded',open);document.body.classList.toggle('fxdb-nav-open',open);})()"
    aria-label="Toggle navigation" aria-expanded="false" aria-controls="fxdb-nav-links">
    <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('menu', '20') : '☰' ?>
  </button>

  <!-- Nav links (scrollable on mobile, hidden behind hamburger) -->
  <div class="fxdb-nav-links" id="fxdb-nav-links">
    <?php foreach ($_nav_items as $slug => $item):
      $is_active = $slug === $_active;
      // Skip certificate and profile for non-logged-in users
      if (!$_logged_in && in_array($slug, ['certificate','profile','dashboard','statistics'])) continue;
    ?>
    <a href="<?= esc_url($item['url']) ?>"
       class="fxdb-nav-link<?= $is_active ? ' active' : '' ?>">
      <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get($item['icon'], '14') : '' ?>
      <?= esc_html($item['label']) ?>
    </a>
    <?php endforeach; ?>

    <?php if ($_logged_in): ?>
    <!-- Notification bell -->
    <div class="fxdb-notif-wrap" id="fxdb-notif-wrap">
      <button class="fxdb-notif-btn" id="fxdb-notif-btn"
        onclick="fxDash.toggleNotifications()" title="Notifications">
        <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('bell', '16') : '' ?>
        <span class="fxdb-notif-badge" id="fxdb-notif-badge" style="display:none">0</span>
      </button>
      <div class="fxdb-notif-panel" id="fxdb-notif-panel" style="display:none">
        <div class="fxdb-notif-header">
          <span>Notifications</span>
          <button onclick="fxDash.markAllRead()" class="fxdb-notif-markread">Mark all read</button>
        </div>
        <div id="fxdb-notif-list"><div class="fxdb-notif-empty">No notifications yet</div></div>
      </div>
    </div>
    <?php endif; ?>

    <!-- Dark/light toggle -->
    <button class="fxdb-theme-btn" id="fxdb-theme-btn"
      onclick="fxDash.toggleTheme()" title="Toggle theme"
      aria-label="Toggle dark/light mode">
      <span class="fxdb-theme-icon-dark"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('sun', '15') : '☀' ?></span>
      <span class="fxdb-theme-icon-light"><?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('moon', '15') : '🌙' ?></span>
    </button>
  </div>

  <!-- Logout — OUTSIDE scrollable container, always visible -->
  <?php if ($_logged_in): ?>
  <a href="<?= wp_logout_url(home_url('/login/')) ?>" class="fxdb-nav-logout-btn">
    <?= class_exists('FXSIM_Icons') ? FXSIM_Icons::get('logout', '14') : '' ?>
    Logout
  </a>
  <?php elseif ($_active !== 'landing'): ?>
  <a href="<?= home_url('/login/') ?>" class="fxdb-nav-logout-btn">Login</a>
  <?php endif; ?>
</nav>
<!-- Mobile nav overlay — closes drawer when tapping outside -->
<div class="fxdb-nav-overlay" id="fxdb-nav-overlay"
  onclick="(function(){document.getElementById('fxdb-nav-links').classList.remove('open');document.getElementById('fxdb-nav-overlay').classList.remove('open');document.getElementById('fxdb-hamburger').setAttribute('aria-expanded','false');document.body.classList.remove('fxdb-nav-open');})()"></div>
