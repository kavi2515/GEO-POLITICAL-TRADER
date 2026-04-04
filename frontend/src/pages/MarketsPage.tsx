import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Activity, ChevronRight } from "lucide-react";
import { usePrices } from "../hooks/usePrices";
import type { SignalItem } from "../types";
import StockDetailModal, { type StockDetailAsset } from "../components/StockDetailModal";
import { ASSET_CATALOGUE } from "../lib/assetCatalogue";

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

const CATEGORIES = ["All", "Stock", "Commodity", "Currency", "Index", "Crypto", "Sector", "Fixed Income"];
const KNOWN_CATEGORIES = new Set(["Stock", "Commodity", "Currency", "Index", "Crypto", "Sector", "Fixed Income"]);

const CATEGORY_COLOR: Record<string, string> = {
  Stock:          "text-green-400 border-green-400/30 bg-green-400/10",
  Commodity:      "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  Currency:       "text-blue-400 border-blue-400/30 bg-blue-400/10",
  Index:          "text-purple-400 border-purple-400/30 bg-purple-400/10",
  Crypto:         "text-orange-400 border-orange-400/30 bg-orange-400/10",
  Sector:         "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  "Fixed Income": "text-pink-400 border-pink-400/30 bg-pink-400/10",
};

function buildMarketAssets(signals: SignalItem[], priceKeys: string[]): MarketAsset[] {
  // Build signal map from recent news signals
  const signalMap = new Map<string, { label: string; category: string; buy: number[]; sell: number[] }>();

  for (const signal of signals) {
    for (const ms of signal.market_signals) {
      if (!signalMap.has(ms.asset)) {
        signalMap.set(ms.asset, { label: ms.asset_label, category: ms.category, buy: [], sell: [] });
      }
      const entry = signalMap.get(ms.asset)!;
      if (ms.signal === "BUY") entry.buy.push(ms.confidence);
      else entry.sell.push(ms.confidence);
    }
  }

  // Build full asset list from all priced assets + catalogue
  const allAssetKeys = new Set([...priceKeys, ...Object.keys(ASSET_CATALOGUE)]);
  const assets: MarketAsset[] = [];

  for (const asset of allAssetKeys) {
    const meta = ASSET_CATALOGUE[asset];
    if (!meta) continue;

    const data = signalMap.get(asset);
    let signal: "BUY" | "SELL" | "NEUTRAL" = "NEUTRAL";
    let confidence = 0;
    let signalCount = 0;

    if (data) {
      const buyAvg = data.buy.length ? data.buy.reduce((a, b) => a + b, 0) / data.buy.length : 0;
      const sellAvg = data.sell.length ? data.sell.reduce((a, b) => a + b, 0) / data.sell.length : 0;
      signalCount = data.buy.length + data.sell.length;

      if (data.buy.length > data.sell.length) { signal = "BUY"; confidence = Math.round(buyAvg); }
      else if (data.sell.length > data.buy.length) { signal = "SELL"; confidence = Math.round(sellAvg); }
      else if (buyAvg >= sellAvg && buyAvg > 0) { signal = "BUY"; confidence = Math.round(buyAvg); }
      else if (sellAvg > 0) { signal = "SELL"; confidence = Math.round(sellAvg); }
    }

    assets.push({
      asset,
      asset_label: data?.label ?? meta.label,
      category: meta.category,
      signal,
      confidence,
      signalCount,
    });
  }

  // Sort: assets with signals first (by confidence), then alphabetically
  return assets.sort((a, b) => {
    if (b.signalCount !== a.signalCount) return b.signalCount - a.signalCount;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.asset_label.localeCompare(b.asset_label);
  });
}

function buildDetailAsset(asset: MarketAsset, signals: SignalItem[]): StockDetailAsset {
  const sources: StockDetailAsset["sources"] = [];
  let topSignalId = "";
  let topNewsTitle = "";

  for (const sig of signals) {
    for (const ms of sig.market_signals) {
      if (ms.asset === asset.asset && sources.length < 5) {
        if (!topSignalId) { topSignalId = sig.id; topNewsTitle = sig.news_title; }
        sources.push({ title: sig.news_title, url: sig.news_url, severity: sig.severity, reasoning: ms.reasoning });
      }
    }
  }

  const direction = asset.signal === "NEUTRAL" ? "BUY" : asset.signal;
  return {
    asset: asset.asset,
    asset_label: asset.asset_label,
    category: asset.category,
    direction,
    avgConfidence: asset.confidence,
    count: asset.signalCount,
    topSignalId,
    topNewsTitle,
    sources,
  };
}

export default function MarketsPage({ signals, onRefresh }: Props) {
  const { prices, loading: pricesLoading } = usePrices();
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selected, setSelected] = useState<StockDetailAsset | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<ReturnType<typeof usePrices>["prices"][string] | undefined>();

  const allAssets = buildMarketAssets(signals, Object.keys(prices));
  const filtered = allAssets.filter(a =>
    KNOWN_CATEGORIES.has(a.category) &&
    (activeCategory === "All" || a.category === activeCategory) &&
    (search === "" || a.asset_label.toLowerCase().includes(search.toLowerCase()) || a.asset.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    if (!pricesLoading) setLastUpdated(new Date());
  }, [pricesLoading]);

  function handleRowClick(asset: MarketAsset) {
    setSelected(buildDetailAsset(asset, signals));
    setSelectedPrice(prices[asset.asset]);
  }

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
          <span className="text-terminal-dim text-xs">Click any row for chart · Updated: {lastUpdated.toLocaleTimeString()}</span>
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
                onClick={() => handleRowClick(asset)}
                className={`grid grid-cols-12 gap-2 px-4 py-3 text-xs border-b border-terminal-border/20 transition-colors cursor-pointer group ${
                  isBuy ? "hover:bg-terminal-buy/5" : isSell ? "hover:bg-terminal-sell/5" : "hover:bg-terminal-muted/30"
                }`}
              >
                {/* Asset name */}
                <div className="col-span-3 flex items-center gap-2">
                  <div>
                    <div className="text-terminal-text font-semibold group-hover:text-terminal-accent transition-colors">{asset.asset_label}</div>
                    <div className="text-terminal-dim text-xs opacity-60">{asset.asset}</div>
                  </div>
                  <ChevronRight size={12} className="text-terminal-dim opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ml-auto" />
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

      {/* Detail modal */}
      {selected && (
        <StockDetailModal
          asset={selected}
          price={selectedPrice}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
