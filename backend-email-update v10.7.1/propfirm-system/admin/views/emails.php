<?php defined('ABSPATH') || exit;
$events = [
    'welcome' => 'Welcome Email',
    'challenge_purchased' => 'Challenge Purchased',
    'phase_passed' => 'Phase Passed',
    'challenge_passed' => 'Challenge Passed (Funded)',
    'challenge_failed' => 'Challenge Failed',
    'payment_rejected' => 'Payment Rejected',
    'payment_approved' => 'Payment Approved',
    'password_reset' => 'Password Reset',
    'payout_requested' => 'Payout Requested',
    'payout_approved' => 'Payout Approved',
    'payout_rejected' => 'Payout Rejected',
    'payout_under_review' => 'Payout Under Review',
    'payout_paid' => 'Payout Paid',
    'affiliate_payout_paid' => 'Affiliate Payout Paid',
    'affiliate_commission' => 'Affiliate Commission Earned',
    'payment_proof_submitted' => 'Payment Proof Submitted',
    'kyc_submitted' => 'KYC Submitted',
    'kyc_approved' => 'KYC Approved',
    'kyc_rejected' => 'KYC Rejected',
    '2fa_code' => '2FA Code',
    'account_scaled' => 'Account Scaled Up',
];

$placeholders = "Available placeholders: <code>{name}</code>, <code>{brand}</code>, <code>{plan_name}</code>, <code>{phase}</code>, <code>{amount}</code>, <code>{method}</code>, <code>{reference}</code>, <code>{reason}</code>, <code>{code}</code>, <code>{new_balance}</code>, <code>{new_level}</code>, <code>{rate}</code>";
?>
<div class="wrap fxsim-admin">
    <h1>Email Templates Editor</h1>
    <p class="description">Customize the subjects and HTML body content for system emails. Leave fields blank to use the default system templates.</p>
    <p class="description"><?= $placeholders ?></p>

    <div id="fxsim-email-templates-msg" style="margin-top:12px;margin-bottom:12px;font-weight:600"></div>

    <?php foreach ($events as $slug => $label): 
        $subject = get_option("fxsim_email_subject_{$slug}", '');
        $body = get_option("fxsim_email_body_{$slug}", '');
    ?>
    <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:20px;margin-bottom:20px;max-width:800px">
        <h2 style="margin-top:0;margin-bottom:15px;font-size:16px"><?= esc_html($label) ?> <code><?= esc_html($slug) ?></code></h2>
        
        <table style="width:100%;border-collapse:collapse">
            <tr style="margin-bottom:10px">
                <td style="padding:8px 0;font-weight:600;width:100px;vertical-align:top">Subject</td>
                <td>
                    <input type="text" id="tpl-subj-<?= esc_attr($slug) ?>" class="regular-text" style="width:100%" value="<?= esc_attr($subject) ?>" placeholder="Default subject...">
                </td>
            </tr>
            <tr>
                <td style="padding:8px 0;font-weight:600;vertical-align:top">Body (HTML)</td>
                <td>
                    <textarea id="tpl-body-<?= esc_attr($slug) ?>" style="width:100%;height:150px;font-family:monospace;font-size:13px;padding:10px" placeholder="Default HTML body..."><?= esc_textarea($body) ?></textarea>
                </td>
            </tr>
        </table>
        
        <div style="margin-top:15px;text-align:right">
            <button class="button button-primary" onclick="fxsimAdmin.saveEmailTemplate('<?= esc_js($slug) ?>')">Save Template</button>
        </div>
    </div>
    <?php endforeach; ?>
</div>
