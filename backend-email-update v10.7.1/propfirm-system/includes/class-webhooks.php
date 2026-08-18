<?php
/**
 * FXSIM_Webhooks - Institutional Multi-Channel Webhook Dispatcher
 * Dispatches real-time telemetry events to Discord Webhooks and Telegram Bot API.
 */

defined('ABSPATH') || exit;

class FXSIM_Webhooks {

    public static function init() {
        // Ready for action hooks if required
    }

    /**
     * Get consolidated webhook configuration from options.
     */
    public static function get_config(): array {
        $defaults = [
            'discord_enabled'     => false,
            'discord_webhook_url' => '',
            'telegram_enabled'    => false,
            'telegram_bot_token'  => '',
            'telegram_chat_id'    => '',
            'notify_on_purchase'  => true,
            'notify_on_payout'    => true,
            'notify_on_breach'    => true,
            'notify_on_kyc'       => true,
        ];
        $stored = get_option('fxsim_webhooks_config', []);
        return array_merge($defaults, is_array($stored) ? $stored : []);
    }

    /**
     * Main dispatch method for all platform events.
     *
     * @param string $event 'purchase' | 'payout' | 'breach' | 'kyc'
     * @param array  $data  Event payload parameters
     */
    public static function dispatch(string $event, array $data = []): void {
        $config = self::get_config();
        $site_name = get_bloginfo('name') ?: 'Prop Firm System';
        $timestamp = gmdate('Y-m-d H:i:s') . ' UTC';

        // Check if event is enabled in settings
        $event_flag_map = [
            'purchase' => 'notify_on_purchase',
            'payout'   => 'notify_on_payout',
            'breach'   => 'notify_on_breach',
            'kyc'      => 'notify_on_kyc',
        ];

        $flag = $event_flag_map[$event] ?? null;
        if ($flag && empty($config[$flag])) {
            return; // Notification disabled for this event
        }

        // 1. Dispatch Discord
        if (!empty($config['discord_enabled']) && !empty($config['discord_webhook_url'])) {
            self::send_discord_event($config['discord_webhook_url'], $event, $data, $site_name, $timestamp);
        }

        // 2. Dispatch Telegram
        if (!empty($config['telegram_enabled']) && !empty($config['telegram_bot_token']) && !empty($config['telegram_chat_id'])) {
            self::send_telegram_event($config['telegram_bot_token'], $config['telegram_chat_id'], $event, $data, $site_name, $timestamp);
        }
    }

    /**
     * Send event to Discord with Rich Embed styling.
     */
    private static function send_discord_event(string $url, string $event, array $data, string $site_name, string $timestamp): void {
        $embed = [
            'footer'    => ['text' => $site_name . ' • Telemetry Hub'],
            'timestamp' => gmdate('c'),
        ];

        switch ($event) {
            case 'purchase':
                $embed['title']       = '💰 New Challenge Purchased!';
                $embed['description'] = 'A new trader has purchased a challenge evaluation plan.';
                $embed['color']       = 0x10B981; // Emerald Green
                $embed['fields']      = [
                    ['name' => '👤 Trader', 'value' => $data['trader_name'] ?? ($data['email'] ?? 'Trader'), 'inline' => true],
                    ['name' => '📦 Plan Tier', 'value' => $data['plan_name'] ?? 'Challenge', 'inline' => true],
                    ['name' => '💵 Amount Paid', 'value' => '$' . number_format((float)($data['amount'] ?? 0), 2) . ' (' . ($data['gateway'] ?? 'Online') . ')', 'inline' => true],
                    ['name' => '🆔 Login ID', 'value' => (string)($data['login_id'] ?? 'N/A'), 'inline' => true],
                ];
                break;

            case 'payout':
                $embed['title']       = '💳 New Payout Requested!';
                $embed['description'] = 'A funded trader has requested a profit share withdrawal disbursement.';
                $embed['color']       = 0xF59E0B; // Amber Gold
                $embed['fields']      = [
                    ['name' => '👤 Trader', 'value' => $data['trader_name'] ?? ($data['email'] ?? 'Trader'), 'inline' => true],
                    ['name' => '💰 Payout Amount', 'value' => '$' . number_format((float)($data['amount'] ?? 0), 2), 'inline' => true],
                    ['name' => '🏦 Method / Wallet', 'value' => ($data['method'] ?? 'Crypto') . ' • ' . ($data['wallet_address'] ?? 'On file'), 'inline' => false],
                ];
                break;

            case 'breach':
                $embed['title']       = '⚠️ Hard Drawdown Breach Flagged!';
                $embed['description'] = 'A trading account has violated risk parameters and was suspended.';
                $embed['color']       = 0xEF4444; // Red Danger
                $embed['fields']      = [
                    ['name' => '🆔 Account', 'value' => '#' . ($data['account_id'] ?? 'N/A') . ' (' . ($data['trader_name'] ?? 'Trader') . ')', 'inline' => true],
                    ['name' => '🛑 Reason', 'value' => $data['reason'] ?? 'Drawdown Exceeded', 'inline' => true],
                    ['name' => '📉 Equity / Loss', 'value' => '$' . number_format((float)($data['equity'] ?? 0), 2), 'inline' => true],
                ];
                break;

            case 'kyc':
                $embed['title']       = '🪪 New KYC Verification Submitted';
                $embed['description'] = 'Identity documents uploaded and awaiting AML compliance review.';
                $embed['color']       = 0x3B82F6; // Blue
                $embed['fields']      = [
                    ['name' => '👤 Trader', 'value' => $data['trader_name'] ?? 'Trader', 'inline' => true],
                    ['name' => '📄 Document Type', 'value' => strtoupper($data['doc_type'] ?? 'ID / Passport'), 'inline' => true],
                    ['name' => '🌍 Country', 'value' => $data['country'] ?? 'Global', 'inline' => true],
                ];
                break;

            default:
                $embed['title']       = '⚡ Platform Event: ' . ucfirst($event);
                $embed['description'] = 'Prop firm operations update.';
                $embed['color']       = 0x6B7280;
                break;
        }

        wp_remote_post($url, [
            'headers'  => ['Content-Type' => 'application/json; charset=utf-8'],
            'body'     => wp_json_encode([
                'username'   => $site_name . ' Alert Hub',
                'avatar_url' => 'https://cdn-icons-png.flaticon.com/512/906/906361.png',
                'embeds'     => [$embed],
            ]),
            'timeout'  => 5,
            'blocking' => false, // Non-blocking asynchronous dispatch
        ]);
    }

    /**
     * Send event to Telegram Bot API with Markdown styling.
     */
    private static function send_telegram_event(string $token, string $chat_id, string $event, array $data, string $site_name, string $timestamp): void {
        $text = '';

        switch ($event) {
            case 'purchase':
                $amount = '$' . number_format((float)($data['amount'] ?? 0), 2);
                $text = "💰 *[{$site_name}] New Challenge Purchased!*\n\n" .
                        "👤 *Trader:* " . ($data['trader_name'] ?? $data['email'] ?? 'Trader') . "\n" .
                        "📦 *Plan:* " . ($data['plan_name'] ?? 'Challenge') . "\n" .
                        "💵 *Amount:* `{$amount}` (" . ($data['gateway'] ?? 'Online') . ")\n" .
                        "🆔 *Login ID:* `#" . ($data['login_id'] ?? 'N/A') . "`\n" .
                        "⏱️ *Time:* `{$timestamp}`";
                break;

            case 'payout':
                $amount = '$' . number_format((float)($data['amount'] ?? 0), 2);
                $text = "💳 *[{$site_name}] New Payout Requested!*\n\n" .
                        "👤 *Trader:* " . ($data['trader_name'] ?? $data['email'] ?? 'Trader') . "\n" .
                        "💰 *Amount:* `{$amount}`\n" .
                        "🏦 *Method:* " . ($data['method'] ?? 'Crypto') . "\n" .
                        "⏱️ *Time:* `{$timestamp}`";
                break;

            case 'breach':
                $text = "⚠️ *[{$site_name}] Hard Breach Alert!*\n\n" .
                        "🆔 *Account:* `#" . ($data['account_id'] ?? 'N/A') . "` (" . ($data['trader_name'] ?? 'Trader') . ")\n" .
                        "🛑 *Reason:* " . ($data['reason'] ?? 'Drawdown Exceeded') . "\n" .
                        "📉 *Equity:* `$" . number_format((float)($data['equity'] ?? 0), 2) . "`\n" .
                        "⏱️ *Time:* `{$timestamp}`";
                break;

            case 'kyc':
                $text = "🪪 *[{$site_name}] New KYC Submitted*\n\n" .
                        "👤 *Trader:* " . ($data['trader_name'] ?? 'Trader') . "\n" .
                        "📄 *Document:* " . strtoupper($data['doc_type'] ?? 'ID/Passport') . "\n" .
                        "🌍 *Country:* " . ($data['country'] ?? 'Global') . "\n" .
                        "⏱️ *Time:* `{$timestamp}`";
                break;

            default:
                $text = "⚡ *[{$site_name}] Event:* {$event}\n⏱️ *Time:* `{$timestamp}`";
                break;
        }

        $url = "https://api.telegram.org/bot{$token}/sendMessage";
        wp_remote_post($url, [
            'headers'  => ['Content-Type' => 'application/json'],
            'body'     => wp_json_encode([
                'chat_id'    => $chat_id,
                'text'       => $text,
                'parse_mode' => 'Markdown',
            ]),
            'timeout'  => 5,
            'blocking' => false, // Non-blocking asynchronous dispatch
        ]);
    }
}
