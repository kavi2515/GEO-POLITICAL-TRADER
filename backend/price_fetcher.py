"""
Real-time price fetcher.
- Stocks, commodities, currencies, indices: Yahoo Finance JSON API (no extra libraries)
- Crypto: CoinGecko (free, no API key)
"""
import logging
import time
import requests
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Yahoo Finance symbol map  (asset_key → Yahoo symbol)
# ---------------------------------------------------------------------------

YAHOO_MAP: dict[str, str] = {
    "OIL/BRENT":        "BZ=F",
    "OIL/WTI":          "CL=F",
    "NATGAS":           "NG=F",
    "GOLD":             "GC=F",
    "SILVER":           "SI=F",
    "COPPER":           "HG=F",
    "WHEAT":            "ZW=F",
    "SOYBEANS":         "ZS=F",
    "USD":              "DX-Y.NYB",
    "EUR":              "EURUSD=X",
    "JPY":              "JPY=X",
    "GBP":              "GBPUSD=X",
    "CHF":              "CHF=X",
    "CNY":              "CNY=X",
    "RUB":              "RUB=X",
    "TRY":              "TRY=X",
    "INR":              "INR=X",
    "BRL":              "BRL=X",
    "ILS":              "ILS=X",
    "KRW":              "KRW=X",
    "TWD":              "TWD=X",
    "PKR":              "PKR=X",
    "SAR":              "SAR=X",
    "UAH":              "UAH=X",
    "SPX500":           "^GSPC",
    "NASDAQ":           "^IXIC",
    "DAX":              "^GDAXI",
    "NIKKEI225":        "^N225",
    "FTSE100":          "^FTSE",
    "HSI":              "^HSI",
    "DEFENCE":          "ITA",
    "TECH":             "XLK",
    "AIRLINE":          "JETS",
    "INSURANCE":        "IAK",
    "CONSTRUCTION":     "ITB",
    "TRANSPORT":        "IYT",
    "BONDS":            "TLT",
    "EMERGING_MARKETS": "EEM",
    "REAL_ESTATE":      "VNQ",
    "SEMICONDUCTORS":   "SOXX",
    "AAPL":  "AAPL",  "MSFT":  "MSFT",  "NVDA":  "NVDA",  "GOOGL": "GOOGL",
    "AMZN":  "AMZN",  "META":  "META",  "TSLA":  "TSLA",  "AMD":   "AMD",
    "INTC":  "INTC",  "QCOM":  "QCOM",
    "LMT":   "LMT",   "RTX":   "RTX",   "NOC":   "NOC",   "BA":    "BA",   "GD": "GD",
    "XOM":   "XOM",   "CVX":   "CVX",   "COP":   "COP",
    "JPM":   "JPM",   "GS":    "GS",    "BAC":   "BAC",
    "JNJ":   "JNJ",   "PFE":   "PFE",
    "NEM":   "NEM",   "FCX":   "FCX",
    "TSM":   "TSM",   "BABA":  "BABA",  "ASML":  "ASML",  "SAP":   "SAP",
    "BP":    "BP",    "SHEL":  "SHEL",  "TTE":   "TTE",   "TM":    "TM",
    "RIO":   "RIO",   "BHP":   "BHP",   "CHKP":  "CHKP",  "INFY":  "INFY",
}

CRYPTO_IDS: dict[str, str] = {
    "CRYPTO/BTC":  "bitcoin",      "CRYPTO/ETH":  "ethereum",
    "CRYPTO/SOL":  "solana",       "CRYPTO/XRP":  "ripple",
    "CRYPTO/BNB":  "binancecoin",  "CRYPTO/ADA":  "cardano",
    "CRYPTO/DOGE": "dogecoin",     "CRYPTO/AVAX": "avalanche-2",
    "CRYPTO/LINK": "chainlink",    "CRYPTO/DOT":  "polkadot",
}

_cache: dict[str, dict] = {}
_last_fetch: float = 0
CACHE_TTL = 300  # 5 minutes

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def _format(price: float) -> str:
    if price >= 10000:  return f"{price:,.0f}"
    if price >= 100:    return f"{price:,.2f}"
    if price >= 1:      return f"{price:.4f}"
    return f"{price:.6f}"


# ---------------------------------------------------------------------------
# Yahoo Finance  — direct JSON API, no library needed
# ---------------------------------------------------------------------------

def _yahoo_chart(symbol: str, interval: str, range_: str) -> dict | None:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?interval={interval}&range={range_}&includePrePost=false"
    )
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return None
        data = r.json()
        result = data.get("chart", {}).get("result")
        if not result:
            return None
        return result[0]
    except Exception as e:
        logger.debug("Yahoo chart failed %s: %s", symbol, e)
        return None


def _yahoo_price(asset_key: str, symbol: str) -> dict | None:
    result = _yahoo_chart(symbol, "1d", "5d")
    if not result:
        return None
    try:
        closes = result["indicators"]["quote"][0].get("close", [])
        closes = [c for c in closes if c is not None]
        if len(closes) < 1:
            return None
        price = closes[-1]
        prev  = closes[-2] if len(closes) >= 2 else price
        change_pct = (price - prev) / prev * 100 if prev else 0
        return {
            "price":      round(price, 6),
            "change_pct": round(change_pct, 2),
            "ticker":     symbol,
            "formatted":  _format(price),
        }
    except Exception as e:
        logger.debug("Yahoo price parse failed %s: %s", symbol, e)
        return None


def _fetch_yahoo_prices(asset_keys: list[str]) -> dict[str, dict]:
    result = {}
    for key in asset_keys:
        symbol = YAHOO_MAP.get(key)
        if not symbol:
            continue
        data = _yahoo_price(key, symbol)
        if data:
            result[key] = data
    logger.info("Yahoo Finance: fetched %d prices", len(result))
    return result


# ---------------------------------------------------------------------------
# CoinGecko — crypto
# ---------------------------------------------------------------------------

def _fetch_crypto_prices() -> dict[str, dict]:
    ids = ",".join(CRYPTO_IDS.values())
    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={ids}&vs_currencies=usd&include_24hr_change=true"
    )
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return {}
        data   = r.json()
        result = {}
        for asset_key, coin_id in CRYPTO_IDS.items():
            coin   = data.get(coin_id, {})
            price  = coin.get("usd", 0)
            change = coin.get("usd_24h_change", 0) or 0
            if price <= 0:
                continue
            result[asset_key] = {
                "price":      round(price, 6),
                "change_pct": round(change, 2),
                "ticker":     coin_id,
                "formatted":  _format(price),
            }
        logger.info("CoinGecko: fetched %d crypto prices", len(result))
        return result
    except Exception as e:
        logger.warning("CoinGecko fetch failed: %s", e)
        return {}


# ---------------------------------------------------------------------------
# Combined fetch (with 5-min cache)
# ---------------------------------------------------------------------------

def fetch_prices(assets: list[str] | None = None) -> dict[str, dict]:
    global _last_fetch, _cache

    now = time.time()
    if now - _last_fetch < CACHE_TTL and _cache:
        return _cache

    result: dict[str, dict] = {}
    yahoo_keys = [k for k in (assets or YAHOO_MAP.keys()) if k in YAHOO_MAP]
    result.update(_fetch_yahoo_prices(yahoo_keys))
    result.update(_fetch_crypto_prices())

    if result:
        _cache      = result
        _last_fetch = now
        logger.info("Total prices fetched: %d assets", len(result))
    return _cache


# ---------------------------------------------------------------------------
# Daily history
# ---------------------------------------------------------------------------

def fetch_history(asset_key: str, days: int = 30) -> list[dict]:
    if asset_key in CRYPTO_IDS:
        return _fetch_crypto_history(asset_key, days)

    symbol = YAHOO_MAP.get(asset_key)
    if not symbol:
        return []

    range_map = {7: "1mo", 30: "3mo", 90: "6mo"}
    result = _yahoo_chart(symbol, "1d", range_map.get(days, "3mo"))
    if not result:
        return []

    try:
        timestamps = result.get("timestamp", [])
        quotes     = result["indicators"]["quote"][0]
        opens      = quotes.get("open",  [])
        highs      = quotes.get("high",  [])
        lows       = quotes.get("low",   [])
        closes     = quotes.get("close", [])
        rows = []
        for i, ts in enumerate(timestamps):
            try:
                c = closes[i]
                if c is None:
                    continue
                rows.append({
                    "date":  datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                    "open":  round(opens[i]  or c, 4),
                    "high":  round(highs[i]  or c, 4),
                    "low":   round(lows[i]   or c, 4),
                    "close": round(c, 4),
                })
            except Exception:
                continue
        return rows[-days:]
    except Exception as e:
        logger.debug("Yahoo history parse failed %s: %s", symbol, e)
        return []


def _fetch_crypto_history(asset_key: str, days: int) -> list[dict]:
    coin_id = CRYPTO_IDS.get(asset_key)
    if not coin_id:
        return []
    url = (
        f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
        f"?vs_currency=usd&days={days}&interval=daily"
    )
    try:
        r      = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        prices = r.json().get("prices", [])
        rows   = []
        for i, (ts, price) in enumerate(prices):
            date_str   = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            price      = round(price, 6)
            prev_price = round(prices[i - 1][1], 6) if i > 0 else price
            rows.append({
                "date":  date_str,
                "open":  prev_price,
                "high":  round(max(price, prev_price) * 1.001, 6),
                "low":   round(min(price, prev_price) * 0.999, 6),
                "close": price,
            })
        return rows[-days:]
    except Exception as e:
        logger.debug("CoinGecko history failed %s: %s", coin_id, e)
        return []


# ---------------------------------------------------------------------------
# Intraday
# ---------------------------------------------------------------------------

def fetch_intraday(asset_key: str, interval_minutes: int) -> list[dict]:
    if asset_key in CRYPTO_IDS:
        return _fetch_crypto_intraday(asset_key, interval_minutes)

    symbol = YAHOO_MAP.get(asset_key)
    if not symbol:
        return []

    yf_interval = {1: "1m", 5: "5m", 60: "60m"}.get(interval_minutes, "5m")
    limit        = {1: 120, 5: 96, 60: 48}.get(interval_minutes, 96)

    result = _yahoo_chart(symbol, yf_interval, "1d")
    if not result:
        return []

    try:
        timestamps = result.get("timestamp", [])
        quotes     = result["indicators"]["quote"][0]
        opens      = quotes.get("open",  [])
        highs      = quotes.get("high",  [])
        lows       = quotes.get("low",   [])
        closes     = quotes.get("close", [])
        rows = []
        for i, ts in enumerate(timestamps):
            try:
                c = closes[i]
                if c is None:
                    continue
                rows.append({
                    "date":  datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%H:%M"),
                    "open":  round(opens[i]  or c, 4),
                    "high":  round(highs[i]  or c, 4),
                    "low":   round(lows[i]   or c, 4),
                    "close": round(c, 4),
                })
            except Exception:
                continue
        return rows[-limit:]
    except Exception as e:
        logger.debug("Yahoo intraday parse failed %s: %s", symbol, e)
        return []


def _fetch_crypto_intraday(asset_key: str, interval_minutes: int) -> list[dict]:
    coin_id = CRYPTO_IDS.get(asset_key)
    if not coin_id:
        return []
    if interval_minutes >= 60:
        url   = (f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
                 f"?vs_currency=usd&days=2&interval=hourly")
        limit = 48
    else:
        url   = (f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
                 f"?vs_currency=usd&days=1")
        limit = 120 if interval_minutes == 1 else 96
    try:
        r      = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code != 200:
            return []
        prices = r.json().get("prices", [])
        rows   = []
        for i, (ts, price) in enumerate(prices):
            label      = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%H:%M")
            price      = round(price, 6)
            prev_price = round(prices[i - 1][1], 6) if i > 0 else price
            rows.append({
                "date":  label,
                "open":  prev_price,
                "high":  round(max(price, prev_price) * 1.001, 6),
                "low":   round(min(price, prev_price) * 0.999, 6),
                "close": price,
            })
        return rows[-limit:]
    except Exception as e:
        logger.debug("CoinGecko intraday failed %s: %s", coin_id, e)
        return []
