#!/usr/bin/env python3
"""
PropFirm System — MT5 Price Service (V10, Phase 1)
==================================================

Reads live quotes from a LOCAL MetaTrader 5 terminal and PUSHES them to the
PropFirm System ingestion endpoint over HTTPS. No broker server, Manager API,
Web API, or partnership is required — this reads the terminal's own quotes via
the MetaTrader5 desktop package.

Runs identically on:
  - your local Windows PC          (Scenario A)
  - a friend's / cousin's PC       (Scenario B)
  - a Windows VPS                  (Scenario C)
Only this config changes (URL + secret). The platform never changes.

Transport = outbound HTTPS POST (push). Works behind NAT / residential
internet — no inbound ports, no public IP needed on the MT5 machine.

--------------------------------------------------------------------------
SETUP
--------------------------------------------------------------------------
1. Install MetaTrader 5 on the Windows machine and log into a demo account.
2. Install Python 3.10+ and dependencies:
       pip install MetaTrader5 requests
3. In the PropFirm admin → Settings → Live price feed (MT5):
       - set an Ingestion secret (a long random string)
       - set Source mode = auto (recommended to start)
4. Copy config.example.json → config.json and fill in:
       - propfirm_url   : https://YOURSITE   (no trailing slash)
       - feed_key       : the SAME secret you set in admin
       - symbol_suffix  : your broker's suffix, e.g. "" or ".m" or ".raw"
5. Run:
       python price_service.py --config config.json

Leave it running. Watch the admin Live-price-feed card turn green ("MT5 live").
Switch Source mode to "mt5" only once you're satisfied the feed is stable.

--------------------------------------------------------------------------
NOTES
--------------------------------------------------------------------------
- Push cadence default = 1.0s. Lower = fresher but heavier; 1–2s is plenty.
- Symbol mapping: the platform uses canonical names (EURUSD, XAUUSD, ...).
  Your broker may expose EURUSD.m / XAUUSD.raw etc. Set symbol_suffix, or add
  explicit overrides in config.json -> "symbol_overrides".
- The service degrades safely: if a symbol is missing or the terminal drops,
  it skips that tick and retries; the platform's staleness monitor will flag it.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

try:
    import MetaTrader5 as mt5
except ImportError:
    print("ERROR: MetaTrader5 package not installed. Run: pip install MetaTrader5")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests package not installed. Run: pip install requests")
    sys.exit(1)

# Canonical platform symbols (must match the platform's symbol table).
# Symbols the broker doesn't quote are skipped automatically in collect_prices,
# so listing the full catalog here is safe. Index/oil/cross names vary by broker
# (e.g. US30 vs DJ30 vs US30.cash) — map those in config.json -> symbol_overrides.
PLATFORM_SYMBOLS = [
    # Forex majors
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
    # Forex crosses
    "EURGBP", "EURJPY", "GBPJPY", "EURAUD", "EURNZD", "EURCAD",
    "GBPAUD", "GBPCAD", "GBPCHF", "AUDJPY", "AUDCAD", "AUDCHF",
    "NZDJPY", "CADJPY", "CHFJPY",
    # Metals
    "XAUUSD", "XAGUSD",
    # Crypto
    "BTCUSD", "ETHUSD",
    # Indices
    "US30", "NAS100", "SPX500", "GER40", "UK100",
    # Energy
    "USOIL", "XBRUSD",
]


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        cfg = json.load(fh)
    for required in ("propfirm_url", "feed_key"):
        if not cfg.get(required):
            log(f"ERROR: '{required}' missing in {path}")
            sys.exit(1)
    cfg.setdefault("symbol_suffix", "")
    cfg.setdefault("symbol_overrides", {})
    cfg.setdefault("interval_sec", 1.0)
    cfg.setdefault("source_id", "mt5-service")
    cfg["propfirm_url"] = cfg["propfirm_url"].rstrip("/")
    return cfg


def broker_symbol(platform_sym: str, cfg: dict) -> str:
    """Map a canonical platform symbol to this broker's symbol name."""
    if platform_sym in cfg["symbol_overrides"]:
        return cfg["symbol_overrides"][platform_sym]
    return platform_sym + cfg["symbol_suffix"]


def ensure_mt5() -> bool:
    if not mt5.initialize():
        log(f"MT5 initialize() failed: {mt5.last_error()} — is the terminal open and logged in?")
        return False
    return True


def collect_prices(cfg: dict) -> dict:
    """Return {PLATFORM_SYMBOL: {'bid': float, 'ask': float}} for available symbols."""
    prices = {}
    for sym in PLATFORM_SYMBOLS:
        bsym = broker_symbol(sym, cfg)
        # Make sure the symbol is selected in Market Watch so a tick is available.
        if not mt5.symbol_select(bsym, True):
            continue
        tick = mt5.symbol_info_tick(bsym)
        if tick is None:
            continue
        bid = float(getattr(tick, "bid", 0) or 0)
        ask = float(getattr(tick, "ask", 0) or 0)
        if bid > 0 and ask > 0:
            prices[sym] = {"bid": bid, "ask": ask}
    return prices


def push(cfg: dict, prices: dict) -> bool:
    url = f"{cfg['propfirm_url']}/wp-json/fxsim/v1/price-feed/ingest"
    headers = {"X-FXSIM-Feed-Key": cfg["feed_key"], "Content-Type": "application/json"}
    payload = {"source_id": cfg["source_id"], "prices": prices}
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=8)
    except requests.RequestException as exc:
        log(f"PUSH error: {exc}")
        return False
    if resp.status_code == 200:
        try:
            accepted = resp.json().get("accepted", "?")
        except ValueError:
            accepted = "?"
        log(f"OK — {accepted} symbols accepted")
        return True
    if resp.status_code in (401, 403):
        log(f"AUTH error {resp.status_code}: check feed_key matches the admin secret, and ingestion is enabled.")
    else:
        log(f"PUSH rejected {resp.status_code}: {resp.text[:160]}")
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="PropFirm MT5 Price Service")
    parser.add_argument("--config", default="config.json", help="Path to config.json")
    args = parser.parse_args()

    cfg = load_config(args.config)
    log(f"Starting MT5 price service → {cfg['propfirm_url']} (every {cfg['interval_sec']}s)")

    if not ensure_mt5():
        sys.exit(1)
    log("MT5 connected.")

    misses = 0
    try:
        while True:
            start = time.time()
            prices = collect_prices(cfg)
            if prices:
                push(cfg, prices)
                misses = 0
            else:
                misses += 1
                log("No prices collected this cycle (market closed or symbols not found).")
                if misses % 30 == 0:
                    # Periodically attempt to re-establish the terminal connection.
                    mt5.shutdown()
                    time.sleep(1)
                    ensure_mt5()
            elapsed = time.time() - start
            time.sleep(max(0.1, cfg["interval_sec"] - elapsed))
    except KeyboardInterrupt:
        log("Stopping (Ctrl-C).")
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    main()
