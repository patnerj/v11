import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

const YAHOO_MAP: Record<string, string> = {
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'USDCAD=X',
  USDCHF: 'USDCHF=X',
  NZDUSD: 'NZDUSD=X',
  EURGBP: 'EURGBP=X',
  EURJPY: 'EURJPY=X',
  GBPJPY: 'GBPJPY=X',
  XAUUSD: 'GC=F',
  XAGUSD: 'SI=F',
  US30:   '^DJI',
  US500:  '^GSPC',
  NAS100: '^IXIC',
  GER40:  '^GDAXI',
  UK100:  '^FTSE',
  BTCUSD: 'BTC-USD',
  ETHUSD: 'ETH-USD',
  SOLUSD: 'SOL-USD',
}

const YAHOO_INTERVALS: Record<string, { interval: string; range: string }> = {
  M1:  { interval: '1m',  range: '7d' },
  M5:  { interval: '5m',  range: '60d' },
  M15: { interval: '15m', range: '60d' },
  M30: { interval: '30m', range: '60d' },
  H1:  { interval: '1h',  range: '730d' },
  H4:  { interval: '1h',  range: '730d' },
  D1:  { interval: '1d',  range: '10y' },
  W1:  { interval: '1wk', range: '10y' },
}

const BINANCE_INTERVALS: Record<string, string> = {
  M1: '1m', M5: '5m', M15: '15m', M30: '30m',
  H1: '1h', H4: '4h', D1: '1d', W1: '1w',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = (searchParams.get('symbol') || 'BTCUSD').toUpperCase().trim()
  const tf = (searchParams.get('timeframe') || searchParams.get('tf') || 'H1').toUpperCase().trim()

  const isCrypto = symbol.startsWith('BTC') || symbol.startsWith('ETH') || symbol.startsWith('SOL') || symbol.includes('USDT')

  // 1. If Crypto, query Binance with mirrors
  if (isCrypto) {
    const pair = symbol.replace('USD', 'USDT')
    const bInterval = BINANCE_INTERVALS[tf] || '1h'
    const endpoints = [
      `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${bInterval}&limit=1000`,
      `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=${bInterval}&limit=1000`,
    ]

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          next: { revalidate: 60 },
          signal: AbortSignal.timeout(3500),
        })
        if (res.ok) {
          const raw = await res.json()
          if (Array.isArray(raw) && raw.length > 0) {
            const candles = raw.map((k: any) => ({
              time: Number(k[0]),
              open: parseFloat(Number(k[1]).toFixed(4)),
              high: parseFloat(Number(k[2]).toFixed(4)),
              low: parseFloat(Number(k[3]).toFixed(4)),
              close: parseFloat(Number(k[4]).toFixed(4)),
              volume: Math.round(Number(k[5])),
            }))
            return NextResponse.json({ ok: true, data: candles }, {
              headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
              },
            })
          }
        }
      } catch {}
    }
  }

  // 2. Query Yahoo Finance V8 Chart API
  const yTicker = YAHOO_MAP[symbol] || `${symbol}=X`
  const yConfig = YAHOO_INTERVALS[tf] || { interval: '1h', range: '730d' }
  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yTicker)}?interval=${yConfig.interval}&range=${yConfig.range}`

  try {
    const res = await fetch(yUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      const result = data?.chart?.result?.[0]
      if (result && Array.isArray(result.timestamp) && result.indicators?.quote?.[0]) {
        const ts = result.timestamp
        const q = result.indicators.quote[0]
        const count = ts.length

        const pip = symbol.includes('JPY') ? 0.01 : 0.0001
        const candles = []
        for (let i = 0; i < count; i++) {
          const o = q.open?.[i]
          const h = q.high?.[i]
          const l = q.low?.[i]
          const c = q.close?.[i]

          if (o !== null && h !== null && l !== null && c !== null && !isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c)) {
            const rawO = Number(o)
            const rawH = Number(h)
            const rawL = Number(l)
            const rawC = Number(c)
            const isFlat = rawO === rawH && rawH === rawL && rawL === rawC

            // Skip zero-range flat weekend / closed artifact bars if not the active last bar
            if (isFlat && i < count - 1) {
              continue
            }

            let adjH = rawH
            let adjL = rawL
            if (isFlat) {
              adjH = rawH + pip * 0.8
              adjL = rawL - pip * 0.8
            }

            const pipsSpan = Math.abs(adjH - adjL) / pip
            const synthVol = Math.max(320, Math.round(pipsSpan * 90 + ((rawO + rawC) * 10000) % 280))
            const vol = (q.volume?.[i] && Number(q.volume[i]) > 0) ? Math.round(Number(q.volume[i])) : synthVol

            candles.push({
              time: Number(ts[i]) * 1000,
              open: parseFloat(rawO.toFixed(5)),
              high: parseFloat(adjH.toFixed(5)),
              low: parseFloat(adjL.toFixed(5)),
              close: parseFloat(rawC.toFixed(5)),
              volume: vol,
            })
          }
        }

        if (candles.length > 0) {
          // If H4 requested and Yahoo only gave H1, aggregate H1 into H4 bars
          let finalCandles = candles
          if (tf === 'H4') {
            finalCandles = aggregateH1ToH4(candles)
          }

          return NextResponse.json({ ok: true, data: finalCandles }, {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
          })
        }
      }
    }
  } catch (err) {
    // Return empty fallback error
  }

  return NextResponse.json({ ok: false, error: 'Feed unavailable' }, { status: 502 })
}

function aggregateH1ToH4(h1Candles: any[]): any[] {
  const h4Map = new Map<number, any>()
  for (const c of h1Candles) {
    const bucket = Math.floor(c.time / (4 * 3600 * 1000)) * (4 * 3600 * 1000)
    const existing = h4Map.get(bucket)
    if (!existing) {
      h4Map.set(bucket, {
        time: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })
    } else {
      existing.high = Math.max(existing.high, c.high)
      existing.low = Math.min(existing.low, c.low)
      existing.close = c.close
      existing.volume += c.volume
    }
  }
  return Array.from(h4Map.values()).sort((a, b) => a.time - b.time)
}
