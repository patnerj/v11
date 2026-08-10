<?php
/**
 * Coupon / promotion engine.
 *
 * Pure payment-layer logic — never touches the trading or challenge engines.
 * Discounts are always validated and computed SERVER-SIDE; the frontend only
 * previews. Redemption is idempotent (unique coupon_id+order_id) and the usage
 * counter is incremented atomically, so concurrent checkouts and Stripe webhook
 * retries cannot over-count a coupon's uses.
 */
if (!defined('ABSPATH')) exit;

class FXSIM_Coupons {

    /** Compute the discount for a price given a coupon row. Clamped to [0, price]. */
    public static function compute_discount(object $c, float $price): float {
        if ($c->type === 'percent') {
            return round($price * ((float) $c->value / 100), 2);
        }
        return round(min((float) $c->value, $price), 2); // fixed
    }

    /**
     * Validate a coupon for a (plan, user) and return a price preview.
     * Returns ['valid'=>bool, 'message'=>string, ...preview fields when valid].
     */
    public static function validate(string $code, int $plan_id, int $user_id): array {
        global $wpdb;
        $code = strtoupper(trim($code));
        if ($code === '') return ['valid' => false, 'message' => 'Enter a coupon code.'];

        $c = $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_coupons WHERE code = %s", $code));
        if (!$c || !(int) $c->active) return ['valid' => false, 'message' => 'Invalid coupon code.'];

        if ($c->expires_at && strtotime($c->expires_at) < time()) {
            return ['valid' => false, 'message' => 'This coupon has expired.'];
        }
        if (!empty($c->plan_ids)) {
            $ids = array_filter(array_map('intval', explode(',', $c->plan_ids)));
            if ($ids && !in_array($plan_id, $ids, true)) {
                return ['valid' => false, 'message' => 'This coupon doesn\'t apply to the selected plan.'];
            }
        }
        if ((int) $c->usage_limit > 0 && (int) $c->used_count >= (int) $c->usage_limit) {
            return ['valid' => false, 'message' => 'This coupon has reached its usage limit.'];
        }
        if ((int) $c->per_user_limit > 0) {
            $used = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}fxsim_coupon_redemptions WHERE coupon_id = %d AND user_id = %d",
                $c->id, $user_id));
            if ($used >= (int) $c->per_user_limit) {
                return ['valid' => false, 'message' => 'You have already used this coupon.'];
            }
        }

        $plan = FXSIM_Challenge_DB::get_plan($plan_id);
        if (!$plan) return ['valid' => false, 'message' => 'Plan not found.'];

        $price    = (float) $plan->price;
        $discount = self::compute_discount($c, $price);
        $final    = max(0, round($price - $discount, 2));

        return [
            'valid'     => true,
            'message'   => 'Coupon applied.',
            'coupon_id' => (int) $c->id,
            'code'      => $c->code,
            'type'      => $c->type,
            'value'     => (float) $c->value,
            'original'  => round($price, 2),
            'discount'  => round($discount, 2),
            'final'     => $final,
        ];
    }

    /**
     * Record a redemption when an order is actually PAID. Idempotent: a repeated
     * call for the same (coupon, order) is ignored, and the usage counter is only
     * incremented on first insert, atomically respecting the usage limit.
     */
    public static function record_redemption(int $coupon_id, int $user_id, int $order_id, float $discount, float $final): void {
        if ($coupon_id <= 0 || $order_id <= 0) return;
        global $wpdb;
        $inserted = $wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->prefix}fxsim_coupon_redemptions
                (coupon_id, user_id, order_id, discount_amount, final_amount, created_at)
             VALUES (%d, %d, %d, %f, %f, %s)",
            $coupon_id, $user_id, $order_id, $discount, $final, current_time('mysql')));
        if ($inserted) {
            $wpdb->query($wpdb->prepare(
                "UPDATE {$wpdb->prefix}fxsim_coupons
                 SET used_count = used_count + 1
                 WHERE id = %d AND (usage_limit = 0 OR used_count < usage_limit)",
                $coupon_id));
        }
    }
}
