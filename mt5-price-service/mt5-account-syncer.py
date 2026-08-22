#!/usr/bin/env python3
"""
PropFirm System — MT5 Multi-Account Sync Worker (V2, self-discovering)
========================================================================

Automates the "sync real MT5 account data back into the platform" half of
MT5 integration. Does NOT create MT5 accounts — that still has to be done by
hand (see ORDER OF OPERATIONS below), because the retail MetaTrader5 Python
package this script uses can only log into and read an EXISTING account; it
has no ability to provision new ones. Real, fully-automated account creation
requires a licensed MT5 broker's "Manager API" (a different, higher-privilege
API), which this project does not have — see MASTER_AUDIT_IMPLEMENTATION_REPORT.md
and the session notes for the full explanation of why.

What this script DOES automate: once an admin has manually created a real
MT5 account for a trader and typed its login/password/server into the
PropFirm admin panel (Admin → the trader's challenge → MT5 Details), this
worker discovers that assignment automatically — no separate config file to
hand-maintain — logs into that account, reads its live balance/equity/open
positions/deal history, and pushes it to the platform's /mt5/sync endpoint,
which updates the trader's dashboard and evaluates drawdown breaches against
their REAL MT5 trading activity.

--------------------------------------------------------------------------
ORDER OF OPERATIONS (per trader)
--------------------------------------------------------------------------
1. (Manual, outside this platform) Create a real MT5 account for the trader
   on your broker's own signup page, MT5 Manager Terminal, or web panel.
2. (Manual, in WP Admin) Enter that account's login/password/server into
   the trader's challenge — Admin → Challenges → [trader] → MT5 Details.
3. (Automatic, this script) On its next poll, this worker discovers the new
   assignment via GET /mt5/sync-targets and starts syncing it — nothing else
   to configure.

--------------------------------------------------------------------------
SETUP
--------------------------------------------------------------------------
1. Install MetaTrader 5 (the desktop terminal) on the machine running this
   script, and Python 3.10+.
2. pip install MetaTrader5 requests
3. In PropFirm admin → Settings → MT5, set an Ingestion secret (a long
   random string) if one isn't already auto-generated — check
   /admin/price-feed/health for the current value if you're not sure.
4. Copy sync_config.example.json → sync_config.json and fill in:
       propfirm_url : https://YOURSITE   (no trailing slash)
       feed_key     : the SAME secret configured in admin
5. Run:  python mt5-account-syncer.py --config sync_config.json

Leave it running (see "RUNNING AS A BACKGROUND SERVICE" below for how to do
that without a terminal window open).

--------------------------------------------------------------------------
HOW MULTI-ACCOUNT SYNCING WORKS (read this before relying on it)
--------------------------------------------------------------------------
A single MetaTrader5 terminal session can only be logged into ONE account at
a time. This script handles multiple accounts by cycling through them
SEQUENTIALLY each poll cycle: login to account 1 -> read -> push -> logout ->
login to account 2 -> ... This means:
  - Each account's data is only as fresh as the last time its turn came up
    in the cycle, not truly real-time.
  - With N accounts and ~2-4 seconds per login/read/logout cycle, a full
    round takes roughly N * 3 seconds. At poll_interval_sec = 60 this stays
    comfortable up to a few dozen accounts; beyond that, either raise
    poll_interval_sec or split accounts across multiple worker instances
    (run this script twice, pointed at different subsets — not built in,
    but straightforward: filter the targets list by challenge_id ranges).
  - This approach does NOT scale to hundreds/thousands of funded accounts.
    If you reach that scale, that's the point where a real MT5 Manager API
    integration (Option 1 in the session notes) stops being optional.

--------------------------------------------------------------------------
RUNNING AS A BACKGROUND SERVICE (Windows)
--------------------------------------------------------------------------
Simplest: Task Scheduler -> create a task that runs
  pythonw.exe "C:\\path\\to\\mt5-account-syncer.py" --config sync_config.json
at startup, with "Run whether user is logged on or not" if you want it to
survive a logout. For a proper Windows service (auto-restart on crash), wrap
it with NSSM (nssm.cc) — `nssm install PropFirmMT5Sync pythonw.exe "...\\mt5-account-syncer.py --config sync_config.json"`.
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone, timedelta

try:
    import MetaTrader5 as mt5
except ImportError:
    print("\n[!] ERROR: MetaTrader5 Python package not found.")
    print("    Install it via: pip install MetaTrader5 requests\n")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("\n[!] ERROR: requests package not found.")
    print("    Install it via: pip install MetaTrader5 requests\n")
    sys.exit(1)


class Colors:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"


def log(level: str, msg: str) -> None:
    now = datetime.now().strftime("%H:%M:%S")
    colors = {"INFO": Colors.CYAN, "SUCCESS": Colors.GREEN, "WARN": Colors.YELLOW, "ERROR": Colors.RED}
    prefix = f"{colors.get(level, '')}[{level}]{Colors.RESET}"
    print(f"{Colors.DIM}[{now}]{Colors.RESET} {prefix} {msg}", flush=True)


def load_config(path: str) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except FileNotFoundError:
        log("ERROR", f"Config file not found: {path}")
        log("WARN", "Copy sync_config.example.json to sync_config.json and fill it in first.")
        sys.exit(1)

    for required in ("propfirm_url", "feed_key"):
        if not cfg.get(required):
            log("ERROR", f"'{required}' missing in {path}")
            sys.exit(1)

    cfg["propfirm_url"] = cfg["propfirm_url"].rstrip("/")
    cfg.setdefault("poll_interval_sec", 60.0)
    cfg.setdefault("between_accounts_sec", 1.0)
    cfg.setdefault("history_days", 30)
    return cfg


def fetch_sync_targets(cfg: dict) -> list:
    """GET /mt5/sync-targets — every challenge with MT5 credentials assigned via the admin panel."""
    url = f"{cfg['propfirm_url']}/wp-json/fxsim/v1/mt5/sync-targets"
    headers = {"X-Feed-Key": cfg["feed_key"]}
    resp = requests.get(url, headers=headers, timeout=10)
    if resp.status_code == 401:
        raise RuntimeError("Unauthorized — feed_key does not match the admin-configured secret.")
    resp.raise_for_status()
    data = resp.json()
    return data.get("targets", [])


def collect_account_telemetry(cfg: dict, challenge_id: int) -> dict | None:
    """Collects real-time balance, equity, margin, open positions, and closed deal history."""
    account = mt5.account_info()
    if not account:
        return None

    account_data = {
        "login": account.login,
        "trade_mode": "demo" if account.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO else "real",
        "name": account.name,
        "server": account.server,
        "currency": account.currency,
        "leverage": account.leverage,
        "balance": float(account.balance),
        "equity": float(account.equity),
        "profit": float(account.profit),
        "margin": float(account.margin),
        "margin_free": float(account.margin_free),
        "margin_level": float(account.margin_level) if account.margin_level else 0.0,
    }

    raw_positions = mt5.positions_get()
    positions = []
    if raw_positions:
        for p in raw_positions:
            pos_type = "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL"
            positions.append({
                "ticket": p.ticket, "symbol": p.symbol, "type": pos_type,
                "volume": float(p.volume), "price_open": float(p.price_open),
                "price_current": float(p.price_current), "sl": float(p.sl), "tp": float(p.tp),
                "profit": float(p.profit), "swap": float(p.swap), "comment": p.comment,
                "time": datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat(),
            })

    history_days = int(cfg.get("history_days", 30))
    from_date = datetime.now(timezone.utc) - timedelta(days=history_days)
    to_date = datetime.now(timezone.utc) + timedelta(days=1)
    raw_deals = mt5.history_deals_get(from_date, to_date)
    deals = []
    if raw_deals:
        for d in raw_deals[-100:]:
            entry_type = "IN" if d.entry == mt5.DEAL_ENTRY_IN else ("OUT" if d.entry == mt5.DEAL_ENTRY_OUT else "INOUT")
            deal_type = "BUY" if d.type == mt5.DEAL_TYPE_BUY else ("SELL" if d.type == mt5.DEAL_TYPE_SELL else "BALANCE")
            deals.append({
                "ticket": d.ticket, "order": d.order, "symbol": d.symbol, "type": deal_type,
                "entry": entry_type, "volume": float(d.volume), "price": float(d.price),
                "profit": float(d.profit), "commission": float(d.commission), "swap": float(d.swap),
                "fee": float(d.fee), "comment": d.comment,
                "time": datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat(),
            })

    return {
        "source": "mt5-python-worker",
        "challenge_id": challenge_id,
        "account_info": account_data,
        "positions": positions,
        "deals": deals,
        "positions_count": len(positions),
        "deals_count": len(deals),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def transmit_telemetry(cfg: dict, payload: dict) -> tuple[bool, str]:
    url = f"{cfg['propfirm_url']}/wp-json/fxsim/v1/mt5/sync"
    headers = {"Content-Type": "application/json", "X-Feed-Key": cfg["feed_key"], "User-Agent": "PropFirm-MT5-Worker/2.0"}
    try:
        t0 = time.time()
        resp = requests.post(url, json=payload, headers=headers, timeout=8.0)
        latency_ms = int((time.time() - t0) * 1000)
        if resp.status_code == 200:
            data = resp.json()
            msg = f"Equity ${payload['account_info']['equity']:,.2f} | {payload['positions_count']} open | {payload['deals_count']} deals ({latency_ms}ms)"
            if data.get("breach_detected"):
                msg += f" {Colors.RED}[BREACH: {data.get('breach_reason')}]{Colors.RESET}"
            return True, msg
        return False, f"HTTP {resp.status_code}: {resp.text[:150]}"
    except requests.RequestException as e:
        return False, f"Push failed: {e}"


def sync_one_account(cfg: dict, target: dict) -> tuple[bool, str]:
    """Login to one MT5 account, read its state, push it, log out. Never leaves a stale session behind."""
    challenge_id = target["challenge_id"]
    login = target.get("login")
    password = target.get("password")
    server = target.get("server")

    if not login or not password or not server:
        return False, "Incomplete MT5 credentials on this challenge — skipping."

    mt5.shutdown()  # ensure a clean slate before switching accounts
    if not mt5.initialize():
        err = mt5.last_error()
        return False, f"MT5 terminal initialize() failed: {err}"

    try:
        if not mt5.login(login=int(login), password=str(password), server=str(server)):
            err = mt5.last_error()
            return False, f"Login failed for #{login}@{server}: {err}"

        payload = collect_account_telemetry(cfg, challenge_id)
        if not payload:
            return False, f"Could not read account_info for #{login} after login."

        return transmit_telemetry(cfg, payload)
    finally:
        mt5.shutdown()


def print_banner():
    print(f"""
{Colors.CYAN}{Colors.BOLD}+-----------------------------------------------------------------------+
|         PROPFIRM SYSTEM -- MT5 MULTI-ACCOUNT SYNC WORKER (V2)         |
|   Self-discovers accounts from admin-panel MT5 assignments. See the   |
|   module docstring for setup, scaling limits, and background-service  |
|   instructions.                                                       |
+-----------------------------------------------------------------------+{Colors.RESET}
""")


def main():
    print_banner()
    parser = argparse.ArgumentParser(description="PropFirm System — MT5 Multi-Account Sync Worker")
    parser.add_argument("--config", "-c", default="sync_config.json", help="Path to config JSON file")
    args = parser.parse_args()
    cfg = load_config(args.config)

    log("SUCCESS", f"Worker starting. Target: {cfg['propfirm_url']} | Poll every {cfg['poll_interval_sec']}s")

    try:
        while True:
            cycle_start = time.time()
            try:
                targets = fetch_sync_targets(cfg)
            except Exception as e:
                log("ERROR", f"Could not fetch sync targets: {e}")
                time.sleep(cfg["poll_interval_sec"])
                continue

            if not targets:
                log("INFO", "No MT5-linked accounts to sync yet (assign MT5 details to a challenge in admin to start).")
            else:
                log("INFO", f"Syncing {len(targets)} account(s)...")
                for t in targets:
                    try:
                        ok, msg = sync_one_account(cfg, t)
                        (log("SUCCESS", f"[#{t['challenge_id']}] {msg}") if ok
                         else log("WARN", f"[#{t['challenge_id']}] {msg}"))
                    except Exception as e:
                        # A single account's unexpected failure must never kill the whole cycle.
                        log("ERROR", f"[#{t.get('challenge_id', '?')}] Unexpected error: {e}")
                    time.sleep(cfg["between_accounts_sec"])

            elapsed = time.time() - cycle_start
            remaining = max(1.0, cfg["poll_interval_sec"] - elapsed)
            time.sleep(remaining)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}[*] Stopping (Ctrl-C)...{Colors.RESET}")
    finally:
        mt5.shutdown()
        log("INFO", "MetaTrader 5 connection terminated cleanly. Goodbye.")


if __name__ == "__main__":
    main()
