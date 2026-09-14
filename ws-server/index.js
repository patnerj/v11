require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['*'];

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS origin denied'));
    }
  },
}));
app.use(express.json({ limit: '256kb' }));

// Health & telemetry endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'fxsim-ws-gateway',
    uptime: Math.floor(process.uptime()),
    connectedClients: wss ? wss.clients.size : 0,
    cachedSymbols: Object.keys(latestPrices).length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    clients: wss ? wss.clients.size : 0,
    symbols: Object.keys(latestPrices),
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

const server = http.createServer(app);

// Connection & payload bounds
const MAX_TOTAL_CLIENTS = parseInt(process.env.MAX_TOTAL_CLIENTS || '10000', 10);
const MAX_CLIENTS_PER_IP = parseInt(process.env.MAX_CLIENTS_PER_IP || '50', 10);
const clientsPerIp = new Map();

const wss = new WebSocketServer({
  server,
  maxPayload: 32 * 1024,
  verifyClient: (info, cb) => {
    const origin = info.origin || info.req.headers.origin;
    if (!ALLOWED_ORIGINS.includes('*') && origin && !ALLOWED_ORIGINS.includes(origin)) {
      return cb(false, 403, 'Forbidden origin');
    }
    if (wss.clients.size >= MAX_TOTAL_CLIENTS) {
      return cb(false, 503, 'Server at capacity');
    }
    const ip = info.req.socket.remoteAddress || 'unknown';
    const current = clientsPerIp.get(ip) || 0;
    if (current >= MAX_CLIENTS_PER_IP) {
      return cb(false, 429, 'Too many connections from this address');
    }
    cb(true);
  },
});

const PORT = parseInt(process.env.PORT || '8080', 10);
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'a4f9b8c2e1d74653a928f01b54e76c3d82a10e4b7c6d5e9f1a2b3c4d5e6f7a8b';

if (!process.env.SECRET_TOKEN) {
  console.warn('[SECURITY] SECRET_TOKEN not found in env, using standard fallback secret.');
}

// In-memory price cache for immediate hydration upon new client connection
let latestPrices = {};

// Push ingest endpoint for MT5 Syncer or WordPress price cron
app.post('/push', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const expected = `Bearer ${SECRET_TOKEN}`;

  let authorized = false;
  if (authHeader && authHeader.length === expected.length) {
    try {
      authorized = crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
    } catch {
      authorized = false;
    }
  }

  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized: Invalid Bearer token' });
  }

  const { prices } = req.body;
  if (!prices || typeof prices !== 'object') {
    return res.status(400).json({ error: 'Invalid payload: expected { prices: {...} }' });
  }

  // Update in-memory cache
  latestPrices = { ...latestPrices, ...prices };

  // Broadcast to all connected WebSocket clients
  const payload = JSON.stringify({ type: 'prices', data: prices });
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* WebSocket.OPEN */) {
      client.send(payload);
      count++;
    }
  });

  res.json({
    success: true,
    broadcastCount: count,
    totalConnected: wss.clients.size,
    symbolsUpdated: Object.keys(prices).length,
  });
});

// Handle WebSocket client connections
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown';
  clientsPerIp.set(ip, (clientsPerIp.get(ip) || 0) + 1);

  // Send cached prices immediately upon connection so trader terminal has instant data
  if (Object.keys(latestPrices).length > 0) {
    ws.send(JSON.stringify({ type: 'prices', data: latestPrices }));
  }

  // Keep-alive ping/pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('close', () => {
    const n = (clientsPerIp.get(ip) || 1) - 1;
    if (n <= 0) clientsPerIp.delete(ip); else clientsPerIp.set(ip, n);
  });

  ws.on('error', () => {});
});

// Periodic ping to keep connections alive and terminate stale sockets
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`[SHUTDOWN] Received ${signal}. Terminating gateway gracefully...`);
  clearInterval(interval);
  wss.clients.forEach((client) => {
    client.close(1001, 'Gateway shutting down');
  });
  wss.close(() => {
    server.close(() => {
      console.log('[SHUTDOWN] Gateway stopped cleanly.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log('  AlphaCapital Real-Time WebSocket Gateway Active');
  console.log(`  Port:              ${PORT}`);
  console.log(`  Max Clients:       ${MAX_TOTAL_CLIENTS}`);
  console.log(`  Allowed Origins:   ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`  Health Check:      http://127.0.0.1:${PORT}/health`);
  console.log(`  Push Ingest:       POST http://127.0.0.1:${PORT}/push`);
  console.log('=======================================================');
});
