require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');

const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;
const SECRET_TOKEN = process.env.SECRET_TOKEN || crypto.randomBytes(32).toString('hex');
if (!process.env.SECRET_TOKEN) {
  console.warn('[SECURITY WARNING] SECRET_TOKEN not configured in environment. Generated ephemeral 64-char secret for this process.');
}

// Cache the latest prices to send immediately on new connection
let latestPrices = {};

// Handle incoming prices from WordPress
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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { prices } = req.body;
  if (!prices || typeof prices !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Update cache
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

  res.json({ success: true, broadcastCount: count });
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  // Send cached prices immediately upon connection
  if (Object.keys(latestPrices).length > 0) {
    ws.send(JSON.stringify({ type: 'prices', data: latestPrices }));
  }

  // Keep-alive ping/pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('error', console.error);
});

// Periodic ping to keep connections alive and clear dead ones
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

// Start the server
server.listen(PORT, () => {
  console.log(`WebSocket & Push Server running on port ${PORT}`);
});
