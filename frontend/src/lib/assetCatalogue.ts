/**
 * Full asset catalogue — mirrors backend YAHOO_MAP + CRYPTO_IDS.
 * Used to show all assets in Live Markets even without signals.
 */
export interface AssetMeta {
  label: string;
  category: string;
}

export const ASSET_CATALOGUE: Record<string, AssetMeta> = {
  // Commodities
  "OIL/BRENT":        { label: "Brent Crude",        category: "Commodity" },
  "OIL/WTI":          { label: "WTI Crude",           category: "Commodity" },
  "NATGAS":           { label: "Natural Gas",          category: "Commodity" },
  "GOLD":             { label: "Gold",                 category: "Commodity" },
  "SILVER":           { label: "Silver",               category: "Commodity" },
  "COPPER":           { label: "Copper",               category: "Commodity" },
  "WHEAT":            { label: "Wheat",                category: "Commodity" },
  "SOYBEANS":         { label: "Soybeans",             category: "Commodity" },

  // Currencies
  "USD":              { label: "US Dollar Index",      category: "Currency" },
  "EUR":              { label: "EUR/USD",              category: "Currency" },
  "JPY":              { label: "USD/JPY",              category: "Currency" },
  "GBP":              { label: "GBP/USD",              category: "Currency" },
  "CHF":              { label: "USD/CHF",              category: "Currency" },
  "CNY":              { label: "USD/CNY",              category: "Currency" },
  "RUB":              { label: "USD/RUB",              category: "Currency" },
  "TRY":              { label: "USD/TRY",              category: "Currency" },
  "INR":              { label: "USD/INR",              category: "Currency" },
  "BRL":              { label: "USD/BRL",              category: "Currency" },
  "ILS":              { label: "USD/ILS",              category: "Currency" },
  "KRW":              { label: "USD/KRW",              category: "Currency" },
  "TWD":              { label: "USD/TWD",              category: "Currency" },
  "PKR":              { label: "USD/PKR",              category: "Currency" },
  "SAR":              { label: "USD/SAR",              category: "Currency" },
  "UAH":              { label: "USD/UAH",              category: "Currency" },

  // Indices
  "SPX500":           { label: "S&P 500",              category: "Index" },
  "NASDAQ":           { label: "NASDAQ",               category: "Index" },
  "DAX":              { label: "DAX",                  category: "Index" },
  "NIKKEI225":        { label: "Nikkei 225",           category: "Index" },
  "FTSE100":          { label: "FTSE 100",             category: "Index" },
  "HSI":              { label: "Hang Seng",            category: "Index" },

  // Sector ETFs
  "DEFENCE":          { label: "Defence ETF",          category: "Sector" },
  "TECH":             { label: "Technology ETF",       category: "Sector" },
  "AIRLINE":          { label: "Airlines ETF",         category: "Sector" },
  "INSURANCE":        { label: "Insurance ETF",        category: "Sector" },
  "CONSTRUCTION":     { label: "Construction ETF",     category: "Sector" },
  "TRANSPORT":        { label: "Transport ETF",        category: "Sector" },
  "BONDS":            { label: "US Treasury Bonds",    category: "Fixed Income" },
  "EMERGING_MARKETS": { label: "Emerging Markets ETF", category: "Sector" },
  "REAL_ESTATE":      { label: "Real Estate ETF",      category: "Sector" },
  "SEMICONDUCTORS":   { label: "Semiconductors ETF",   category: "Sector" },

  // US Tech
  "AAPL":  { label: "Apple",           category: "Stock" },
  "MSFT":  { label: "Microsoft",       category: "Stock" },
  "NVDA":  { label: "Nvidia",          category: "Stock" },
  "GOOGL": { label: "Alphabet",        category: "Stock" },
  "AMZN":  { label: "Amazon",          category: "Stock" },
  "META":  { label: "Meta",            category: "Stock" },
  "TSLA":  { label: "Tesla",           category: "Stock" },
  "AMD":   { label: "AMD",             category: "Stock" },
  "INTC":  { label: "Intel",           category: "Stock" },
  "QCOM":  { label: "Qualcomm",        category: "Stock" },

  // Defence
  "LMT":   { label: "Lockheed Martin", category: "Stock" },
  "RTX":   { label: "Raytheon",        category: "Stock" },
  "NOC":   { label: "Northrop Grumman",category: "Stock" },
  "BA":    { label: "Boeing",          category: "Stock" },
  "GD":    { label: "General Dynamics",category: "Stock" },

  // Energy
  "XOM":   { label: "ExxonMobil",      category: "Stock" },
  "CVX":   { label: "Chevron",         category: "Stock" },
  "COP":   { label: "ConocoPhillips",  category: "Stock" },
  "BP":    { label: "BP",              category: "Stock" },
  "SHEL":  { label: "Shell",           category: "Stock" },
  "TTE":   { label: "TotalEnergies",   category: "Stock" },

  // Finance
  "JPM":   { label: "JPMorgan Chase",  category: "Stock" },
  "GS":    { label: "Goldman Sachs",   category: "Stock" },
  "BAC":   { label: "Bank of America", category: "Stock" },

  // Healthcare
  "JNJ":   { label: "Johnson & Johnson", category: "Stock" },
  "PFE":   { label: "Pfizer",          category: "Stock" },

  // Mining
  "NEM":   { label: "Newmont Mining",  category: "Stock" },
  "FCX":   { label: "Freeport-McMoRan",category: "Stock" },
  "RIO":   { label: "Rio Tinto",       category: "Stock" },
  "BHP":   { label: "BHP Group",       category: "Stock" },

  // International
  "TSM":   { label: "TSMC",            category: "Stock" },
  "BABA":  { label: "Alibaba",         category: "Stock" },
  "ASML":  { label: "ASML",           category: "Stock" },
  "SAP":   { label: "SAP",             category: "Stock" },
  "TM":    { label: "Toyota",          category: "Stock" },
  "CHKP":  { label: "Check Point",     category: "Stock" },
  "INFY":  { label: "Infosys",         category: "Stock" },

  // Crypto
  "CRYPTO/BTC":  { label: "Bitcoin",   category: "Crypto" },
  "CRYPTO/ETH":  { label: "Ethereum",  category: "Crypto" },
  "CRYPTO/SOL":  { label: "Solana",    category: "Crypto" },
  "CRYPTO/XRP":  { label: "XRP",       category: "Crypto" },
  "CRYPTO/BNB":  { label: "BNB",       category: "Crypto" },
  "CRYPTO/ADA":  { label: "Cardano",   category: "Crypto" },
  "CRYPTO/DOGE": { label: "Dogecoin",  category: "Crypto" },
  "CRYPTO/AVAX": { label: "Avalanche", category: "Crypto" },
  "CRYPTO/LINK": { label: "Chainlink", category: "Crypto" },
  "CRYPTO/DOT":  { label: "Polkadot",  category: "Crypto" },
};
