"""
Local NLP engine — zero external API calls.
Uses keyword matching, financial lexicon sentiment scoring, and rule-based
geopolitical event classification to produce structured analysis.
"""
import re
from typing import Optional

# ---------------------------------------------------------------------------
# Geopolitical event taxonomy with market impact rules
# ---------------------------------------------------------------------------

EVENTS: dict[str, dict] = {
    "military_conflict": {
        "label": "Military Conflict",
        "keywords": [
            "war", "airstrike", "invasion", "troops", "offensive", "missile",
            "bomb", "attack", "combat", "battle", "military strike", "explosion",
            "assassination", "artillery", "drone strike", "naval", "ceasefire violated",
            "escalation", "frontline", "casualt", "airspace", "warship",
        ],
        "market_impacts": {
            "OIL/BRENT": "BUY",
            "OIL/WTI": "BUY",
            "NATGAS": "BUY",
            "GOLD": "BUY",
            "SILVER": "BUY",
            "USD": "BUY",
            "JPY": "BUY",
            "CHF": "BUY",
            "EUR": "SELL",
            "SPX500": "SELL",
            "NASDAQ": "SELL",
            "DAX": "SELL",
            "CRYPTO/BTC": "SELL",
            "DEFENCE": "BUY",
        },
        "severity_base": 0.88,
        "color": "#ef4444",
    },
    "sanctions": {
        "label": "Sanctions / Embargo",
        "keywords": [
            "sanctions", "embargo", "trade ban", "asset freeze", "blacklist",
            "economic penalty", "export restriction", "import ban", "restricted entities",
            "blocked", "prohibited trade", "financial sanctions",
        ],
        "market_impacts": {
            "USD": "BUY",
            "GOLD": "BUY",
            "OIL/BRENT": "BUY",
            "AFFECTED_CURRENCY": "SELL",
            "EMERGING_MARKETS": "SELL",
        },
        "severity_base": 0.72,
        "color": "#f97316",
    },
    "political_instability": {
        "label": "Political Instability",
        "keywords": [
            "coup", "uprising", "protest", "government collapse", "impeachment",
            "civil unrest", "riot", "election fraud", "political crisis",
            "resignation", "parliament dissolved", "martial law", "state of emergency",
        ],
        "market_impacts": {
            "GOLD": "BUY",
            "USD": "BUY",
            "CHF": "BUY",
            "LOCAL_CURRENCY": "SELL",
            "EMERGING_MARKETS": "SELL",
            "CRYPTO/BTC": "SELL",
        },
        "severity_base": 0.65,
        "color": "#a855f7",
    },
    "trade_dispute": {
        "label": "Trade Dispute",
        "keywords": [
            "tariff", "trade war", "trade dispute", "import duty", "export ban",
            "trade restriction", "customs barrier", "protectionism", "trade retaliation",
            "wto dispute", "supply chain disruption", "decoupling",
        ],
        "market_impacts": {
            "CNY": "SELL",
            "EUR": "SELL",
            "COPPER": "SELL",
            "SOYBEANS": "SELL",
            "TECH": "SELL",
            "USD": "BUY",
            "GOLD": "BUY",
        },
        "severity_base": 0.62,
        "color": "#eab308",
    },
    "energy_crisis": {
        "label": "Energy Crisis",
        "keywords": [
            "opec", "oil cut", "energy crisis", "pipeline attack", "gas shortage",
            "oil supply", "oil production cut", "energy shortage", "power outage",
            "liquefied natural gas", "lng terminal", "refinery", "oil field",
        ],
        "market_impacts": {
            "OIL/BRENT": "BUY",
            "OIL/WTI": "BUY",
            "NATGAS": "BUY",
            "USD": "BUY",
            "AIRLINE": "SELL",
            "TRANSPORT": "SELL",
            "PLASTICS": "SELL",
        },
        "severity_base": 0.70,
        "color": "#f59e0b",
    },
    "monetary_policy": {
        "label": "Monetary Policy",
        "keywords": [
            "interest rate", "federal reserve", "central bank", "rate hike",
            "rate cut", "quantitative easing", "quantitative tightening", "inflation",
            "monetary policy", "fed funds", "ecb", "boe", "boj", "tightening",
            "hawkish", "dovish", "basis points",
        ],
        "market_impacts": {
            "USD": "BUY",
            "BONDS": "SELL",
            "GOLD": "SELL",
            "EMERGING_MARKETS": "SELL",
            "REAL_ESTATE": "SELL",
        },
        "severity_base": 0.58,
        "color": "#06b6d4",
    },
    "natural_disaster": {
        "label": "Natural Disaster",
        "keywords": [
            "earthquake", "tsunami", "hurricane", "typhoon", "cyclone", "flood",
            "volcanic eruption", "wildfire", "drought", "famine",
            "natural disaster", "catastrophic",
        ],
        "market_impacts": {
            "INSURANCE": "SELL",
            "LOCAL_CURRENCY": "SELL",
            "CONSTRUCTION": "BUY",
            "GOLD": "BUY",
        },
        "severity_base": 0.55,
        "color": "#6366f1",
    },
    "diplomatic": {
        "label": "Diplomatic Development",
        "keywords": [
            "peace deal", "ceasefire", "peace talks", "treaty", "diplomatic",
            "summit", "agreement", "normalization", "thaw", "negotiate",
            "bilateral", "accord", "memorandum of understanding",
        ],
        "market_impacts": {
            "GOLD": "SELL",
            "OIL/BRENT": "SELL",
            "SPX500": "BUY",
            "EUR": "BUY",
            "EMERGING_MARKETS": "BUY",
        },
        "severity_base": 0.48,
        "color": "#22c55e",
    },
    "economic_data": {
        "label": "Economic Data",
        "keywords": [
            "gdp", "unemployment", "jobs report", "nonfarm payroll", "cpi", "ppi",
            "consumer confidence", "manufacturing pmi", "retail sales", "trade balance",
            "current account", "fiscal deficit", "debt ceiling",
        ],
        "market_impacts": {
            "USD": "BUY",
            "SPX500": "BUY",
            "BONDS": "SELL",
        },
        "severity_base": 0.45,
        "color": "#3b82f6",
    },
}

# ---------------------------------------------------------------------------
# Country / region → market mapping
# ---------------------------------------------------------------------------

COUNTRY_MARKETS: dict[str, dict] = {
    "russia": {"currency": "RUB", "commodities": ["OIL/BRENT", "NATGAS", "WHEAT"]},
    "ukraine": {"currency": "UAH", "commodities": ["WHEAT", "CORN"]},
    "china": {"currency": "CNY", "indices": ["CSI300", "HSI"], "commodities": ["COPPER", "IRON_ORE"]},
    "united states": {"currency": "USD", "indices": ["SPX500", "NASDAQ", "DOW"]},
    "usa": {"currency": "USD", "indices": ["SPX500", "NASDAQ", "DOW"]},
    "america": {"currency": "USD", "indices": ["SPX500", "NASDAQ"]},
    "iran": {"commodities": ["OIL/BRENT"], "currency": "IRR"},
    "saudi arabia": {"currency": "SAR", "commodities": ["OIL/BRENT", "OIL/WTI"]},
    "opec": {"commodities": ["OIL/BRENT", "OIL/WTI"]},
    "europe": {"currency": "EUR", "indices": ["DAX", "CAC40", "FTSE100"]},
    "european union": {"currency": "EUR", "indices": ["DAX", "CAC40"]},
    "japan": {"currency": "JPY", "indices": ["NIKKEI225"]},
    "uk": {"currency": "GBP", "indices": ["FTSE100"]},
    "united kingdom": {"currency": "GBP", "indices": ["FTSE100"]},
    "india": {"currency": "INR", "indices": ["SENSEX", "NIFTY50"]},
    "brazil": {"currency": "BRL", "commodities": ["SOYBEANS", "IRON_ORE", "COFFEE"]},
    "turkey": {"currency": "TRY"},
    "israel": {"currency": "ILS", "commodities": ["OIL/BRENT"]},
    "north korea": {"safe_haven": True},
    "venezuela": {"commodities": ["OIL/BRENT"], "currency": "VES"},
    "middle east": {"commodities": ["OIL/BRENT", "OIL/WTI"]},
    "taiwan": {"currency": "TWD", "tech": ["SEMICONDUCTORS", "TECH"]},
    "south korea": {"currency": "KRW", "indices": ["KOSPI"]},
    "germany": {"currency": "EUR", "indices": ["DAX"]},
    "france": {"currency": "EUR", "indices": ["CAC40"]},
    "pakistan": {"currency": "PKR"},
    "afghanistan": {"safe_haven": True},
    "africa": {"commodities": ["GOLD", "COPPER", "PLATINUM"]},
    "latin america": {"commodities": ["SOYBEANS", "COPPER", "OIL/BRENT"]},
}

# ---------------------------------------------------------------------------
# Financial sentiment lexicons
# ---------------------------------------------------------------------------

POSITIVE_TERMS = {
    "rally", "surge", "rise", "gain", "profit", "boom", "recovery", "growth",
    "bullish", "expand", "rebound", "upside", "optimism", "positive", "strong",
    "record high", "outperform", "upgrade", "stimulus", "easing", "de-escalat",
    "resolve", "stabilise", "stabilize", "peace", "ceasefire", "deal", "agreement",
    "cooperation", "alliance", "summit", "breakthrough", "progress",
}

NEGATIVE_TERMS = {
    "crash", "plunge", "fall", "drop", "loss", "recession", "crisis", "bearish",
    "decline", "collapse", "default", "panic", "uncertainty", "risk", "threat",
    "concern", "fear", "warning", "volatile", "turmoil", "instability", "tension",
    "conflict", "war", "attack", "explosion", "assassin", "coup", "sanction",
    "embargo", "retaliation", "escalat", "aggression", "protest", "unrest",
    "downgrade", "tighten", "hawkish", "inflation surge",
}

SEVERITY_AMPLIFIERS = {
    "major", "massive", "unprecedented", "catastrophic", "historic", "critical",
    "emergency", "imminent", "immediate", "severe", "extreme", "dangerous",
}


# ---------------------------------------------------------------------------
# NLP Engine
# ---------------------------------------------------------------------------

class GeopoliticalNLP:
    """Zero-API-call NLP pipeline for geopolitical news analysis."""

    def analyze(self, title: str, summary: str = "") -> dict:
        text = f"{title} {summary}".lower()
        text_clean = re.sub(r"[^\w\s]", " ", text)

        event_type, event_data = self._classify_event(text_clean)
        entities = self._extract_entities(text_clean)
        sentiment = self._score_sentiment(text_clean)
        severity_score = self._calculate_severity(text_clean, event_data, sentiment)
        severity_label = self._severity_label(severity_score)

        return {
            "event_type": event_type,
            "event_label": event_data["label"] if event_data else "General News",
            "event_color": event_data["color"] if event_data else "#64748b",
            "entities": entities,
            "sentiment": round(sentiment, 3),
            "severity_score": round(severity_score, 3),
            "severity": severity_label,
        }

    # ------------------------------------------------------------------

    def _classify_event(self, text: str) -> tuple[str, Optional[dict]]:
        best_event = None
        best_score = 0

        for event_type, data in EVENTS.items():
            score = sum(1 for kw in data["keywords"] if kw in text)
            if score > best_score:
                best_score = score
                best_event = event_type

        if best_event and best_score >= 1:
            return best_event, EVENTS[best_event]
        return "general", None

    def _extract_entities(self, text: str) -> list[str]:
        found = []
        for country in COUNTRY_MARKETS:
            if country in text:
                found.append(country.title())
        # deduplicate while preserving order
        seen = set()
        result = []
        for e in found:
            if e.lower() not in seen:
                seen.add(e.lower())
                result.append(e)
        return result[:6]  # cap at 6 entities

    def _score_sentiment(self, text: str) -> float:
        pos = sum(1 for t in POSITIVE_TERMS if t in text)
        neg = sum(1 for t in NEGATIVE_TERMS if t in text)
        total = pos + neg
        if total == 0:
            return -0.1  # slight negative bias for geopolitical news
        return round((pos - neg) / total, 3)

    def _calculate_severity(self, text: str, event_data: Optional[dict], sentiment: float) -> float:
        base = event_data["severity_base"] if event_data else 0.3
        amplifier = sum(0.05 for amp in SEVERITY_AMPLIFIERS if amp in text)
        sentiment_push = abs(sentiment) * 0.15
        return min(base + amplifier + sentiment_push, 0.98)

    @staticmethod
    def _severity_label(score: float) -> str:
        if score >= 0.80:
            return "CRITICAL"
        if score >= 0.65:
            return "HIGH"
        if score >= 0.45:
            return "MEDIUM"
        return "LOW"
