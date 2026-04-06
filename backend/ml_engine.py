"""
ML Signal Engine — zero external API calls.
Converts NLP analysis output into structured buy/sell trading signals
with confidence scores and human-readable reasoning.
"""
from nlp_engine import EVENTS, COUNTRY_MARKETS


# Human-readable reasoning templates per event type
REASONING_TEMPLATES: dict[str, dict[str, str]] = {
    "military_conflict": {
        "OIL/BRENT":    "Military conflict near/involving oil-producing regions drives supply-risk premium",
        "OIL/WTI":      "Conflict-driven supply disruption fears push crude prices higher",
        "NATGAS":       "Geopolitical conflict raises energy supply uncertainty",
        "GOLD":         "Safe-haven demand surges as military conflict escalates",
        "SILVER":       "Silver follows gold as safe-haven metal during conflict",
        "USD":          "Flight to dollar safety during geopolitical crisis",
        "JPY":          "Yen strengthens as traditional safe-haven currency",
        "CHF":          "Swiss franc bid as global risk aversion rises",
        "EUR":          "Euro weakens on proximity risk and growth concerns",
        "SPX500":       "Equities sold off as risk appetite collapses",
        "NASDAQ":       "Tech stocks under pressure from escalating geopolitical risk",
        "DAX":          "European equities face direct exposure to regional conflict",
        "CRYPTO/BTC":   "Bitcoin treats as risk asset; sold in flight-to-safety move",
        "DEFENCE":      "Defence sector benefits from increased military spending expectations",
        "LMT":          "Lockheed Martin orders surge as nations increase defence budgets",
        "RTX":          "Raytheon missiles and systems in high demand during conflict escalation",
        "NOC":          "Northrop Grumman benefits from elevated military procurement",
        "BA":           "Boeing defence division benefits from wartime procurement cycles",
        "GD":           "General Dynamics armoured vehicles and systems see increased orders",
        "AAPL":         "Apple supply chains disrupted; consumer spending curtailed by conflict fears",
        "MSFT":         "Microsoft cloud demand resilient but defence contracts offset civilian slowdown",
        "CRYPTO/BTC":   "Bitcoin sold in risk-off flight to safety during military escalation",
        "CRYPTO/ETH":   "Ethereum network activity declines as risk appetite collapses",
    },
    "sanctions": {
        "USD":              "Sanctions force dollar-denominated settlements; USD demand rises",
        "GOLD":             "Sanctioned entities often increase gold holdings to bypass restrictions",
        "OIL/BRENT":        "Sanctions on oil exporters constrict global supply",
        "AFFECTED_CURRENCY": "Target nation's currency sold on capital flight and reduced trade",
        "EMERGING_MARKETS": "EM assets sold on risk-off contagion from sanctions",
    },
    "political_instability": {
        "GOLD":             "Safe-haven gold demand rises amid political uncertainty",
        "USD":              "Dollar benefits from flight to stability",
        "CHF":              "Swiss franc gains on global safe-haven flows",
        "LOCAL_CURRENCY":   "Domestic currency weakens on political risk premium",
        "EMERGING_MARKETS": "EM assets face broad sell-off on contagion fears",
        "CRYPTO/BTC":       "Crypto sold as risk-off sentiment dominates",
    },
    "trade_dispute": {
        "CNY":       "Yuan under pressure from trade war escalation",
        "EUR":       "Euro affected as EU faces retaliatory trade measures",
        "COPPER":    "Copper as global growth proxy sells off on trade friction",
        "SOYBEANS":  "Agricultural exports hit directly by trade barriers",
        "TECH":      "Technology sector vulnerable to semiconductor/IP trade restrictions",
        "USD":       "Dollar strengthens on relative safe-haven status",
        "GOLD":      "Gold bids as trade uncertainty erodes global growth outlook",
        "AAPL":      "Apple heavily exposed to China manufacturing and sales — tariffs bite hard",
        "NVDA":      "Nvidia chips face export restrictions to China; revenue at risk",
        "TSM":       "Taiwan Semiconductor in crosshairs of US-China tech decoupling",
        "ASML":      "ASML chip-making equipment export bans disrupt global semiconductor supply",
        "AMZN":      "Amazon e-commerce margins squeezed by import tariffs on goods",
        "QCOM":      "Qualcomm revenues at risk from China smartphone market restrictions",
        "INTC":      "Intel semiconductor sales to China threatened by export controls",
    },
    "energy_crisis": {
        "OIL/BRENT":  "Supply cut drives Brent crude prices sharply higher",
        "OIL/WTI":    "WTI crude rises on tightening global oil supply",
        "NATGAS":     "Natural gas prices surge on supply disruption fears",
        "USD":        "Petrodollar demand increases with higher oil prices",
        "AIRLINE":    "Airlines face severe margin compression from fuel cost spike",
        "TRANSPORT":  "Transport sector profitability hit by energy price surge",
        "PLASTICS":   "Petrochemical sector input costs rise sharply",
        "XOM":        "ExxonMobil revenues surge on elevated crude and gas prices",
        "CVX":        "Chevron upstream earnings jump as oil supply tightens",
        "COP":        "ConocoPhillips production assets gain significant value",
        "BP":         "BP upstream operations highly leveraged to oil price spikes",
        "SHEL":       "Shell benefits from LNG and crude price surge simultaneously",
        "TTE":        "TotalEnergies profits climb on integrated energy price exposure",
        "NEM":        "Newmont gold production costs rise but gold price follows energy",
    },
    "monetary_policy": {
        "USD":              "Rate hike expectations strengthen the dollar",
        "BONDS":            "Higher rates suppress bond prices",
        "GOLD":             "Rising real rates increase the opportunity cost of holding gold",
        "EMERGING_MARKETS": "EM currencies and assets under pressure from tighter dollar conditions",
        "REAL_ESTATE":      "Higher borrowing costs weigh on property valuations",
        "CRYPTO/BTC":       "Bitcoin reprices lower as tighter liquidity drains speculative positions",
        "CRYPTO/ETH":       "Ethereum DeFi activity contracts under high interest rate environment",
        "CRYPTO/SOL":       "Solana high-beta crypto sold as risk-off conditions tighten",
        "CRYPTO/DOGE":      "Speculative crypto assets fall sharply in risk-off rate environments",
        "MSFT":             "High-multiple growth stocks reprice lower as discount rate rises",
        "NVDA":             "AI valuation premium contracts under hawkish rate environment",
        "AMZN":             "Amazon growth stock multiple compresses on rising interest rates",
        "TSLA":             "Tesla high P/E valuation vulnerable to rising discount rates",
        "JPM":              "JPMorgan net interest margin expands on higher rates",
        "GS":               "Goldman Sachs trading revenues typically elevated during rate cycles",
        "BAC":              "Bank of America benefits from wider lending spreads on rate hikes",
    },
    "natural_disaster": {
        "INSURANCE":       "Insurance sector faces material claims from disaster",
        "LOCAL_CURRENCY":  "Affected nation's currency weakens on economic damage",
        "CONSTRUCTION":    "Rebuilding demand drives construction sector outperformance",
        "GOLD":            "Uncertainty drives modest safe-haven gold demand",
    },
    "diplomatic": {
        "GOLD":             "Reduced geopolitical risk lowers safe-haven gold demand",
        "OIL/BRENT":        "De-escalation removes conflict risk premium from oil",
        "SPX500":           "Equities rally on improved global stability outlook",
        "EUR":              "Euro bid on reduced European geopolitical risk",
        "EMERGING_MARKETS": "EM assets recover as global risk appetite returns",
        "AAPL":             "Apple supply chain risk eases; market access improves",
        "MSFT":             "Microsoft cloud and enterprise deals benefit from stable geopolitics",
        "TSM":              "Taiwan Semi supply chain risk relief drives stock recovery",
        "BABA":             "Alibaba rebounds on reduced US-China tension and regulatory clarity",
        "LMT":              "Lockheed Martin defence orders moderate as tensions ease",
        "CRYPTO/BTC":       "Bitcoin rallies as geopolitical risk premium unwinds and risk appetite returns",
        "CRYPTO/ETH":       "Ethereum DeFi and NFT activity rebounds on improved global sentiment",
        "CRYPTO/SOL":       "Solana high-beta crypto surges as risk-on sentiment returns",
    },
    "economic_data": {
        "USD":    "Strong economic data supports dollar demand",
        "SPX500": "Positive economic signals support equity valuations",
        "BONDS":  "Improved growth outlook shifts allocation from bonds to equities",
        "JPM":    "JPMorgan benefits from strong economic activity and loan growth",
        "GS":     "Goldman Sachs deal flow and M&A activity surge with economic confidence",
        "BAC":    "Bank of America consumer lending volumes grow with positive economic data",
        "AMZN":   "Amazon consumer spending and AWS cloud growth tied to economic health",
        "AAPL":   "Apple consumer device demand correlates with broader economic strength",
    },
    "sanctions": {
        "USD":               "Sanctions force dollar-denominated settlements; USD demand rises",
        "GOLD":              "Sanctioned entities often increase gold holdings to bypass restrictions",
        "OIL/BRENT":         "Sanctions on oil exporters constrict global supply",
        "AFFECTED_CURRENCY": "Target nation's currency sold on capital flight and reduced trade",
        "EMERGING_MARKETS":  "EM assets sold on risk-off contagion from sanctions",
        "BP":                "BP operations at risk if energy sanctions tighten on key producers",
        "SHEL":              "Shell forced to write down assets in sanctioned regions",
        "XOM":               "ExxonMobil exits or suspends operations in sanctioned territories",
        "CRYPTO/BTC":        "Bitcoin demand surges as sanctioned entities seek unblockable value transfer",
        "CRYPTO/ETH":        "Ethereum used to bypass SWIFT restrictions via DeFi protocols",
        "CRYPTO/XRP":        "XRP cross-border settlement demand rises as SWIFT access is cut",
        "CRYPTO/USDT":       "Stablecoin demand spikes in sanctioned regions as dollar access is restricted",
    },
}

# Asset display metadata
ASSET_META: dict[str, dict] = {
    "OIL/BRENT":      {"label": "Brent Crude",  "category": "Commodity"},
    "OIL/WTI":        {"label": "WTI Crude",    "category": "Commodity"},
    "NATGAS":         {"label": "Natural Gas",  "category": "Commodity"},
    "GOLD":           {"label": "Gold",         "category": "Commodity"},
    "SILVER":         {"label": "Silver",       "category": "Commodity"},
    "COPPER":         {"label": "Copper",       "category": "Commodity"},
    "WHEAT":          {"label": "Wheat",        "category": "Commodity"},
    "SOYBEANS":       {"label": "Soybeans",     "category": "Commodity"},
    "USD":            {"label": "USD",          "category": "Currency"},
    "EUR":            {"label": "EUR",          "category": "Currency"},
    "JPY":            {"label": "JPY",          "category": "Currency"},
    "GBP":            {"label": "GBP",          "category": "Currency"},
    "CHF":            {"label": "CHF",          "category": "Currency"},
    "CNY":            {"label": "CNY",          "category": "Currency"},
    "RUB":            {"label": "Russian Ruble",    "category": "Currency"},
    "TRY":            {"label": "Turkish Lira",    "category": "Currency"},
    "INR":            {"label": "Indian Rupee",    "category": "Currency"},
    "BRL":            {"label": "Brazilian Real",  "category": "Currency"},
    "ILS":            {"label": "Israeli Shekel",  "category": "Currency"},
    "KRW":            {"label": "Korean Won",      "category": "Currency"},
    "TWD":            {"label": "Taiwan Dollar",   "category": "Currency"},
    "PKR":            {"label": "Pakistani Rupee", "category": "Currency"},
    "SAR":            {"label": "Saudi Riyal",     "category": "Currency"},
    "UAH":            {"label": "Ukrainian Hryvnia","category": "Currency"},
    "SPX500":         {"label": "S&P 500",         "category": "Index"},
    "NASDAQ":         {"label": "NASDAQ",       "category": "Index"},
    "DAX":            {"label": "DAX",          "category": "Index"},
    "NIKKEI225":      {"label": "Nikkei 225",   "category": "Index"},
    "FTSE100":        {"label": "FTSE 100",     "category": "Index"},
    "HSI":            {"label": "Hang Seng",    "category": "Index"},
    "CRYPTO/BTC":     {"label": "Bitcoin",        "category": "Crypto"},
    "CRYPTO/ETH":     {"label": "Ethereum",       "category": "Crypto"},
    "CRYPTO/SOL":     {"label": "Solana",          "category": "Crypto"},
    "CRYPTO/XRP":     {"label": "XRP (Ripple)",    "category": "Crypto"},
    "CRYPTO/BNB":     {"label": "BNB (Binance)",   "category": "Crypto"},
    "CRYPTO/ADA":     {"label": "Cardano",          "category": "Crypto"},
    "CRYPTO/DOGE":    {"label": "Dogecoin",         "category": "Crypto"},
    "CRYPTO/AVAX":    {"label": "Avalanche",        "category": "Crypto"},
    "CRYPTO/LINK":    {"label": "Chainlink",        "category": "Crypto"},
    "CRYPTO/DOT":     {"label": "Polkadot",         "category": "Crypto"},
    "DEFENCE":        {"label": "Defence ETF",  "category": "Sector"},
    "TECH":           {"label": "Tech Sector",  "category": "Sector"},
    "AIRLINE":        {"label": "Airlines",     "category": "Sector"},
    "INSURANCE":      {"label": "Insurance",    "category": "Sector"},
    "CONSTRUCTION":   {"label": "Construction", "category": "Sector"},
    "TRANSPORT":      {"label": "Transport",    "category": "Sector"},
    "BONDS":          {"label": "US Bonds",     "category": "Fixed Income"},
    "EMERGING_MARKETS": {"label": "EM Assets",  "category": "Index"},
    "AFFECTED_CURRENCY": {"label": "Target Currency", "category": "Currency"},
    "LOCAL_CURRENCY": {"label": "Local Currency", "category": "Currency"},
    "REAL_ESTATE":    {"label": "Real Estate",    "category": "Sector"},
    "SEMICONDUCTORS": {"label": "Semiconductors", "category": "Sector"},
    "PLASTICS":       {"label": "Plastics/Petrochem","category": "Sector"},
    # US Tech — NASDAQ
    "AAPL":  {"label": "Apple",           "category": "Stock"},
    "MSFT":  {"label": "Microsoft",       "category": "Stock"},
    "NVDA":  {"label": "Nvidia",          "category": "Stock"},
    "GOOGL": {"label": "Alphabet (Google)","category": "Stock"},
    "AMZN":  {"label": "Amazon",          "category": "Stock"},
    "META":  {"label": "Meta",            "category": "Stock"},
    "TSLA":  {"label": "Tesla",           "category": "Stock"},
    "AMD":   {"label": "AMD",             "category": "Stock"},
    "INTC":  {"label": "Intel",           "category": "Stock"},
    "QCOM":  {"label": "Qualcomm",        "category": "Stock"},
    # US Defense — NYSE
    "LMT":   {"label": "Lockheed Martin", "category": "Stock"},
    "RTX":   {"label": "Raytheon",        "category": "Stock"},
    "NOC":   {"label": "Northrop Grumman","category": "Stock"},
    "BA":    {"label": "Boeing",          "category": "Stock"},
    "GD":    {"label": "General Dynamics","category": "Stock"},
    # US Energy — NYSE
    "XOM":   {"label": "ExxonMobil",      "category": "Stock"},
    "CVX":   {"label": "Chevron",         "category": "Stock"},
    "COP":   {"label": "ConocoPhillips",  "category": "Stock"},
    # US Finance — NYSE
    "JPM":   {"label": "JPMorgan Chase",  "category": "Stock"},
    "GS":    {"label": "Goldman Sachs",   "category": "Stock"},
    "BAC":   {"label": "Bank of America", "category": "Stock"},
    # US Healthcare — NYSE
    "JNJ":   {"label": "Johnson & Johnson","category": "Stock"},
    "PFE":   {"label": "Pfizer",           "category": "Stock"},
    # US Mining — NYSE
    "NEM":   {"label": "Newmont (Gold)",  "category": "Stock"},
    "FCX":   {"label": "Freeport-McMoRan","category": "Stock"},
    # Global — listed as US ADRs / NASDAQ
    "TSM":   {"label": "Taiwan Semi (TSM)","category": "Stock"},
    "BABA":  {"label": "Alibaba",          "category": "Stock"},
    "ASML":  {"label": "ASML Holding",     "category": "Stock"},
    "SAP":   {"label": "SAP SE",           "category": "Stock"},
    "BP":    {"label": "BP Plc",           "category": "Stock"},
    "SHEL":  {"label": "Shell",            "category": "Stock"},
    "TTE":   {"label": "TotalEnergies",    "category": "Stock"},
    "TM":    {"label": "Toyota",           "category": "Stock"},
    "RIO":   {"label": "Rio Tinto",        "category": "Stock"},
    "BHP":   {"label": "BHP Group",        "category": "Stock"},
    "CHKP":  {"label": "Check Point Software","category": "Stock"},
    "INFY":  {"label": "Infosys",          "category": "Stock"},
}


class SignalEngine:
    """Generates structured market signals from NLP analysis output."""

    def generate_signals(self, nlp_result: dict, title: str = "") -> list[dict]:
        event_type = nlp_result.get("event_type", "general")
        event_data = EVENTS.get(event_type)
        entities = nlp_result.get("entities", [])
        sentiment = nlp_result.get("sentiment", 0)
        severity_score = nlp_result.get("severity_score", 0.3)

        if not event_data:
            return []

        # Build unified impact map: merge base event impacts + entity-specific impacts
        impact_map: dict[str, str] = dict(event_data.get("market_impacts", {}))
        self._apply_entity_impacts(impact_map, entities, event_type)

        signals = []
        reasoning_map = REASONING_TEMPLATES.get(event_type, {})

        for asset, direction in impact_map.items():
            if direction == "variable":
                direction = "BUY" if sentiment >= 0 else "SELL"

            confidence = self._confidence(severity_score, sentiment, direction)
            if confidence < 40:
                continue  # skip low-confidence noise

            meta = ASSET_META.get(asset, {"label": asset, "category": "Other"})
            reasoning = reasoning_map.get(asset, f"Geopolitical event influences {meta['label']}")

            signals.append({
                "asset": asset,
                "asset_label": meta["label"],
                "category": meta["category"],
                "signal": direction,
                "confidence": confidence,
                "reasoning": reasoning,
            })

        # Sort: highest confidence first
        signals.sort(key=lambda s: s["confidence"], reverse=True)
        return signals[:12]  # cap at 12 signals per article

    # ------------------------------------------------------------------

    def _apply_entity_impacts(
        self, impact_map: dict, entities: list[str], event_type: str
    ) -> None:
        """Add/override impact map entries based on mentioned countries."""
        for entity in entities:
            key = entity.lower()
            if key not in COUNTRY_MARKETS:
                continue
            mkt = COUNTRY_MARKETS[key]

            currency = mkt.get("currency")
            if currency and currency not in impact_map:
                if event_type in {"military_conflict", "political_instability", "natural_disaster"}:
                    impact_map[currency] = "SELL"
                elif event_type == "diplomatic":
                    impact_map[currency] = "BUY"

            for commodity in mkt.get("commodities", []):
                if commodity not in impact_map:
                    if event_type in {"military_conflict", "energy_crisis"}:
                        impact_map[commodity] = "BUY"

            for index in mkt.get("indices", []):
                if index not in impact_map:
                    if event_type in {"military_conflict", "political_instability"}:
                        impact_map[index] = "SELL"

            for stock in mkt.get("stocks", []):
                if stock not in impact_map:
                    if event_type in {"military_conflict", "political_instability", "sanctions"}:
                        impact_map[stock] = "SELL"
                    elif event_type == "diplomatic":
                        impact_map[stock] = "BUY"
                    elif event_type == "trade_dispute":
                        impact_map[stock] = "SELL"
                    elif event_type in {"energy_crisis"} and stock in {"XOM","CVX","COP","BP","SHEL","TTE"}:
                        impact_map[stock] = "BUY"

            if mkt.get("safe_haven"):
                impact_map.setdefault("GOLD", "BUY")
                impact_map.setdefault("JPY", "BUY")

    def _confidence(self, severity: float, sentiment: float, direction: str) -> int:
        """
        Confidence formula:
          - Severity contributes 60 % of the score
          - Sentiment alignment contributes 25 %
          - A small base of 15 % ensures we never go below ~15
        """
        base = 15
        severity_contrib = severity * 60
        # sentiment alignment: negative sentiment → SELL signals get a boost; positive → BUY
        if direction == "SELL":
            alignment = max(0, -sentiment) * 25
        else:
            alignment = max(0, sentiment) * 25

        raw = base + severity_contrib + alignment
        return min(int(round(raw)), 95)
