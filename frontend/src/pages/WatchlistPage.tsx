import { useEffect, useState } from "react";
import StockDetailModal, { type StockDetailAsset } from "../components/StockDetailModal";

interface WatchlistItem {
  id: string;
  asset: string;
  asset_label: string;
  category: string;
  created_at: string;
}

interface WatchlistSignal {
  id: string;
  news_title: string;
  news_url: string;
  source: string;
  published_at: string;
  severity: string;
  event_label: string;
  market_signals: { asset: string; asset_label: string; signal: string; confidence: number; reasoning: string }[];
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-400/30",
  HIGH:     "text-orange-400 border-orange-400/30",
  MEDIUM:   "text-yellow-400 border-yellow-400/30",
  LOW:      "text-terminal-dim border-terminal-border",
};

const API_CATEGORIES: Record<string, string[]> = {
  "COMMODITIES": ["OIL/BRENT","OIL/WTI","NATGAS","GOLD","SILVER","COPPER","WHEAT","SOYBEANS"],
  "CURRENCIES":  ["USD","EUR","JPY","GBP","CHF","CNY","RUB","TRY","INR","BRL","ILS","KRW","TWD","PKR","SAR","UAH"],
  "INDICES":     ["SPX500","NASDAQ","DAX","NIKKEI225","FTSE100","HSI"],
  "SECTORS":     ["DEFENCE","TECH","AIRLINE","INSURANCE","CONSTRUCTION","TRANSPORT","BONDS","EMERGING_MARKETS","REAL_ESTATE","SEMICONDUCTORS"],
  "US STOCKS":   ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","AMD","INTC","QCOM","LMT","RTX","NOC","BA","GD","XOM","CVX","COP","JPM","GS","BAC","JNJ","PFE","NEM","FCX"],
  "GLOBAL STOCKS": ["TSM","BABA","ASML","SAP","BP","SHEL","TTE","TM","RIO","BHP","CHKP","INFY"],
  "CRYPTO":      ["CRYPTO/BTC","CRYPTO/ETH","CRYPTO/SOL","CRYPTO/XRP","CRYPTO/BNB","CRYPTO/ADA","CRYPTO/DOGE","CRYPTO/AVAX","CRYPTO/LINK","CRYPTO/DOT"],
};

const ASSET_LABELS: Record<string, string> = {
  "OIL/BRENT":"Brent Crude","OIL/WTI":"WTI Crude","NATGAS":"Natural Gas","GOLD":"Gold","SILVER":"Silver",
  "COPPER":"Copper","WHEAT":"Wheat","SOYBEANS":"Soybeans","USD":"US Dollar Index","EUR":"EUR/USD",
  "JPY":"USD/JPY","GBP":"GBP/USD","CHF":"USD/CHF","CNY":"USD/CNY","RUB":"USD/RUB","TRY":"USD/TRY",
  "INR":"USD/INR","BRL":"USD/BRL","ILS":"USD/ILS","KRW":"USD/KRW","TWD":"USD/TWD","PKR":"USD/PKR",
  "SAR":"USD/SAR","UAH":"USD/UAH","SPX500":"S&P 500","NASDAQ":"NASDAQ","DAX":"DAX","NIKKEI225":"Nikkei 225",
  "FTSE100":"FTSE 100","HSI":"Hang Seng","DEFENCE":"Defence ETF","TECH":"Tech ETF","AIRLINE":"Airlines ETF",
  "INSURANCE":"Insurance ETF","CONSTRUCTION":"Construction ETF","TRANSPORT":"Transport ETF","BONDS":"US Bonds",
  "EMERGING_MARKETS":"Emerging Markets","REAL_ESTATE":"Real Estate ETF","SEMICONDUCTORS":"Semiconductors ETF",
  "AAPL":"Apple","MSFT":"Microsoft","NVDA":"NVIDIA","GOOGL":"Alphabet","AMZN":"Amazon","META":"Meta",
  "TSLA":"Tesla","AMD":"AMD","INTC":"Intel","QCOM":"Qualcomm","LMT":"Lockheed Martin","RTX":"Raytheon",
  "NOC":"Northrop Grumman","BA":"Boeing","GD":"General Dynamics","XOM":"ExxonMobil","CVX":"Chevron",
  "COP":"ConocoPhillips","JPM":"JPMorgan","GS":"Goldman Sachs","BAC":"Bank of America","JNJ":"Johnson & Johnson",
  "PFE":"Pfizer","NEM":"Newmont","FCX":"Freeport-McMoRan","TSM":"TSMC","BABA":"Alibaba","ASML":"ASML",
  "SAP":"SAP","BP":"BP","SHEL":"Shell","TTE":"TotalEnergies","TM":"Toyota","RIO":"Rio Tinto","BHP":"BHP",
  "CHKP":"Check Point","INFY":"Infosys","CRYPTO/BTC":"Bitcoin","CRYPTO/ETH":"Ethereum","CRYPTO/SOL":"Solana",
  "CRYPTO/XRP":"Ripple","CRYPTO/BNB":"BNB","CRYPTO/ADA":"Cardano","CRYPTO/DOGE":"Dogecoin",
  "CRYPTO/AVAX":"Avalanche","CRYPTO/LINK":"Chainlink","CRYPTO/DOT":"Polkadot",
};

function makeAsset(asset: string, label: string, category?: string): StockDetailAsset {
  return {
    asset,
    asset_label: label,
    category: category || getCategory(asset),
    direction: "BUY",
    avgConfidence: 0,
    count: 0,
    topSignalId: "",
    topNewsTitle: "",
    sources: [],
  };
}

function getCategory(asset: string): string {
  for (const [cat, assets] of Object.entries(API_CATEGORIES)) {
    if (assets.includes(asset)) return cat;
  }
  return "";
}

export default function WatchlistPage() {
  const [watchlist, setWatchlist]     = useState<WatchlistItem[]>([]);
  const [signals, setSignals]         = useState<WatchlistSignal[]>([]);
  const [loading, setLoading]         = useState(true);
  const [sigLoading, setSigLoading]   = useState(false);
  const [showPicker, setShowPicker]   = useState(false);
  const [chartAsset, setChartAsset]   = useState<StockDetailAsset | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  async function loadWatchlist() {
    setLoading(true);
    const r = await fetch("/api/watchlist", { headers });
    if (r.ok) setWatchlist(await r.json());
    setLoading(false);
  }

  async function loadSignals() {
    setSigLoading(true);
    const r = await fetch("/api/watchlist/signals", { headers });
    if (r.ok) setSignals(await r.json());
    setSigLoading(false);
  }

  useEffect(() => {
    loadWatchlist();
    loadSignals();
  }, []);

  async function addAsset(asset: string) {
    const label = ASSET_LABELS[asset] || asset;
    const category = getCategory(asset);
    await fetch("/api/watchlist", {
      method: "POST",
      headers,
      body: JSON.stringify({ asset, asset_label: label, category }),
    });
    await loadWatchlist();
    await loadSignals();
  }

  async function removeAsset(asset: string) {
    await fetch(`/api/watchlist/${encodeURIComponent(asset)}`, { method: "DELETE", headers });
    setWatchlist(w => w.filter(i => i.asset !== asset));
    setSignals(s => s.filter(sig => sig.market_signals.some(m => m.asset !== asset)));
  }

  const watchedAssets = new Set(watchlist.map(i => i.asset));
  const searchLower = pickerSearch.toLowerCase();
  const filteredCategories = Object.entries(API_CATEGORIES).map(([cat, assets]) => {
    const filtered = assets.filter(a => {
      const label = ASSET_LABELS[a] || a;
      return label.toLowerCase().includes(searchLower) || a.toLowerCase().includes(searchLower);
    });
    return { cat, assets: filtered };
  }).filter(c => c.assets.length > 0);

  return (
    <div className="max-w-screen-2xl mx-auto p-4 space-y-6">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-terminal-accent font-bold tracking-widest text-sm">★ WATCHLIST</h2>
          <p className="text-terminal-dim text-xs mt-0.5">Pin assets — see their latest signals at a glance</p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="text-xs px-4 py-2 border border-terminal-accent/40 text-terminal-accent hover:bg-terminal-accent/10 rounded transition-colors tracking-widest"
        >
          + ADD ASSET
        </button>
      </div>

      {/* Pinned assets */}
      {loading ? (
        <div className="text-terminal-dim text-xs">Loading watchlist…</div>
      ) : watchlist.length === 0 ? (
        <div className="border border-terminal-border/30 rounded p-6 text-center text-terminal-dim text-xs">
          No assets pinned yet. Click <span className="text-terminal-accent">+ ADD ASSET</span> to start watching.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {watchlist.map(item => (
            <div
              key={item.asset}
              className="flex items-center gap-2 border border-terminal-accent/20 bg-terminal-card/60 rounded px-3 py-1.5 text-xs group"
            >
              <button
                onClick={() => setChartAsset(makeAsset(item.asset, item.asset_label, item.category))}
                className="text-terminal-text hover:text-terminal-accent transition-colors font-bold"
              >
                {item.asset_label}
              </button>
              <span className="text-terminal-dim/50">{item.category}</span>
              <button
                onClick={() => removeAsset(item.asset)}
                className="text-terminal-dim/40 hover:text-red-400 transition-colors ml-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Signals for watched assets */}
      {watchlist.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-terminal-dim text-xs tracking-widest uppercase">Recent Signals (48h)</h3>
            {sigLoading && <div className="w-3 h-3 border border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />}
          </div>

          {signals.length === 0 && !sigLoading ? (
            <div className="text-terminal-dim text-xs border border-terminal-border/30 rounded p-4">
              No signals found for your watched assets in the last 48 hours.
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map(sig => (
                <div key={sig.id} className="border border-terminal-border/30 bg-terminal-card/40 rounded p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={sig.news_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-terminal-text text-xs hover:text-terminal-accent transition-colors leading-snug"
                    >
                      {sig.news_title}
                    </a>
                    <span className={`shrink-0 text-[10px] border px-1.5 py-0.5 rounded ${SEV_COLOR[sig.severity] || SEV_COLOR.LOW}`}>
                      {sig.severity}
                    </span>
                  </div>
                  <div className="text-terminal-dim text-[10px]">
                    {sig.source} · {new Date(sig.published_at).toLocaleString()} · {sig.event_label}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sig.market_signals.map((ms, i) => (
                      <button
                        key={i}
                        onClick={() => setChartAsset(makeAsset(ms.asset, ms.asset_label))}
                        className={`text-[10px] border px-2 py-0.5 rounded transition-colors ${
                          ms.signal === "BUY"
                            ? "text-terminal-buy border-terminal-buy/30 hover:bg-terminal-buy/10"
                            : "text-terminal-sell border-terminal-sell/30 hover:bg-terminal-sell/10"
                        }`}
                      >
                        {ms.signal} {ms.asset_label} {ms.confidence}%
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Asset picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowPicker(false)}>
          <div className="bg-terminal-bg border border-terminal-accent/30 rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border/30">
              <span className="text-terminal-accent text-xs font-bold tracking-widest">ADD ASSET TO WATCHLIST</span>
              <button onClick={() => setShowPicker(false)} className="text-terminal-dim hover:text-terminal-text text-lg leading-none">✕</button>
            </div>
            <div className="px-4 py-2 border-b border-terminal-border/30">
              <input
                type="text"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                placeholder="Search assets…"
                className="w-full bg-terminal-card border border-terminal-border/40 rounded px-3 py-1.5 text-xs text-terminal-text placeholder-terminal-dim/50 focus:outline-none focus:border-terminal-accent/40"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {filteredCategories.map(({ cat, assets }) => (
                <div key={cat}>
                  <div className="text-terminal-dim text-[10px] tracking-widest uppercase mb-1.5">{cat}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {assets.map(asset => {
                      const label = ASSET_LABELS[asset] || asset;
                      const pinned = watchedAssets.has(asset);
                      return (
                        <button
                          key={asset}
                          onClick={() => !pinned && addAsset(asset)}
                          disabled={pinned}
                          className={`text-[10px] border px-2 py-1 rounded transition-colors ${
                            pinned
                              ? "text-terminal-accent border-terminal-accent/40 bg-terminal-accent/10 cursor-default"
                              : "text-terminal-dim border-terminal-border/40 hover:text-terminal-text hover:border-terminal-accent/30"
                          }`}
                        >
                          {pinned ? "★ " : ""}{label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart modal */}
      {chartAsset && (
        <StockDetailModal
          asset={chartAsset}
          onClose={() => setChartAsset(null)}
        />
      )}
    </div>
  );
}
