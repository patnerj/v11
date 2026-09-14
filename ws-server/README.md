# AlphaCapital Real-Time WebSocket Gateway (`ws-server`)

Ultra-low-latency persistent WebSocket broadcasting gateway for streaming institutional tick prices (EURUSD, XAUUSD, BTCUSD, etc.) to 10,000+ concurrent WebTrader terminals with 0 HTTP polling overhead.

## Architecture

```
 MT5 Account Syncer / WordPress Cron
                │
                ▼ (HTTP POST /push with Bearer Token)
┌─────────────────────────────────────────┐
│     ws-server (Node.js / ws engine)     │
│   - Port 8080 (Configurable)            │
│   - In-memory price cache for instant   │
│     client hydration on connect         │
│   - PM2 Process Manager Supervision     │
└─────────────────────────────────────────┘
                │
                ▼ (Persistent WebSocket Stream)
  10,000+ WebTrader Terminals (Browser / Mobile)
```

## Quick Start (PM2 Process Manager)

### On Windows
Double-click `start_pm2.bat` or run:
```bash
npm run pm2:start
```

### On Linux VPS
```bash
chmod +x start_ws_server.sh
./start_ws_server.sh
```

## Available PM2 Commands
- `npm run pm2:start`   - Start background daemon
- `npm run pm2:logs`    - View real-time output and error logs
- `npm run pm2:restart` - Restart gateway
- `npm run pm2:stop`    - Stop gateway
- `npm run pm2:monit`   - Monitor CPU, memory, and uptime in terminal

## Health Check
- `GET http://127.0.0.1:8080/health` -> Returns service status, uptime, connected clients, and cached symbol count.
- `GET http://127.0.0.1:8080/status` -> Detailed memory and symbol list.

## Push Price Ingest
```bash
curl -X POST http://127.0.0.1:8080/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN" \
  -d '{"prices":{"EURUSD":{"bid":1.08500,"ask":1.08515,"mid":1.08507,"ts":1710000000}}}'
```

## Production SSL / WSS Setup (Nginx Reverse Proxy)
When hosting frontend on HTTPS, terminate SSL at Nginx and forward to ws-server:
```nginx
server {
    server_name ws.yourbrand.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```
