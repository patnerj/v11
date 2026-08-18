<?php
defined('ABSPATH') || exit;

class FXSIM_Symbols {

    public static function all(bool $active_only = true): array {
        global $wpdb;
        $where = $active_only ? 'WHERE is_active=1' : '';
        return $wpdb->get_results("SELECT * FROM {$wpdb->prefix}fxsim_symbols $where ORDER BY category, symbol") ?: [];
    }

    public static function get(string $symbol): ?object {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(
            "SELECT * FROM {$wpdb->prefix}fxsim_symbols WHERE symbol=%s AND is_active=1", $symbol
        ));
    }

    public static function update(int $id, array $data): bool {
        global $wpdb;
        $allowed = ['symbol','display_name','category','spread','commission','min_lot','max_lot','contract_size','swap_long','swap_short','is_active'];
        $clean   = array_intersect_key($data, array_flip($allowed));
        if (empty($clean)) return false;
        return (bool) $wpdb->update($wpdb->prefix . 'fxsim_symbols', $clean, ['id' => $id]);
    }

    public static function create(array $data): int {
        global $wpdb;
        $wpdb->insert($wpdb->prefix . 'fxsim_symbols', [
            'symbol'        => strtoupper(sanitize_text_field($data['symbol'] ?? '')),
            'display_name'  => sanitize_text_field($data['display_name'] ?? $data['symbol'] ?? ''),
            'category'      => sanitize_text_field($data['category'] ?? 'forex'),
            'spread'        => (float)($data['spread'] ?? 0.00020),
            'commission'    => (float)($data['commission'] ?? 7.00),
            'min_lot'       => (float)($data['min_lot'] ?? 0.01),
            'max_lot'       => (float)($data['max_lot'] ?? 50.00),
            'contract_size' => (int)($data['contract_size'] ?? 100000),
            'swap_long'     => (float)($data['swap_long'] ?? -0.50),
            'swap_short'    => (float)($data['swap_short'] ?? 0.30),
            'is_active'     => isset($data['is_active']) ? (!empty($data['is_active']) ? 1 : 0) : 1,
        ]);
        return (int) $wpdb->insert_id;
    }

    public static function delete(int $id): bool {
        global $wpdb;
        return (bool) $wpdb->delete($wpdb->prefix . 'fxsim_symbols', ['id' => $id]);
    }
}
