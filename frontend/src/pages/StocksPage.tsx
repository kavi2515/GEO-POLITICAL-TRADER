import { TrendingUp, TrendingDown, ExternalLink, Zap } from "lucide-react";
import type { SignalItem } from "../types";

interface Props {
  signals: SignalItem[];
}

interface AssetSummary {
  asset: string;
  asset_label: string;
  category: string;
  direction: "BUY" | "SELL";
  avgConfidence: number;
  count: number;
  sources: Array<{ title: string; url: string | null; severity: string; reasoning: string }>;
}

function aggregateAssets(signals: SignalItem[]): { buys: AssetSummary[]; sells: AssetSummary[] } {
  const map = new Map<string, { buy: number[]; sell: number[]; label: string; category: string; sources: AssetSummary["sources"] }>();

  for (const signal of signals) {
    for (const ms of signal.market_signals) {
      const key = ms.asset;
      if (!map.has(key)) map.set(key, { buy: [], sell: [], label: ms.asset_label, category: ms.category, sources: [] });
      const entry = map.get(key)!;
      if (ms.signal === "BUY") entry.buy.push(ms.confidence);
      else entry.sell.push(ms.confidence);
      if (entry.sources.length < 5) {
        entry.sources.push({ title: signal.news_title, url: signal.news_url, severity: signal.severity, reasoning: ms.reasoning });
      }
    }
  }

  const buys: AssetSummary[] = [];
  const sells: AssetSummary[] = [];

  for (const [asset, data] of map.entries()) {
    const buyAvg = data.buy.length ? data.buy.reduce((a, b) => a + b, 0) / data.buy.length : 0;
    const sellAvg = data.sell.length ? data.sell.reduce((a, b) => a + b, 0) / data.sell.length : 0;

    if (data.buy.length > data.sell.length || (data.buy.length === data.sell.length && buyAvg >= sellAvg)) {
      buys.push({ asset, asset_label: data.label, category: data.category, direction: "BUY", avgConfidence: Math.round(buyAvg), count: data.buy.length, sources: data.sources });
    } else {
      sells.push({ asset, asset_label: data.label, category: data.category, direction: "SELL", avgConfidence: Math.round(sellAvg), count: data.sell.length, sources: data.sources });
    }
  }

  buys.sort((a, b) => b.avgConfidence - a.avgConfidence);
  sells.sort((a, b) => b.avgConfidence - a.avgConfidence);

  return { buys: buys.slice(0, 20), sells: sells.slice(0, 20) };
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-300",
  LOW: "text-blue-400",
};

export default function StocksPage({ signals }: Props) {
  const { buys, sells } = aggregateAssets(signals);

  if (signals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-terminal-dim">
        <Zap size={32} className="text-terminal-accent/40" />
        <p className="text-sm">No signals available. Refresh to fetch latest news.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <Zap size={16} className="text-terminal-accent" />
        <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">TRADING RECOMMENDATIONS</h2>
        <span className="text-terminal-dim text-xs">— based on {signals.length} geopolitical signals</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* BUY Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-terminal-buy/40 pb-2">
            <TrendingUp size={16} className="text-terminal-buy" />
            <h3 className="text-terminal-buy font-bold tracking-widest text-sm glow-buy">BUY SIGNALS</h3>
            <span className="ml-auto text-xs bg-terminal-buy/15 text-terminal-buy border border-terminal-buy/40 px-2 py-0.5 rounded">
              {buys.length} ASSETS
            </span>
          </div>
          {buys.map((a) => <AssetCard key={a.asset} asset={a} />)}
        </div>

        {/* SELL Column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b-2 border-terminal-sell/40 pb-2">
            <TrendingDown size={16} className="text-terminal-sell" />
            <h3 className="text-terminal-sell font-bold tracking-widest text-sm glow-sell">SELL SIGNALS</h3>
            <span className="ml-auto text-xs bg-terminal-sell/15 text-terminal-sell border border-terminal-sell/40 px-2 py-0.5 rounded">
              {sells.length} ASSETS
            </span>
          </div>
          {sells.map((a) => <AssetCard key={a.asset} asset={a} />)}
        </div>
      </div>
    </div>
  );
}

function AssetCard({ asset }: { asset: AssetSummary }) {
  const isBuy = asset.direction === "BUY";
  const borderColor = isBuy ? "border-terminal-buy/30" : "border-terminal-sell/30";
  const bgColor = isBuy ? "bg-terminal-buy/5" : "bg-terminal-sell/5";
  const textColor = isBuy ? "text-terminal-buy" : "text-terminal-sell";
  const glowClass = isBuy ? "glow-buy" : "glow-sell";
  const barColor = isBuy ? "bg-terminal-buy" : "bg-terminal-sell";

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} p-4 space-y-3 hover:brightness-110 transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className={`text-base font-bold tracking-wide ${textColor} ${glowClass}`}>
            {asset.asset_label}
          </div>
          <div className="text-terminal-dim text-xs uppercase tracking-wider">{asset.category}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${textColor} ${glowClass}`}>
            {asset.avgConfidence}%
          </div>
          <div className="text-terminal-dim text-xs">{asset.count} signal{asset.count !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="h-2 bg-terminal-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${asset.avgConfidence}%` }}
        />
      </div>

      {/* News sources */}
      <div className="space-y-1.5">
        <p className="text-terminal-dim text-xs tracking-widest">DRIVEN BY:</p>
        {asset.sources.slice(0, 3).map((s, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={`shrink-0 font-bold text-xs ${SEVERITY_COLOR[s.severity] ?? "text-terminal-dim"}`}>
              [{s.severity[0]}]
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-terminal-text truncate">{s.title}</p>
              <p className="text-terminal-dim italic text-xs truncate">{s.reasoning}</p>
            </div>
            {s.url && (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-terminal-dim hover:text-terminal-accent">
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
