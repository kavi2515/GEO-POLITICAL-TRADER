import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Activity } from "lucide-react";
import { usePrices } from "../hooks/usePrices";
import type { SignalItem } from "../types";

interface Props {
  signals: SignalItem[];
  onRefresh: () => void;
}

interface MarketAsset {
  asset: string;
  asset_label: string;
  category: string;
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  signalCount: number;
}

const CATEGORIES = ["All", "Commodity", "Currency", "Index", "Crypto", "Sector", "Fixed Income"];

const CATEGORY_COLOR: Record<string, string> = {
  Commodity:      "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  Currency:       "text-blue-400 border-blue-400/30 bg-blue-400/10",
  Index:          "text-purple-400 border-purple-400/30 bg-purple-400/10",
  Crypto:         "text-orange-400 border-orange-400/30 bg-orange-400/10",
  Sector:         "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  "Fixed Income": "text-pink-400 border-pink-400/30 bg-pink-400/10",
};

function buildMarketAssets(signals: SignalItem[]): MarketAsset[] {
  const map = new Map<string, { label: string; category: string; buy: number[]; sell: number[] }>();

  for (const signal of signals) {
    for (const ms of signal.market_signals) {
      if (!map.has(ms.asset)) {
        map.set(ms.asset, { label: ms.asset_label, category: ms.category, buy: [], sell: [] });
      }
      const entry = map.get(ms.asset)!;
      if (ms.signal === "BUY") entry.buy.push(ms.confidence);
      else entry.sell.push(ms.confidence);
    }
  }

  const assets: MarketAsset[] = [];
  for (const [asset, data] of map.entries()) {
    const buyAvg = data.buy.length ? data.buy.reduce((a, b) => a + b, 0) / data.buy.length : 0;
    const sellAvg = data.sell.length ? data.sell.reduce((a, b) => a + b, 0) / data.sell.length : 0;
    const totalCount = data.buy.length + data.sell.length;

    let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
    let confidence = 0;
    if (data.buy.length > data.sell.length) { signal = "BUY"; confidence = Math.round(buyAvg); }
    else if (data.sell.length > data.buy.length) { signal = "SELL"; confidence = Math.round(sellAvg); }
    else if (buyAvg >= sellAvg) { signal = "BUY"; confidence = Math.round(buyAvg); }
    else { signal = "SELL"; confidence = Math.round(sellAvg); }

    assets.push({ asset, asset_label: data.label, category: data.category, signal, confidence, signalCount: totalCount });
  }

  return assets.sort((a, b) => b.confidence - a.confidence);
}

export default function MarketsPage({ signals, onRefresh }: Props) {
  const { prices, loading: pricesLoading } = usePrices();
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const allAssets = buildMarketAssets(signals);
  const filtered = allAssets.filter(a =>
    (activeCategory === "All" || a.category === activeCategory) &&
    (search === "" || a.asset_label.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    if (!pricesLoading) setLastUpdated(new Date());
  }, [pricesLoading]);

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity size={16} className="text-terminal-accent" />
          <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">LIVE MARKETS</h2>
          <span className="text-terminal-dim text-xs">— {filtered.length} assets</span>
          {pricesLoading && <span className="text-terminal-dim text-xs animate-pulse">· updating prices...</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-terminal-dim text-xs">Updated: {lastUpdated.toLocaleTimeString()}</span>
          <button onClick={onRefresh} className="flex items-center gap-1 text-xs text-terminal-dim hover:text-terminal-accent border border-terminal-border hover:border-terminal-accent/40 px-2 py-1 rounded transition-colors">
            <RefreshCw size={11} /> REFRESH
          </button>
        </div>
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search asset..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent border border-terminal-border rounded px-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent w-48"
        />
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                activeCategory === cat
                  ? "text-terminal-accent border-terminal-accent bg-terminal-accent/10"
                  : "text-terminal-dim border-terminal-border hover:text-terminal-text"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 text-xs border border-terminal-border/30 rounded p-3 bg-terminal-card/30">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-terminal-buy" />
          <span className="text-terminal-dim">BUY:</span>
          <span className="text-terminal-buy font-bold glow-buy">{filtered.filter(a => a.signal === "BUY").length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown size={12} className="text-terminal-sell" />
          <span className="text-terminal-dim">SELL:</span>
          <span className="text-terminal-sell font-bold glow-sell">{filtered.filter(a => a.signal === "SELL").length}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-terminal-dim">PRICES:</span>
          <span className="text-terminal-accent font-bold">{Object.keys(prices).length} live</span>
        </div>
      </div>

      {/* Market table */}
      <div className="border border-terminal-border/30 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-terminal-accent/5 text-xs text-terminal-dim tracking-widest border-b border-terminal-border/30">
          <div className="col-span-3">ASSET</div>
          <div className="col-span-2">CATEGORY</div>
          <div className="col-span-2 text-right">PRICE</div>
          <div className="col-span-2 text-right">24H CHANGE</div>
          <div className="col-span-2 text-center">SIGNAL</div>
          <div className="col-span-1 text-right">CONF</div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-terminal-dim text-sm">No assets found</div>
        ) : (
          filtered.map((asset) => {
            const price = prices[asset.asset];
            const isBuy = asset.signal === "BUY";
            const isSell = asset.signal === "SELL";

            return (
              <div
                key={asset.asset}
                className={`grid grid-cols-12 gap-2 px-4 py-3 text-xs border-b border-terminal-border/20 hover:bg-terminal-muted/30 transition-colors ${
                  isBuy ? "hover:bg-terminal-buy/5" : isSell ? "hover:bg-terminal-sell/5" : ""
                }`}
              >
                {/* Asset name */}
                <div className="col-span-3">
                  <div className="text-terminal-text font-semibold">{asset.asset_label}</div>
                  <div className="text-terminal-dim text-xs opacity-60">{asset.asset}</div>
                </div>

                {/* Category */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${CATEGORY_COLOR[asset.category] ?? "text-terminal-dim border-terminal-border"}`}>
                    {asset.category}
                  </span>
                </div>

                {/* Price */}
                <div className="col-span-2 text-right font-mono">
                  {price ? (
                    <span className="text-terminal-text font-bold">{price.formatted}</span>
                  ) : (
                    <span className="text-terminal-dim">—</span>
                  )}
                </div>

                {/* 24h change */}
                <div className="col-span-2 text-right font-mono">
                  {price ? (
                    <span className={`font-bold ${price.change_pct >= 0 ? "text-terminal-buy glow-buy" : "text-terminal-sell glow-sell"}`}>
                      {price.change_pct >= 0 ? "▲" : "▼"} {Math.abs(price.change_pct).toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-terminal-dim">—</span>
                  )}
                </div>

                {/* Signal */}
                <div className="col-span-2 flex items-center justify-center">
                  {isBuy ? (
                    <span className="flex items-center gap-1 text-terminal-buy glow-buy font-bold border border-terminal-buy/30 bg-terminal-buy/10 px-2 py-0.5 rounded">
                      <TrendingUp size={11} /> BUY
                    </span>
                  ) : isSell ? (
                    <span className="flex items-center gap-1 text-terminal-sell glow-sell font-bold border border-terminal-sell/30 bg-terminal-sell/10 px-2 py-0.5 rounded">
                      <TrendingDown size={11} /> SELL
                    </span>
                  ) : (
                    <span className="text-terminal-dim">NEUTRAL</span>
                  )}
                </div>

                {/* Confidence */}
                <div className="col-span-1 text-right">
                  <span className={`font-mono font-bold ${isBuy ? "text-terminal-buy" : isSell ? "text-terminal-sell" : "text-terminal-dim"}`}>
                    {asset.confidence}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
