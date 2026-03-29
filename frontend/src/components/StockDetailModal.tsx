import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { X, TrendingUp, TrendingDown, ExternalLink, Check, Loader } from "lucide-react";
import type { PriceData } from "../hooks/usePrices";

interface ChartPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Source {
  title: string;
  url: string | null;
  severity: string;
  reasoning: string;
}

export interface StockDetailAsset {
  asset: string;
  asset_label: string;
  category: string;
  direction: "BUY" | "SELL";
  avgConfidence: number;
  count: number;
  topSignalId: string;
  topNewsTitle: string;
  sources: Source[];
}

interface Props {
  asset: StockDetailAsset;
  price?: PriceData;
  onClose: () => void;
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-300",
  LOW: "text-blue-400",
};

function formatLabel(d: string) {
  if (!d) return "";
  if (d.includes("-")) {
    const parts = d.split("-");
    return `${parts[2]}/${parts[1]}`;
  }
  return d; // intraday: already "HH:MM"
}

function formatPrice(v: number) {
  if (v >= 10000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 100)   return v.toFixed(2);
  if (v >= 1)     return v.toFixed(4);
  return v.toFixed(6);
}

export default function StockDetailModal({ asset, price, onClose }: Props) {
  const isBuy = asset.direction === "BUY";
  const accentColor = isBuy ? "#00ff88" : "#ff0a3c";
  const accentDim   = isBuy ? "#00ff8833" : "#ff0a3c33";

  type Timeframe = "1m" | "5m" | "1h" | "24h" | "7d" | "30d" | "90d";
  const TIMEFRAMES: { key: Timeframe; label: string }[] = [
    { key: "1m",  label: "1M"  },
    { key: "5m",  label: "5M"  },
    { key: "1h",  label: "1H"  },
    { key: "24h", label: "24H" },
    { key: "7d",  label: "7D"  },
    { key: "30d", label: "30D" },
    { key: "90d", label: "90D" },
  ];

  const [chart, setChart]     = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [range, setRange]     = useState<Timeframe>("30d");

  const [actionDone, setActionDone]   = useState<"BUY" | "SELL" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setChartLoading(true);
    const token = localStorage.getItem("token");
    fetch(`/api/chart/${asset.asset}?timeframe=${range}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setChart)
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false));
  }, [asset.asset, range]);

  async function handleAction(dir: "BUY" | "SELL") {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const r = await fetch("/api/portfolio", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          signal_id:   asset.topSignalId,
          news_title:  asset.topNewsTitle,
          asset:       asset.asset,
          asset_label: asset.asset_label,
          category:    asset.category,
          direction:   dir,
          confidence:  asset.avgConfidence,
          entry_price: price?.price ?? null,
        }),
      });
      if (r.ok || r.status === 409) setActionDone(dir);
    } finally {
      setActionLoading(false);
    }
  }

  // Chart color: green if last close >= first close, else red
  const chartUp = chart.length >= 2 && chart[chart.length - 1].close >= chart[0].close;
  const lineColor = chartUp ? "#00ff88" : "#ff0a3c";
  const gradId = `grad-${asset.asset}`;

  const minClose = chart.length ? Math.min(...chart.map(c => c.close)) : 0;
  const maxClose = chart.length ? Math.max(...chart.map(c => c.close)) : 0;
  const domain: [number, number] = [minClose * 0.998, maxClose * 1.002];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,4,8,0.85)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-xl border bg-terminal-bg overflow-hidden"
        style={{ borderColor: accentColor + "44", boxShadow: `0 0 40px ${accentColor}22` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: accentColor + "22" }}>
          <div>
            <div className="flex items-center gap-2">
              {isBuy
                ? <TrendingUp size={16} style={{ color: accentColor }} />
                : <TrendingDown size={16} style={{ color: accentColor }} />}
              <span className="font-bold text-base tracking-wide" style={{ color: accentColor }}>
                {asset.asset_label}
              </span>
              <span className="text-terminal-dim text-xs">{asset.category}</span>
            </div>
            {price && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-terminal-text font-mono font-bold text-lg">{price.formatted}</span>
                <span className={`text-sm font-mono font-bold ${price.change_pct >= 0 ? "text-terminal-buy" : "text-terminal-sell"}`}>
                  {price.change_pct >= 0 ? "▲" : "▼"} {Math.abs(price.change_pct).toFixed(2)}%
                </span>
                <span className="text-terminal-dim text-xs">24h</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-terminal-dim hover:text-terminal-text p-1">
            <X size={18} />
          </button>
        </div>

        {/* Chart */}
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-terminal-dim text-xs tracking-widest">PRICE CHART</span>
            <div className="flex gap-1 flex-wrap justify-end">
              {TIMEFRAMES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRange(key)}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    range === key
                      ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
                      : "border-terminal-border text-terminal-dim hover:text-terminal-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 200 }}>
            {chartLoading ? (
              <div className="h-full flex items-center justify-center text-terminal-dim gap-2 text-xs">
                <Loader size={14} className="animate-spin" /> Loading chart data...
              </div>
            ) : chart.length < 2 ? (
              <div className="h-full flex items-center justify-center text-terminal-dim text-xs">
                Chart data unavailable for this asset
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={lineColor} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2332" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatLabel}
                    tick={{ fill: "#4a6080", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={domain}
                    tickFormatter={formatPrice}
                    tick={{ fill: "#4a6080", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{ background: "#050d18", border: `1px solid ${lineColor}44`, borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: "#7a9abf" }}
                    formatter={(val: any) => [formatPrice(Number(val)), "Close"]}
                    labelFormatter={(d: any) => formatLabel(String(d))}
                  />
                  {price && (
                    <ReferenceLine
                      y={price.price}
                      stroke={lineColor}
                      strokeDasharray="4 4"
                      strokeOpacity={0.6}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={lineColor}
                    strokeWidth={2}
                    fill={`url(#${gradId})`}
                    dot={false}
                    activeDot={{ r: 4, fill: lineColor }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Signal confidence */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-terminal-dim text-xs">SIGNAL CONFIDENCE</span>
            <span className="font-black text-lg" style={{ color: accentColor }}>{asset.avgConfidence}%</span>
            <span className="text-terminal-dim text-xs">· {asset.count} signal{asset.count !== 1 ? "s" : ""}</span>
          </div>
          <div className="h-2 bg-terminal-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${asset.avgConfidence}%`, background: accentColor }} />
          </div>
        </div>

        {/* BUY / SELL action buttons */}
        <div className="px-5 pb-4 flex gap-3">
          <button
            onClick={() => handleAction("BUY")}
            disabled={!!actionDone || actionLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-bold text-sm tracking-widest transition-all ${
              actionDone === "BUY"
                ? "border-terminal-buy bg-terminal-buy/20 text-terminal-buy"
                : actionDone
                ? "border-terminal-border text-terminal-dim opacity-40 cursor-not-allowed"
                : "border-terminal-buy/50 text-terminal-buy hover:bg-terminal-buy/10 hover:border-terminal-buy"
            }`}
            style={{ boxShadow: actionDone === "BUY" ? "0 0 16px #00ff8844" : undefined }}
          >
            {actionLoading && !actionDone ? (
              <Loader size={14} className="animate-spin" />
            ) : actionDone === "BUY" ? (
              <Check size={14} />
            ) : (
              <TrendingUp size={14} />
            )}
            {actionDone === "BUY" ? "ADDED TO PORTFOLIO" : "BUY"}
          </button>

          <button
            onClick={() => handleAction("SELL")}
            disabled={!!actionDone || actionLoading}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-bold text-sm tracking-widest transition-all ${
              actionDone === "SELL"
                ? "border-terminal-sell bg-terminal-sell/20 text-terminal-sell"
                : actionDone
                ? "border-terminal-border text-terminal-dim opacity-40 cursor-not-allowed"
                : "border-terminal-sell/50 text-terminal-sell hover:bg-terminal-sell/10 hover:border-terminal-sell"
            }`}
            style={{ boxShadow: actionDone === "SELL" ? "0 0 16px #ff0a3c44" : undefined }}
          >
            {actionLoading && !actionDone ? (
              <Loader size={14} className="animate-spin" />
            ) : actionDone === "SELL" ? (
              <Check size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            {actionDone === "SELL" ? "ADDED TO PORTFOLIO" : "SELL"}
          </button>
        </div>

        {/* Driving signals */}
        <div className="px-5 pb-4 border-t border-terminal-border/20 pt-3">
          <p className="text-terminal-dim text-xs tracking-widest mb-2">DRIVEN BY</p>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {asset.sources.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`shrink-0 font-bold ${SEVERITY_COLOR[s.severity] ?? "text-terminal-dim"}`}>[{s.severity[0]}]</span>
                <div className="flex-1 min-w-0">
                  <p className="text-terminal-text leading-snug">{s.title}</p>
                  <p className="text-terminal-dim italic truncate">{s.reasoning}</p>
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
      </div>
    </div>
  );
}
