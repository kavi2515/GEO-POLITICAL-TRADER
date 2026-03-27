"""
Real-time price fetcher using yfinance (no API key required).
Prices are cached in memory and refreshed every 5 minutes.
"""
import logging
import time
from typing import Optional

import yfinance as yf

logger = logging.getLogger(__name__)

# Asset key → Yahoo Finance ticker
TICKER_MAP: dict[str, str] = {
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
    "JPY":              "USDJPY=X",
    "GBP":              "GBPUSD=X",
    "CHF":              "USDCHF=X",
    "CNY":              "USDCNY=X",
    "RUB":              "USDRUB=X",
    "TRY":              "USDTRY=X",
    "SPX500":           "^GSPC",
    "NASDAQ":           "^IXIC",
    "DAX":              "^GDAXI",
    "NIKKEI225":        "^N225",
    "FTSE100":          "^FTSE",
    "HSI":              "^HSI",
    "CRYPTO/BTC":       "BTC-USD",
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
}

# Cache: {asset_key: {price, change_pct, currency, updated_at}}
_cache: dict[str, dict] = {}
_last_fetch: float = 0
CACHE_TTL = 300  # 5 minutes


def _format_price(price: float, ticker: str) -> str:
    if price >= 10000:
        return f"{price:,.0f}"
    elif price >= 100:
        return f"{price:,.2f}"
    else:
        return f"{price:.4f}"


def fetch_prices(assets: Optional[list[str]] = None) -> dict[str, dict]:
    global _last_fetch, _cache

    now = time.time()
    if now - _last_fetch < CACHE_TTL and _cache:
        return _cache

    keys = assets or list(TICKER_MAP.keys())
    tickers_to_fetch = [TICKER_MAP[k] for k in keys if k in TICKER_MAP]

    if not tickers_to_fetch:
        return {}

    try:
        data = yf.download(
            tickers=tickers_to_fetch,
            period="2d",
            interval="1d",
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            threads=True,
        )

        result: dict[str, dict] = {}

        for asset_key in keys:
            ticker = TICKER_MAP.get(asset_key)
            if not ticker:
                continue
            try:
                if len(tickers_to_fetch) == 1:
                    df = data
                else:
                    df = data[ticker]

                if df is None or df.empty or len(df) < 1:
                    continue

                close = df["Close"].dropna()
                if len(close) < 1:
                    continue

                current = float(close.iloc[-1])
                prev = float(close.iloc[-2]) if len(close) >= 2 else current
                change_pct = ((current - prev) / prev * 100) if prev else 0

                result[asset_key] = {
                    "price": round(current, 4),
                    "change_pct": round(change_pct, 2),
                    "ticker": ticker,
                    "formatted": _format_price(current, ticker),
                }
            except Exception as e:
                logger.debug("Price fetch failed for %s (%s): %s", asset_key, ticker, e)

        if result:
            _cache = result
            _last_fetch = now
            logger.info("Fetched prices for %d assets", len(result))

    except Exception as e:
        logger.error("yfinance batch fetch failed: %s", e)

    return _cache
