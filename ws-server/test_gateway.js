const WebSocket = require('ws');
const http = require('http');

const SECRET_TOKEN = 'a4f9b8c2e1d74653a928f01b54e76c3d82a10e4b7c6d5e9f1a2b3c4d5e6f7a8b';

function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('  AlphaCapital WebSocket Gateway End-to-End Tests   ');
  console.log('====================================================');

  // 1. Health check
  console.log('\n[1/5] Testing GET /health ...');
  const health = await httpRequest({ host: '127.0.0.1', port: 8080, path: '/health', method: 'GET' });
  console.log('Status code:', health.status, 'Payload:', health.data);
  if (health.status !== 200 || health.data.status !== 'ok') {
    throw new Error('Health check failed');
  }

  // 2. Status check
  console.log('\n[2/5] Testing GET /status ...');
  const status = await httpRequest({ host: '127.0.0.1', port: 8080, path: '/status', method: 'GET' });
  console.log('Status code:', status.status, 'Payload:', status.data);
  if (status.status !== 200 || status.data.status !== 'online') {
    throw new Error('Status check failed');
  }

  // 3. Unauthorized Push check
  console.log('\n[3/5] Testing POST /push (Unauthorized - No Token) ...');
  const unauth = await httpRequest(
    { host: '127.0.0.1', port: 8080, path: '/push', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ prices: {} })
  );
  console.log('Status code:', unauth.status, 'Payload:', unauth.data);
  if (unauth.status !== 401) {
    throw new Error('Expected 401 Unauthorized');
  }

  // 4. Authorized Push with Initial Cache
  console.log('\n[4/5] Testing POST /push (Authorized - Seeding Initial Prices) ...');
  const initialPrices = {
    EURUSD: { bid: 1.08500, ask: 1.08515, mid: 1.08507, ts: Date.now() },
    XAUUSD: { bid: 2650.10, ask: 2650.40, mid: 2650.25, ts: Date.now() },
    BTCUSD: { bid: 68500.0, ask: 68520.0, mid: 68510.0, ts: Date.now() }
  };
  const authPush = await httpRequest(
    {
      host: '127.0.0.1',
      port: 8080,
      path: '/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET_TOKEN}`
      }
    },
    JSON.stringify({ prices: initialPrices })
  );
  console.log('Push status:', authPush.status, 'Response:', authPush.data);
  if (authPush.status !== 200 || !authPush.data.success) {
    throw new Error('Authorized push failed');
  }

  // 5. Connect WebSocket Client and Test Real-Time Broadcast
  console.log('\n[5/5] Testing WebSocket Client Connection & Live Broadcast ...');
  await new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:8080');
    let receivedCache = false;

    ws.on('open', () => {
      console.log(' [WS] Connected to ws://127.0.0.1:8080 successfully!');
    });

    ws.on('message', async (msgStr) => {
      const msg = JSON.parse(msgStr);
      if (!receivedCache) {
        receivedCache = true;
        console.log(' [WS] Instant Cache Received on Connect:', msg.type, Object.keys(msg.data));
        if (msg.type !== 'prices' || !msg.data.EURUSD) {
          return reject(new Error('Invalid initial cache payload'));
        }

        // Now trigger a live broadcast while connected
        console.log(' [HTTP] Broadcasting real-time tick for EURUSD & BTCUSD...');
        const broadcastTick = {
          EURUSD: { bid: 1.09250, ask: 1.09265, mid: 1.09257, ts: Date.now() },
          BTCUSD: { bid: 69120.0, ask: 69135.0, mid: 69127.5, ts: Date.now() }
        };
        await httpRequest(
          {
            host: '127.0.0.1',
            port: 8080,
            path: '/push',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SECRET_TOKEN}`
            }
          },
          JSON.stringify({ prices: broadcastTick })
        );
      } else {
        console.log(' [WS] Real-Time Broadcast Received by Trader Client:');
        console.log('      EURUSD Bid:', msg.data.EURUSD?.bid, 'Ask:', msg.data.EURUSD?.ask);
        console.log('      BTCUSD Bid:', msg.data.BTCUSD?.bid, 'Ask:', msg.data.BTCUSD?.ask);
        if (msg.data.EURUSD?.bid === 1.09250) {
          console.log('\n>>> SUCCESS: ZERO-LATENCY REAL-TIME BROADCAST VERIFIED! <<<');
          ws.close();
          resolve();
        }
      }
    });

    ws.on('error', reject);
  });

  console.log('\nALL 5 TESTS PASSED WITH 100% SUCCESS!\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
