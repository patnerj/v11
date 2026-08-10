<?php
// class-webhooks.php

class FXSIM_Webhooks {
    public static function init() {
        // Can add actions/filters here if we want to tie directly into WP hooks.
    }

    /**
     * Send a rich embed notification to Discord
     */
    public static function send_discord_notification($message, $color = "5814783") {
        $webhook_url = '';
        if (class_exists('FXSIM_Challenge_DB')) {
            $webhook_url = FXSIM_Challenge_DB::get_setting('discord_webhook', '');
        }
        if (empty($webhook_url)) {
            return false;
        }

        $data = [
            'embeds' => [
                [
                    'description' => $message,
                    'color' => hexdec($color)
                ]
            ]
        ];

        $args = [
            'body' => wp_json_encode($data),
            'headers' => ['Content-Type' => 'application/json'],
            'timeout' => 5, 
            'blocking' => false // Fire and forget, don't hold up the API response
        ];

        wp_remote_post($webhook_url, $args);
        return true;
    }

    public static function notify_funded($user_name, $account_size) {
        $size_fmt = self::format_money($account_size);
        $message = "🎉 **$user_name** just passed their evaluation and is now managing a **$size_fmt** funded account!";
        self::send_discord_notification($message, "5763719"); // Green
    }
    
    public static function notify_payout($user_name, $amount) {
        $amt_fmt = self::format_money($amount);
        $message = "💸 **$user_name** just received a payout of **$amt_fmt**! Congratulations!";
        self::send_discord_notification($message, "15105570"); // Orange
    }

    private static function format_money($amount) {
        return '$' . number_format((float)$amount, 0); // No cents needed for big numbers
    }
}

FXSIM_Webhooks::init();
