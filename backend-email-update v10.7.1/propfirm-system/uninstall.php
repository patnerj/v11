<?php
/**
 * Uninstall script — runs when plugin is deleted from WP admin.
 * Drops all 7 custom tables and removes all plugin options.
 */
defined('WP_UNINSTALL_PLUGIN') || exit;

global $wpdb;

$tables = [
    'fxsim_accounts',
    'fxsim_positions',
    'fxsim_trades',
    'fxsim_transactions',
    'fxsim_symbols',
    'fxsim_admin_log',
    'fxsim_pending_orders',
    // Challenge system
    'fxsim_challenge_plans',
    'fxsim_challenge_accounts',
    'fxsim_challenge_snapshots',
    'fxsim_challenge_breaches',
    'fxsim_payouts',
    'fxsim_whitelabel',
    'fxsim_payment_orders',
    'fxsim_api_keys',
    'fxsim_api_key_log',
    'fxsim_notifications',
];

foreach ($tables as $table) {
    $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$table}");
}

// Remove all options
$wpdb->query("DELETE FROM {$wpdb->prefix}options WHERE option_name LIKE 'fxsim_%'");

// Clear scheduled events
wp_clear_scheduled_hook('fxsim_price_update');
wp_clear_scheduled_hook('fxsim_daily_tasks');
wp_clear_scheduled_hook('fxsim_daily_swap'); // legacy
