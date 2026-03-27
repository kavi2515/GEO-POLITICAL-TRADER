"""
Asynchronous RSS feed fetcher.
Pulls from multiple international news sources; no paid API required.
"""
import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

import aiohttp
import feedparser
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    # Global news
    {"name": "Reuters",           "url": "https://feeds.reuters.com/reuters/worldNews"},
    {"name": "BBC World",         "url": "http://feeds.bbci.co.uk/news/world/rss.xml"},
    {"name": "Al Jazeera",        "url": "https://www.aljazeera.com/xml/rss/all.xml"},
    {"name": "The Guardian",      "url": "https://www.theguardian.com/world/rss"},
    {"name": "AP News",           "url": "https://rsshub.app/apnews/topics/apf-worldnews"},
    {"name": "DW News",           "url": "https://rss.dw.com/rdf/rss-en-world"},
    {"name": "France 24",         "url": "https://www.france24.com/en/rss"},
    {"name": "South China Morning Post", "url": "https://www.scmp.com/rss/91/feed"},
    {"name": "The Hindu",         "url": "https://www.thehindu.com/news/international/?service=rss"},
    {"name": "ABC News",          "url": "https://feeds.abcnews.com/abcnews/internationalheadlines"},
    {"name": "NPR World",         "url": "https://feeds.npr.org/1004/rss.xml"},
    # Finance & markets
    {"name": "CNBC",              "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html"},
    {"name": "MarketWatch",       "url": "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines"},
    {"name": "Financial Times",   "url": "https://www.ft.com/rss/home/uk"},
    {"name": "Bloomberg Markets", "url": "https://feeds.bloomberg.com/markets/news.rss"},
    {"name": "Investing.com",     "url": "https://www.investing.com/rss/news.rss"},
    {"name": "Seeking Alpha",     "url": "https://seekingalpha.com/market_currents.xml"},
    # Geopolitics & defence
    {"name": "Foreign Policy",    "url": "https://foreignpolicy.com/feed/"},
    {"name": "Defense News",      "url": "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml"},
    {"name": "The Diplomat",      "url": "https://thediplomat.com/feed/"},
    {"name": "War on the Rocks",  "url": "https://warontherocks.com/feed/"},
    # Energy & commodities
    {"name": "Oil Price",         "url": "https://oilprice.com/rss/main"},
    {"name": "Reuters Commodities","url": "https://feeds.reuters.com/reuters/companyNews"},
]

TIMEOUT = aiohttp.ClientTimeout(total=15)
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; GeopoliticalTrader/1.0)"}


def _stable_id(url: str, title: str) -> str:
    key = f"{url}:{title}"
    return hashlib.md5(key.encode()).hexdigest()


def _parse_date(entry) -> datetime:
    for attr in ("published", "updated", "created"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                return dateparser.parse(raw).astimezone(timezone.utc).replace(tzinfo=None)
            except Exception:
                pass
    return datetime.utcnow()


async def _fetch_feed(session: aiohttp.ClientSession, source: dict) -> list[dict]:
    try:
        async with session.get(source["url"], headers=HEADERS, timeout=TIMEOUT) as resp:
            if resp.status != 200:
                logger.warning("Feed %s returned HTTP %s", source["name"], resp.status)
                return []
            raw = await resp.text(errors="replace")
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", source["name"], exc)
        return []

    feed = feedparser.parse(raw)
    articles = []
    for entry in feed.entries[:20]:
        title = getattr(entry, "title", "").strip()
        summary = getattr(entry, "summary", "").strip()
        url = getattr(entry, "link", "")

        if not title:
            continue

        # Strip HTML from summary
        summary = _strip_html(summary)

        articles.append({
            "id": _stable_id(url, title),
            "title": title,
            "summary": summary[:600],
            "url": url,
            "source": source["name"],
            "published_at": _parse_date(entry),
        })

    return articles


def _strip_html(text: str) -> str:
    import re
    clean = re.sub(r"<[^>]+>", "", text)
    return clean.strip()


async def fetch_all_feeds() -> list[dict]:
    async with aiohttp.ClientSession() as session:
        tasks = [_fetch_feed(session, src) for src in RSS_FEEDS]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    articles = []
    seen_ids = set()
    for batch in results:
        if isinstance(batch, Exception):
            continue
        for article in batch:
            if article["id"] not in seen_ids:
                seen_ids.add(article["id"])
                articles.append(article)

    articles.sort(key=lambda a: a["published_at"], reverse=True)
    logger.info("Fetched %d unique articles from %d feeds", len(articles), len(RSS_FEEDS))
    return articles