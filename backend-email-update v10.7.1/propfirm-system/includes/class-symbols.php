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
        $allowed = ['spread','commission','min_lot','max_lot','swap_long','swap_short','is_active'];
        $clean   = array_intersect_key($data, array_flip($allowed));
        if (empty($clean)) return false;
        return (bool) $wpdb->update($wpdb->prefix . 'fxsim_symbols', $clean, ['id' => $id]);
    }
}
