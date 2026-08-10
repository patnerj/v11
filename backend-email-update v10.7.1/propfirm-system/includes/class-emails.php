<?php
/**
 * FXSIM_Emails — Branded HTML email system
 *
 * SMTP: configure via Settings → Email. Uses WP's phpmailer_init hook to
 * inject SMTP credentials into PHPMailer before every wp_mail() call.
 * Falls back to WordPress default (PHP mail) when SMTP is not configured.
 *
 * Events: welcome, challenge_purchased, phase_passed, challenge_passed,
 *         challenge_failed, payment_rejected, payment_approved,
 *         verification, password_reset, payout_approved, payout_rejected
 */
defined('ABSPATH') || exit;

class FXSIM_Emails {

    public static function register(): void {
        add_action('phpmailer_init', [self::class, 'configure_smtp']);
        add_action('wp_mail_failed', [self::class, 'log_failure']);
        add_filter('wp_mail_from',      [self::class, 'mail_from']);
        add_filter('wp_mail_from_name', [self::class, 'mail_from_name']);
    }

    public static function mail_from(string $email): string {
        $from = get_option('fxsim_smtp_from_email', '');
        if (!$from && class_exists('FXSIM_Challenge_DB')) $from = FXSIM_Challenge_DB::get_setting('support_email', '');
        return $from ?: $email;
    }

    public static function mail_from_name(string $name): string {
        if (class_exists('FXSIM_Challenge_DB')) {
            $from_name = get_option('fxsim_smtp_from_name', '') ?: FXSIM_Challenge_DB::get_setting('brand_name', '');
            if ($from_name) return $from_name;
        }
        return $name;
    }

    public static function configure_smtp(\PHPMailer\PHPMailer\PHPMailer $mailer): void {
        $host = get_option('fxsim_smtp_host', '');
        if (!$host) return;
        $mailer->isSMTP();
        $mailer->Host       = $host;
        $mailer->Port       = (int) get_option('fxsim_smtp_port', 587);
        $mailer->SMTPAuth   = (bool) get_option('fxsim_smtp_auth', true);
        $mailer->Username   = get_option('fxsim_smtp_user', '');
        $mailer->Password   = get_option('fxsim_smtp_pass', '');
        $mailer->SMTPSecure = get_option('fxsim_smtp_secure', 'tls');
        $reply_to = get_option('fxsim_smtp_reply_to', '');
        if ($reply_to && is_email($reply_to)) {
            $mailer->clearReplyTos();
            $mailer->addReplyTo($reply_to);
        }
        $from_email = get_option('fxsim_smtp_from_email', get_option('admin_email'));
        $from_name  = get_option('fxsim_smtp_from_name',
            class_exists('FXSIM_Challenge_DB')
                ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
                : 'PropFirm System'
        );
        $mailer->setFrom($from_email, $from_name);
    }

    public static function log_failure(\WP_Error $error): void {
        if (function_exists('FXSIM_Database') || class_exists('FXSIM_Database')) {
            FXSIM_Database::log_admin(0, 'email_failed', null, $error->get_error_message());
        }
    }

    // ── Send an email event ────────────────────────────────────────────────────
    public static function send(int $user_id, string $event, array $data = []): bool {
        $user = get_userdata($user_id);
        if (!$user) return false;

        $brand   = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        $tagline = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_tagline', 'The Funded Trader Platform') : 'The Funded Trader Platform';
        $color   = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('primary_color', '#7c6ef5') : '#7c6ef5';
        $support = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('support_email', '') : '';
        $footer  = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('footer_text', '') : '';
        $logo    = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('logo_url', '') : '';

        $ctx = compact('brand', 'tagline', 'color', 'support', 'footer', 'logo');
        $ctx['name'] = $user->display_name ?: $user->user_login;

        [$subject, $body] = self::build($event, $data, $ctx);
        if (!$subject) return false;

        $html = self::wrap($body, $ctx);
        return wp_mail(
            $user->user_email,
            $subject,
            $html,
            ['Content-Type: text/html; charset=UTF-8']
        );
    }

    // ── Build subject + inner body per event ──────────────────────────────────
    private static function build(string $event, array $d, array $ctx): array {
        $name  = $ctx['name'];
        $brand = $ctx['brand'];
        $fe    = self::frontend_base();
        $dash  = $fe . '/dashboard';
        $chall = $fe . '/challenges';

        $custom_subject = get_option("fxsim_email_subject_{$event}", '');
        $custom_body = get_option("fxsim_email_body_{$event}", '');

        if ($custom_subject && $custom_body) {
            $replace = [
                '{name}' => $name,
                '{brand}' => $brand,
                '{plan_name}' => $d['plan_name'] ?? 'Plan',
                '{phase}' => $d['phase'] ?? '1',
                '{amount}' => $d['amount'] ?? '0.00',
                '{method}' => $d['method'] ?? '',
                '{reference}' => $d['reference'] ?? '',
                '{reason}' => $d['reason'] ?? '',
                '{code}' => $d['code'] ?? '',
                '{new_balance}' => $d['new_balance'] ?? '',
                '{new_level}' => $d['new_level'] ?? '',
                '{rate}' => $d['rate'] ?? '',
            ];
            $subject = str_replace(array_keys($replace), array_values($replace), $custom_subject);
            $body = str_replace(array_keys($replace), array_values($replace), $custom_body);
            return [$subject, $body];
        }

        return match($event) {
            'welcome' => [
                'Welcome to ' . $brand . '!',
                self::block_welcome($name, $brand, $dash, $chall),
            ],
            'challenge_purchased' => [
                'Challenge Started — ' . ($d['plan_name'] ?? 'Your Challenge'),
                self::block_purchased($name, $brand, $d, $dash),
            ],
            'phase_passed' => [
                'Phase ' . ($d['phase'] ?? '1') . ' Passed!',
                self::block_phase_passed($name, $brand, $d, $dash),
            ],
            'challenge_passed' => [
                'All Phases Passed — Funded Account Active',
                self::block_challenge_passed($name, $brand, $dash),
            ],
            'challenge_failed' => [
                'Challenge Failed',
                self::block_challenge_failed($name, $brand, $d, $chall),
            ],
            'payment_rejected' => [
                'Payment Not Approved — ' . ($d['plan_name'] ?? 'Challenge'),
                self::block_payment_rejected($name, $brand, $d, $chall),
            ],
            'payment_approved' => [
                'Payment Approved — Challenge Account Activated',
                self::block_purchased($name, $brand, $d, $dash),
            ],
            'password_reset' => [
                'Reset your password',
                "<p>Hi {$name},</p><p>We received a request to reset your password. Click the button below to choose a new one — this link expires in 24 hours.</p>"
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('Reset Password', (string)($d['reset_url'] ?? $dash)) . "</div>"
                . "<p style='color:#9ca3af;font-size:13px'>If you didn't request this, you can safely ignore this email.</p>",
            ],
            'payout_requested' => [
                'Payout Request Received — $' . ($d['amount'] ?? '0.00'),
                "<p>Hi {$name},</p><p>We've received your payout request for <strong>\$" . ($d['amount'] ?? '0.00') . "</strong> and it's now pending review.</p>"
                . "<p>You'll get another email as soon as it's approved and processed.</p>"
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('View Payouts', $dash . '/payouts') . "</div>",
            ],
            'payout_approved' => [
                'Payout Processed — $' . ($d['amount'] ?? '0.00'),
                "<p>Hi {$name},</p><p>Your payout of <strong>\${$d['amount']}</strong> has been processed.</p>"
                . "<p><strong>Method:</strong> {$d['method']}<br><strong>Reference:</strong> {$d['reference']}</p>"
                . "<p>Funds typically arrive within 1–3 business days.</p>"
                . "<p>Thank you for trading with {$brand}!</p>",
            ],
            'payout_rejected' => [
                'Payout Request — Action Required',
                "<p>Hi {$name},</p><p>Your payout request could not be processed.</p>"
                . (!empty($d['reason']) ? "<p><strong>Reason:</strong> {$d['reason']}</p>" : '')
                . "<p>Please contact support or submit a new request from your dashboard.</p>",
            ],
            'payout_under_review' => [
                'Payout Under Review — ' . $brand,
                "<p>Hi {$name},</p><p>Your payout request"
                . (!empty($d['amount']) ? " of <strong>\${$d['amount']}</strong>" : '')
                . " is now under review by our team.</p>"
                . "<p>We'll email you again as soon as it's approved. No action is needed right now.</p>",
            ],
            'payout_paid' => [
                'Payout Paid — $' . ($d['amount'] ?? '0.00'),
                "<p>Hi {$name},</p><p>Your payout of <strong>\$" . ($d['amount'] ?? '0.00') . "</strong> has been <strong>paid</strong>"
                . (!empty($d['method']) ? " via " . esc_html($d['method']) : '') . ".</p>"
                . (!empty($d['reference']) ? "<p><strong>Transaction reference:</strong> " . esc_html($d['reference']) . "</p>" : '')
                . (!empty($d['proof_url']) ? "<div style='text-align:center;margin:24px 0'>" . self::btn('View Payment Proof', $d['proof_url']) . "</div>" : '')
                . "<p>Funds typically arrive within 1–3 business days.</p>"
                . "<p>Thank you for trading with {$brand}!</p>",
            ],
            'affiliate_payout_paid' => [
                'Affiliate Payout Sent — $' . ($d['amount'] ?? '0.00'),
                "<p>Hi {$name},</p><p>Your affiliate withdrawal of <strong>\$" . ($d['amount'] ?? '0.00') . "</strong> has been paid.</p>"
                . (!empty($d['reference']) ? "<p><strong>Transaction reference:</strong> " . esc_html($d['reference']) . "</p>" : '')
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('View Affiliate Dashboard', $dash . '/affiliate') . "</div>",
            ],
            'affiliate_commission' => [
                'You earned a commission — ' . $brand,
                "<p>Hi {$name},</p><p>Good news — one of your referrals just purchased a challenge, and you earned a commission of <strong>\$" . ($d['amount'] ?? '0.00') . "</strong>"
                . (!empty($d['rate']) ? " (at your {$d['rate']}% rate)" : '')
                . ".</p><p>Track your referrals and earnings from your affiliate dashboard.</p>"
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('View Affiliate Dashboard', $dash . '/affiliate') . "</div>",
            ],
            'payment_proof_submitted' => [
                'Payment Proof Received — ' . $brand,
                "<p>Hi {$name},</p><p>We've received your payment proof"
                . (!empty($d['plan']) ? " for the <strong>{$d['plan']}</strong> challenge" : '')
                . ". Our team will review it shortly — you'll get another email once approved.</p>"
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('View Dashboard', $dash) . "</div>",
            ],
            'kyc_submitted' => [
                'Verification Received — ' . $brand,
                "<p>Hi {$name},</p><p>Thanks — we've received your identity verification documents and they're now in the review queue.</p>"
                . "<p>Reviews usually complete within 1–2 business days. We'll email you as soon as a decision is made.</p>"
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('View Verification Status', $dash . '/kyc') . "</div>",
            ],
            'kyc_approved' => [
                'Identity Verified — ' . $brand,
                "<p>Hi {$name},</p><p>Your identity verification (KYC) has been <strong>approved</strong>.</p>"
                . "<p>You can now request payouts from your funded accounts.</p>"
                . "<p>Welcome aboard, and happy trading with {$brand}!</p>",
            ],
            'kyc_rejected' => [
                'Identity Verification — Action Required',
                "<p>Hi {$name},</p><p>We couldn't verify your identity with the documents provided.</p>"
                . (!empty($d['reason']) ? "<p><strong>Reason:</strong> {$d['reason']}</p>" : '')
                . "<p>Please re-submit clear, valid documents from your dashboard's Verification page.</p>",
            ],
            '2fa_code' => [
                'Your login verification code',
                "<p>Hi {$name},</p><p>Your 6-digit verification code is:</p>"
                . "<div style='font-size:40px;font-weight:800;letter-spacing:14px;font-family:monospace;"
                . "text-align:center;padding:28px;background:#f3f4f6;color:#111827;border-radius:12px;"
                . "margin:20px 0'>{$d['code']}</div>"
                . "<p style='color:#9ca3af;font-size:13px;text-align:center'>Expires in 10 minutes. Never share this code.</p>",
            ],
            'account_scaled' => [
                'Account Scaled Up! — ' . $brand,
                "<p>Congratulations {$name}!</p><p>Due to your consistent profitability, your funded account has been scaled up.</p>"
                . "<p>Your new starting balance is <strong>$" . ($d['new_balance'] ?? '0.00') . "</strong> (Level " . ($d['new_level'] ?? 1) . ").</p>"
                . "<p>All drawdown limits have been recalculated based on your new balance.</p>"
                . "<div style='text-align:center;margin:28px 0'>" . self::btn('View Dashboard', $dash) . "</div>",
            ],
            default => ['', ''],
        };
    }

    // ── Email blocks ──────────────────────────────────────────────────────────

    private static function block_welcome(string $name, string $brand, string $dash, string $chall): string {
        return "
        <h2 style='font-size:22px;font-weight:800;color:#111827;margin:0 0 8px'>Welcome to {$brand}!</h2>
        <p style='color:#6b7280;margin:0 0 24px'>Hi {$name}, your account is ready. Here's how to get started:</p>

        <table cellpadding='0' cellspacing='0' width='100%' style='margin-bottom:24px'>
          <tr><td style='padding:8px 0;border-bottom:1px solid #f3f4f6'>" . self::check() . "<span style='color:#374151;font-size:14px'>Browse our challenge plans</span></td></tr>
          <tr><td style='padding:8px 0;border-bottom:1px solid #f3f4f6'>" . self::check() . "<span style='color:#374151;font-size:14px'>Select your account size</span></td></tr>
          <tr><td style='padding:8px 0;border-bottom:1px solid #f3f4f6'>" . self::check() . "<span style='color:#374151;font-size:14px'>Pass Phase 1 &amp; Phase 2</span></td></tr>
          <tr><td style='padding:8px 0;border-bottom:1px solid #f3f4f6'>" . self::check() . "<span style='color:#374151;font-size:14px'>Receive your funded account</span></td></tr>
          <tr><td style='padding:8px 0'>" . self::check() . "<span style='color:#374151;font-size:14px'>Request profit payouts up to 85% split</span></td></tr>
        </table>

        <p style='color:#6b7280;font-size:14px;margin:0 0 24px'>All plans include TradingView charts, 14 live instruments, and real market prices.</p>
        " . self::btn('Browse Challenge Plans', $chall) . "
        <a href='{$dash}' style='display:inline-block;margin-left:12px;color:#6b7280;font-size:14px;text-decoration:none'>Go to Dashboard →</a>
        ";
    }

    private static function block_purchased(string $name, string $brand, array $d, string $dash): string {
        $plan  = esc_html($d['plan_name'] ?? 'Challenge');
        $size  = '$' . number_format((float)($d['account_size'] ?? 0), 0);
        $p1tgt = ($d['p1_profit_target'] ?? 8) . '%';
        $dd    = ($d['p1_max_dd'] ?? 10) . '%';
        return "
        <h2 style='font-size:22px;font-weight:800;color:#111827;margin:0 0 8px'>Your Challenge Has Started</h2>
        <p style='color:#6b7280;margin:0 0 24px'>Hi {$name}, your {$plan} is now active. Here are your account details:</p>

        <table cellpadding='0' cellspacing='0' width='100%' style='background:#f9fafb;border-radius:10px;margin-bottom:24px'>
          <tr>
            <td style='padding:14px 20px;border-bottom:1px solid #e5e7eb'>
              <span style='color:#9ca3af;font-size:13px'>Account Size</span><br>
              <strong style='color:#111827;font-size:18px'>{$size}</strong>
            </td>
            <td style='padding:14px 20px;border-bottom:1px solid #e5e7eb;border-left:1px solid #e5e7eb'>
              <span style='color:#9ca3af;font-size:13px'>Phase 1 Target</span><br>
              <strong style='color:#111827;font-size:18px'>{$p1tgt}</strong>
            </td>
          </tr>
          <tr>
            <td style='padding:14px 20px' colspan='2'>
              <span style='color:#9ca3af;font-size:13px'>Max Drawdown</span><br>
              <strong style='color:#111827;font-size:18px'>{$dd}</strong>
            </td>
          </tr>
        </table>

        <p style='color:#6b7280;font-size:14px;margin:0 0 24px'>Trade within the rules and hit your profit target to advance to Phase 2.</p>
        " . self::btn('View Challenge Dashboard', $dash);
    }

    private static function block_phase_passed(string $name, string $brand, array $d, string $dash): string {
        $phase = (int)($d['phase'] ?? 1);
        $next  = esc_html($d['next'] ?? 'Phase 2');
        return "
        <div style='background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px'>
          <div style='font-size:32px;margin-bottom:8px'>🎉</div>
          <h2 style='font-size:22px;font-weight:800;color:#166534;margin:0 0 4px'>Phase {$phase} Passed!</h2>
          <p style='color:#16a34a;margin:0;font-size:15px'>Congratulations {$name}!</p>
        </div>

        <p style='color:#6b7280;margin:0 0 8px'>You've successfully completed Phase {$phase}.</p>
        <p style='color:#6b7280;margin:0 0 24px'>You're now moving to <strong style='color:#111827'>{$next}</strong>. Keep up the great work!</p>
        " . self::btn('Continue Trading', $dash);
    }

    private static function block_challenge_passed(string $name, string $brand, string $dash): string {
        return "
        <div style='background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px'>
          <div style='font-size:40px;margin-bottom:12px'>🏆</div>
          <h2 style='font-size:24px;font-weight:800;color:#166534;margin:0 0 6px'>You're Funded!</h2>
          <p style='color:#16a34a;margin:0;font-size:15px'>Congratulations {$name} — all phases complete.</p>
        </div>

        <p style='color:#6b7280;margin:0 0 8px'>Your funded account is now active. You can start trading and requesting payouts.</p>
        <p style='color:#6b7280;margin:0 0 24px'>Your profit split has been applied to your account.</p>
        " . self::btn('Access Funded Dashboard', $dash);
    }

    private static function block_challenge_failed(string $name, string $brand, array $d, string $chall): string {
        $reason = esc_html($d['reason'] ?? 'A trading rule was violated.');
        $rule   = esc_html($d['rule'] ?? '');
        return "
        <h2 style='font-size:22px;font-weight:800;color:#111827;margin:0 0 8px'>Challenge Failed</h2>
        <p style='color:#6b7280;margin:0 0 24px'>Hi {$name}, unfortunately your challenge has ended.</p>

        <div style='background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;margin-bottom:24px'>
          <p style='color:#dc2626;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px'>Reason for Failure</p>
          <p style='color:#374151;font-size:14px;margin:0'>{$reason}</p>
          " . ($rule ? "<p style='color:#9ca3af;font-size:12px;margin:8px 0 0'>Rule: {$rule}</p>" : '') . "
        </div>

        <p style='color:#6b7280;font-size:14px;margin:0 0 8px'>Don't be discouraged — every top trader has failed challenges.</p>
        <p style='color:#6b7280;font-size:14px;margin:0 0 24px'>Analyze what went wrong, adjust your strategy, and try again.</p>
        " . self::btn('Start a New Challenge', $chall);
    }

    private static function block_payment_rejected(string $name, string $brand, array $d, string $chall): string {
        $plan   = esc_html($d['plan_name'] ?? 'Challenge');
        $reason = esc_html($d['reason'] ?? 'Payment could not be verified.');
        return "
        <h2 style='font-size:22px;font-weight:800;color:#111827;margin:0 0 8px'>Payment Not Approved</h2>
        <p style='color:#6b7280;margin:0 0 24px'>Hi {$name}, your payment for <strong style='color:#111827'>{$plan}</strong> was not approved.</p>

        <div style='background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:20px;margin-bottom:24px'>
          <p style='color:#dc2626;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px'>Reason</p>
          <p style='color:#374151;font-size:14px;margin:0'>{$reason}</p>
        </div>

        <p style='color:#6b7280;font-size:14px;margin:0 0 24px'>Please resubmit your payment or contact support if you need help.</p>
        " . self::btn('Try Again', $chall);
    }

    // ── HTML wrapper — Clean light fintech email template ─────────────────────
    public static function build_html(string $body, array $ctx = []): string {
        $brand = $ctx['brand'] ?? (class_exists('FXSIM_Challenge_DB')
            ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System')
            : 'PropFirm System');
        $full_ctx = [
            'brand'   => $brand,
            'tagline' => $ctx['tagline'] ?? 'Professional Prop Trading',
            'color'   => $ctx['color']   ?? '#7c6ef5',
            'footer'  => $ctx['footer']  ?? '',
            'support' => $ctx['support'] ?? '',
            'logo'    => $ctx['logo'] ?? (class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('logo_url', '') : ''),
        ];
        return self::wrap($body, $full_ctx);
    }

    public static function frontend_base(): string {
        $url = get_option('fxsim_frontend_url', '');
        if (!$url && defined('FXSIM_FRONTEND_URL')) $url = FXSIM_FRONTEND_URL;
        if (!$url) $url = home_url();
        return untrailingslashit($url);
    }

    private static function wrap(string $body, array $ctx): string {
        $brand   = esc_html($ctx['brand']);
        $tagline = esc_html($ctx['tagline']);
        $color   = esc_attr($ctx['color'] ?: '#7c6ef5');
        $year    = date('Y');
        $footer  = esc_html($ctx['footer'] ?: "© {$year} {$brand}. All rights reserved.");
        $support = $ctx['support']
            ? "<a href='mailto:{$ctx['support']}' style='color:{$color};text-decoration:none'>{$ctx['support']}</a>"
            : '';
        $logo = isset($ctx['logo']) ? esc_url($ctx['logo']) : '';

        // Header — logo image or brand text
        $header_inner = $logo
            ? "<img src='{$logo}' alt='{$brand}' height='40' style='max-height:40px;max-width:200px;width:auto;display:inline-block' />"
            : "<span style='font-size:20px;font-weight:800;color:#111827;letter-spacing:-.4px'>{$brand}</span>";

        preg_match('/<p[^>]*>(.*?)<\/p>/s', $body, $m);
        $preheader = isset($m[1]) ? substr(strip_tags($m[1]), 0, 120) : $brand;

        return "<!DOCTYPE html>
<html lang='en'>
<head>
  <meta charset='UTF-8'>
  <meta name='viewport' content='width=device-width,initial-scale=1'>
  <title>{$brand}</title>
  <style>
    @media only screen and (max-width:600px){
      .wrapper{padding:16px!important}
      .card{padding:24px 20px!important}
    }
    p{margin:0 0 14px;color:#6b7280;font-size:15px;line-height:1.6}
    p:last-child{margin-bottom:0}
    strong{color:#111827;font-weight:600}
    a{color:{$color}}
    h1,h2{font-family:inherit}
  </style>
</head>
<body style='margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif'>
  <div style='display:none;max-height:0;overflow:hidden'>{$preheader}&nbsp;</div>
  <table cellpadding='0' cellspacing='0' width='100%' style='background:#f3f4f6'>
    <tr><td class='wrapper' style='padding:40px 16px'>
      <table cellpadding='0' cellspacing='0' align='center' style='max-width:580px;width:100%;margin:0 auto'>

        <!-- Logo header — dark background so transparent/light logos show correctly -->
        <tr><td style='padding-bottom:0;text-align:center;background:#0c1220;border-radius:12px 12px 0 0;padding:24px'>
          {$header_inner}
        </td></tr>

        <!-- Main card -->
        <tr><td class='card' style='background:#ffffff;border-radius:0 0 12px 12px;padding:36px 40px;box-shadow:0 1px 3px rgba(0,0,0,.08)'>
          {$body}
        </td></tr>

        <!-- Footer -->
        <tr><td style='padding:24px 0 8px;text-align:center'>
          <p style='font-size:12px;color:#9ca3af;margin:0 0 4px'>{$footer}</p>
          " . ($support ? "<p style='font-size:12px;color:#9ca3af;margin:0'>Support: {$support}</p>" : '') . "
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>";
    }

    // ── Reusable components ────────────────────────────────────────────────────
    public static function btn(string $text, string $url): string {
        return "<a href='{$url}' style='display:inline-block;background:#7c6ef5;color:#ffffff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;letter-spacing:.2px'>{$text}</a>";
    }

    public static function send_admin(string $subject, string $title, string $message): bool {
        $brand   = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_name', 'PropFirm System') : 'PropFirm System';
        $tagline = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('brand_tagline', 'The Funded Trader Platform') : 'The Funded Trader Platform';
        $color   = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('primary_color', '#7c6ef5') : '#7c6ef5';
        $support = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('support_email', '') : '';
        $footer  = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('footer_text', '') : '';
        $admin   = get_option('fxsim_admin_email', '') ?: get_option('admin_email');
        if (!$admin) return false;

        $ctx = compact('brand', 'tagline', 'color', 'support', 'footer');
        $ctx['name'] = 'Team';
        $ctx['logo'] = class_exists('FXSIM_Challenge_DB') ? FXSIM_Challenge_DB::get_setting('logo_url', '') : '';
        $dash = self::frontend_base() . '/dashboard/admin';

        $body = "<p style='font-size:12px;color:{$color};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px'>Admin Notification</p>"
              . "<h2 style='font-size:20px;font-weight:800;color:#111827;margin:0 0 12px'>" . esc_html($title) . "</h2>"
              . "<p style='font-size:15px;color:#6b7280;margin:0 0 24px'>" . esc_html($message) . "</p>"
              . "<div style='text-align:center;margin:8px 0'>" . self::btn('Open Admin Dashboard', $dash) . "</div>";

        $html = self::wrap($body, $ctx);
        return wp_mail($admin, $subject, $html, ['Content-Type: text/html; charset=UTF-8']);
    }

    private static function check(): string {
        return "<span style='color:#16a34a;font-weight:700;margin-right:10px;font-size:14px'>✓</span>";
    }
}
