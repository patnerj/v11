<?php
defined('ABSPATH') || exit;

/**
 * Class FXSIM_Confirmo
 * Handles integration with Confirmo cryptocurrency payment gateway.
 *
 * NOTE: Needs in seed_whitelabel: 'confirmo_api_key' => '', 'confirmo_callback_secret' => ''
 */
class FXSIM_Confirmo {
    private static $api_base = 'https://confirmo.net/api/v1';

    /**
     * Get the API key from whitelabel settings.
     */
    private static function get_api_key(): string {
        return FXSIM_Challenge_DB::get_setting('confirmo_api_key', '');
    }

    /**
     * Get the callback secret for signature verification.
     */
    private static function get_callback_secret(): string {
        return FXSIM_Challenge_DB::get_setting('confirmo_callback_secret', '');
    }

    /**
     * Helper: Make authenticated API request to Confirmo.
     *
     * @param string $method 'GET' or 'POST'
     * @param string $endpoint API endpoint path (e.g. '/invoices')
     * @param array $body Request payload (for POST)
     * @return array ['success' => bool, 'data' => mixed, 'message' => string]
     */
    private static function api_request(string $method, string $endpoint, array $body = []): array {
        $api_key = self::get_api_key();
        if (empty($api_key)) {
            return ['success' => false, 'message' => 'Confirmo API key not configured.'];
        }

        $url = self::$api_base . ltrim($endpoint, '/');
        
        $args = [
            'method'  => strtoupper($method),
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
                'Accept'        => 'application/json',
            ],
            'timeout' => 30,
        ];

        if (!empty($body) && strtoupper($method) !== 'GET') {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            error_log('Confirmo API Error: ' . $response->get_error_message());
            return ['success' => false, 'message' => 'Network error: ' . $response->get_error_message()];
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $data = json_decode($response_body, true);

        if ($status_code >= 200 && $status_code < 300) {
            return ['success' => true, 'data' => $data];
        }

        error_log("Confirmo API Error ($status_code): $response_body");
        return ['success' => false, 'message' => 'API Error: ' . (isset($data['message']) ? $data['message'] : 'Unknown error')];
    }

    /**
     * Create a payment invoice via Confirmo API.
     * Called when user clicks 'Pay with Crypto' on checkout.
     *
     * @param int $order_id  The fxsim_payment_orders row ID
     * @param float $amount  Amount in USD
     * @param string $currency Settlement currency (USD)
     * @param array $metadata Additional data (user_id, plan_id, email)
     * @return array ['success' => bool, 'payment_url' => string, 'invoice_id' => string] or error
     */
    public static function create_invoice(int $order_id, float $amount, string $currency = 'USD', array $metadata = []): array {
        $frontend_url = get_option('fxsim_frontend_url', home_url());
        
        $plan_name = isset($metadata['plan_name']) ? $metadata['plan_name'] : 'Challenge Plan';
        
        $payload = [
            'invoice' => [
                'amount' => $amount,
                'currencyFrom' => $currency,
            ],
            'settlement' => [
                'currency' => 'USD',
            ],
            'product' => [
                'name' => $plan_name,
                'description' => 'Challenge Purchase',
            ],
            'reference' => "order_{$order_id}",
            'returnUrl' => rtrim($frontend_url, '/') . '/checkout/success?order_id=' . $order_id,
            'notifyUrl' => rest_url('fxsim/v1/payment/confirmo-callback'),
        ];

        $result = self::api_request('POST', '/invoices', $payload);

        if (!$result['success']) {
            return $result;
        }

        if (isset($result['data']['id']) && isset($result['data']['url'])) {
            return [
                'success' => true,
                'payment_url' => $result['data']['url'],
                'invoice_id' => $result['data']['id']
            ];
        }

        return ['success' => false, 'message' => 'Invalid response from Confirmo API.'];
    }

    /**
     * Verify the HMAC signature from Confirmo.
     * Confirmo sends X-Confirmo-Signature header with HMAC-SHA256 of the body.
     */
    private static function verify_signature(string $payload, string $signature): bool {
        $secret = self::get_callback_secret();
        if (empty($secret)) return false;
        
        $expected = hash_hmac('sha256', $payload, $secret);
        return hash_equals($expected, $signature);
    }

    /**
     * Handle Confirmo IPN/webhook callback.
     * Called by REST API endpoint POST /payment/confirmo-callback
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function handle_callback(WP_REST_Request $request): WP_REST_Response {
        global $wpdb;

        // 1. Read raw POST body
        $payload = $request->get_body();
        
        // 2. Verify HMAC signature
        $signature = $request->get_header('x_confirmo_signature'); // WP REST API converts headers to lowercase with underscores
        if (empty($signature)) {
            $signature = $request->get_header('x-confirmo-signature'); // Fallback
        }

        if (empty($signature) || !self::verify_signature($payload, $signature)) {
            error_log('Confirmo Webhook: Invalid or missing signature.');
            return new WP_REST_Response(['message' => 'Invalid signature'], 401);
        }

        // 3. Parse JSON payload
        $data = json_decode($payload, true);
        if (!$data || !isset($data['status']) || !isset($data['reference'])) {
            error_log('Confirmo Webhook: Invalid JSON or missing fields.');
            return new WP_REST_Response(['message' => 'Invalid payload'], 400);
        }

        $status = $data['status']; // 'active', 'confirming', 'paid', 'expired', 'error'
        $invoice_id = isset($data['id']) ? $data['id'] : '';
        $reference = $data['reference']; // "order_{$order_id}"

        if (strpos($reference, 'order_') !== 0) {
            return new WP_REST_Response(['message' => 'Invalid reference format'], 400);
        }

        $order_id = (int) str_replace('order_', '', $reference);

        // 5. On 'paid' status
        if ($status === 'paid') {
            $orders_table = $wpdb->prefix . 'fxsim_payment_orders';
            
            $order = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$orders_table} WHERE id = %d", $order_id));
            if (!$order) {
                error_log("Confirmo Webhook: Order $order_id not found.");
                return new WP_REST_Response(['message' => 'Order not found'], 404);
            }

            // Check idempotency (don't double-process)
            if ($order->status === 'approved' || $order->status === 'completed') {
                return new WP_REST_Response(['message' => 'Already processed'], 200);
            }

            // Update fxsim_payment_orders
            $wpdb->update(
                $orders_table,
                [
                    'status' => 'approved',
                    'txn_id' => $invoice_id,
                    'gateway' => 'confirmo',
                    'updated_at' => current_time('mysql')
                ],
                ['id' => $order_id]
            );

            // Call FXSIM_Challenge_Engine::create_challenge() to activate the account
            try {
                $result = FXSIM_Challenge_Engine::create_challenge((int)$order->user_id, (int)$order->plan_id);
                $challenge_id = $result['success'] ? ($result['challenge_id'] ?? 0) : 0;
                
                // Send confirmation email
                if (class_exists('FXSIM_Emails')) {
                    $email_data = [
                        'order_id' => $order_id,
                        'plan_id' => $order->plan_id,
                        'amount' => $order->amount,
                        'currency' => $order->currency,
                        'challenge_id' => $challenge_id
                    ];
                    FXSIM_Emails::send($order->user_id, 'challenge_purchased', $email_data);
                }

                // Invalidate user cache
                if (class_exists('FXSIM_Cache') && method_exists('FXSIM_Cache', 'invalidate_user')) {
                    FXSIM_Cache::invalidate_user($order->user_id);
                } else {
                    delete_transient("fxsim_user_{$order->user_id}");
                }

            } catch (Exception $e) {
                error_log("Confirmo Webhook: Error creating challenge for order $order_id - " . $e->getMessage());
                return new WP_REST_Response(['message' => 'Error processing order'], 500);
            }
        }

        // 6. Return 200 OK
        return new WP_REST_Response(['message' => 'Webhook received successfully'], 200);
    }

    /**
     * Get invoice status from Confirmo API.
     * Used for admin to check payment status manually.
     */
    public static function get_invoice_status(string $invoice_id): array {
        $result = self::api_request('GET', '/invoices/' . $invoice_id);
        
        if ($result['success']) {
            return [
                'success' => true,
                'status' => isset($result['data']['status']) ? $result['data']['status'] : 'unknown',
                'data' => $result['data']
            ];
        }

        return $result;
    }
}
