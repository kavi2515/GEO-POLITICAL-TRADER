"""
Real-time price fetcher using Stooq (free, no API key, works on AWS).
Prices are cached in memory and refreshed every 5 minutes.
"""
import logging
import time
import csv
import io
import requests

logger = logging.getLogger(__name__)

# Asset key → Stooq symbol
TICKER_MAP: dict[str, str] = {
    "OIL/BRENT":        "BRENUSD",
    "OIL/WTI":          "OILUSD",
    "NATGAS":           "NGAS.F",
    "GOLD":             "XAUUSD",
    "SILVER":           "XAGUSD",
    "COPPER":           "HGUSD",
    "WHEAT":            "ZW.F",
    "SOYBEANS":         "ZS.F",
    "USD":              "DXY",
    "EUR":              "EURUSD",
    "JPY":              "USDJPY",
    "GBP":              "GBPUSD",
    "CHF":              "USDCHF",
    "CNY":              "USDCNY",
    "RUB":              "USDRUB",
    "TRY":              "USDTRY",
    "SPX500":           "^SPX",
    "NASDAQ":           "^NDQ",
    "DAX":              "^DAX",
    "NIKKEI225":        "^NKX",
    "FTSE100":          "^FTX",
    "HSI":              "^HSI",
    "CRYPTO/BTC":       "BTCUSD",
    "DEFENCE":          "ITA.US",
    "TECH":             "XLK.US",
    "AIRLINE":          "JETS.US",
    "INSURANCE":        "IAK.US",
    "CONSTRUCTION":     "ITB.US",
    "TRANSPORT":        "IYT.US",
    "BONDS":            "TLT.US",
    "EMERGING_MARKETS": "EEM.US",
    "REAL_ESTATE":      "VNQ.US",
    "SEMICONDUCTORS":   "SOXX.US",
}

_cache: dict[str, dict] = {}
_last_fetch: float = 0
CACHE_TTL = 300  # 5 minutes

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def _fetch_single(symbol: str) -> dict | None:
    url = f"https://stooq.com/q/l/?s={symbol}&f=sd2t2ohlcv&h&e=csv"
    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        if r.status_code != 200 or not r.text.strip():
            return None
        reader = csv.DictReader(io.StringIO(r.text))
        rows = list(reader)
        if not rows:
            return None
        row = rows[0]
        close = float(row.get("Close", 0) or 0)
        open_ = float(row.get("Open", close) or close)
        if close <= 0:
            return None
        change_pct = ((close - open_) / open_ * 100) if open_ else 0
        return {
            "price": round(close, 4),
            "change_pct": round(change_pct, 2),
            "ticker": symbol,
            "formatted": _format(close),
        }
    except Exception as e:
        logger.debug("Stooq fetch failed for %s: %s", symbol, e)
        return None


def _format(price: float) -> str:
    if price >= 10000:
        return f"{price:,.0f}"
    elif price >= 100:
        return f"{price:,.2f}"
    elif price >= 1:
        return f"{price:.4f}"
    else:
        return f"{price:.6f}"


def fetch_prices(assets: list[str] | None = None) -> dict[str, dict]:
    global _last_fetch, _cache

    now = time.time()
    if now - _last_fetch < CACHE_TTL and _cache:
        return _cache

    keys = assets or list(TICKER_MAP.keys())
    result: dict[str, dict] = {}

    for asset_key in keys:
        symbol = TICKER_MAP.get(asset_key)
        if not symbol:
            continue
        data = _fetch_single(symbol)
        if data:
            result[asset_key] = data

    if result:
        _cache = result
        _last_fetch = now
        logger.info("Fetched prices for %d/%d assets", len(result), len(keys))
    else:
        logger.warning("No prices fetched from Stooq")

    return _cache
