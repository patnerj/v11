<?php
/**
 * Handles communication with the MT5 Manager API.
 * Currently acts as a stub / foundation for the future integration, using the credentials
 * saved via the admin interface to ping or provision accounts.
 */
class FXSIM_MT5_Manager {
    
    /**
     * Checks if the MT5 manager is fully configured by the admin.
     */
    public static function is_configured(): bool {
        $server = FXSIM_Challenge_DB::get_setting('mt5_manager_url');
        $login = FXSIM_Challenge_DB::get_setting('mt5_manager_login');
        $pass = FXSIM_Challenge_DB::get_setting('mt5_manager_password');
        
        return !empty($server) && !empty($login) && !empty($pass);
    }
    
    /**
     * Pings the server using the configured credentials.
     * This is a stub that will be wired to the real Python service / API in the future.
     */
    public static function ping(): bool {
        if (!self::is_configured()) {
            return false;
        }
        // TODO: Make cURL request to MT5 service using the credentials.
        return true;
    }
    
    /**
     * Creates a new demo account for a challenge.
     * 
     * @param float $balance Starting balance
     * @param string $group The MT5 group name
     * @return array|null Returns ['login' => '...', 'password' => '...', 'investor' => '...'] on success
     */
    public static function create_account(float $balance, string $group): ?array {
        if (!self::is_configured()) {
            return null;
        }
        
        // TODO: Make actual API call
        return [
            'login' => rand(100000, 999999),
            'password' => wp_generate_password(8, false),
            'investor' => wp_generate_password(8, false)
        ];
    }
}
