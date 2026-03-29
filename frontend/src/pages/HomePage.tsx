import { useEffect, useState, useMemo } from "react";
import {
  Radio, TrendingUp, TrendingDown, Activity,
  Briefcase, Globe, ShieldAlert, ArrowRight,
  AlertTriangle, BarChart2, Zap,
} from "lucide-react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import type { SignalItem } from "../types";
import type { PriceData } from "../hooks/usePrices";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const ENTITY_TO_ISO: Record<string, number[]> = {
  "Russia": [643], "Ukraine": [804], "China": [156],
  "United States": [840], "Usa": [840], "America": [840],
  "Iran": [364], "Saudi Arabia": [682], "Japan": [392],
  "Uk": [826], "United Kingdom": [826], "India": [356],
  "Brazil": [76], "Turkey": [792], "Israel": [376],
  "North Korea": [408], "Venezuela": [862], "Taiwan": [158],
  "South Korea": [410], "Germany": [276], "France": [250],
  "Pakistan": [586], "Afghanistan": [4],
  "Europe": [276, 250, 380, 724, 528, 40],
  "European Union": [276, 250, 380, 724, 528],
  "Middle East": [364, 682, 368, 760, 400],
  "Africa": [710, 566, 818, 12],
  "Latin America": [76, 484, 32, 170, 604],
  "Opec": [682, 364, 706, 784, 12],
};

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function severityFill(sev?: string) {
  switch (sev) {
    case "CRITICAL": return "#ff0a3c";
    case "HIGH":     return "#ff6b00";
    case "MEDIUM":   return "#f5c518";
    case "LOW":      return "#00aaff";
    default:         return "#0d1b2a";
  }
}

interface PortfolioItem { id: string; status: string; direction: string; asset_label: string; }

type Page = "home" | "news" | "stocks" | "markets" | "portfolio" | "worldmap" | "admin";

interface Props {
  signals: SignalItem[];
  prices: Record<string, PriceData>;
  onNavigate: (page: Page) => void;
  userName: string;
}

export default function HomePage({ signals, prices, onNavigate, userName }: Props) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/portfolio", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setPortfolio)
      .catch(() => {});
  }, []);

  // --- Signal stats ---
  const critical = signals.filter(s => s.severity === "CRITICAL").length;
  const high     = signals.filter(s => s.severity === "HIGH").length;
  const latest   = signals[0];

  // --- Trade stats ---
  const buySignals  = signals.flatMap(s => s.market_signals.filter(m => m.signal === "BUY"));
  const sellSignals = signals.flatMap(s => s.market_signals.filter(m => m.signal === "SELL"));
  const topBuy  = buySignals.sort((a, b) => b.confidence - a.confidence)[0];
  const topSell = sellSignals.sort((a, b) => b.confidence - a.confidence)[0];

  // --- Market stats (top movers) ---
  const movers = Object.values(prices)
    .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
    .slice(0, 3);

  // --- Portfolio stats ---
  const openTrades   = portfolio.filter(p => p.status === "OPEN").length;
  const closedTrades = portfolio.filter(p => p.status === "CLOSED").length;

  // --- World map data ---
  const countryMap = useMemo(() => {
    const entityMap = new Map<string, string>();
    for (const sig of signals) {
      for (const entity of sig.entities) {
        const existing = entityMap.get(entity);
        if (!existing || SEVERITY_ORDER[sig.severity] > SEVERITY_ORDER[existing]) {
          entityMap.set(entity, sig.severity);
        }
      }
    }
    const isoMap = new Map<number, string>();
    for (const [entity, sev] of entityMap.entries()) {
      const codes = ENTITY_TO_ISO[entity];
      if (!codes) continue;
      for (const iso of codes) {
        const ex = isoMap.get(iso);
        if (!ex || SEVERITY_ORDER[sev] > SEVERITY_ORDER[ex]) isoMap.set(iso, sev);
      }
    }
    return isoMap;
  }, [signals]);

  const activeRegions = countryMap.size;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-terminal-accent text-lg font-bold tracking-widest glow-accent">
            GEOTRADER COMMAND CENTER
          </h1>
          <p className="text-terminal-dim text-xs mt-1">
            Welcome back, <span className="text-terminal-text font-semibold">{userName}</span> — {signals.length} signals loaded · {Object.keys(prices).length} live prices
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {critical > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded border border-terminal-sell/40 bg-terminal-sell/10 text-terminal-sell font-bold animate-pulse">
              <AlertTriangle size={11} /> {critical} CRITICAL
            </span>
          )}
          {high > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded border font-bold" style={{ borderColor: "#ff6b0040", background: "#ff6b0010", color: "#ff6b00" }}>
              <Zap size={11} /> {high} HIGH
            </span>
          )}
        </div>
      </div>

      {/* Widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* 1. Signals Feed */}
        <WidgetCard
          icon={<Radio size={16} className="text-terminal-accent" />}
          title="SIGNALS FEED"
          accent="accent"
          onClick={() => onNavigate("news")}
        >
          <div className="flex gap-4 mt-2">
            <Pill label="TOTAL" value={signals.length} color="text-terminal-text" />
            <Pill label="CRITICAL" value={critical} color="text-terminal-sell" />
            <Pill label="HIGH" value={high} color="text-orange-400" />
          </div>
          {latest && (
            <div className="mt-3 border-t border-terminal-border/20 pt-3">
              <div className="text-terminal-dim text-xs mb-1">LATEST</div>
              <p className="text-terminal-text text-xs leading-snug line-clamp-2">{latest.news_title}</p>
              <div className="flex gap-2 mt-1 text-xs text-terminal-dim">
                <span>{latest.source}</span>
                <span>·</span>
                <span style={{ color: severityFill(latest.severity) }}>{latest.severity}</span>
              </div>
            </div>
          )}
        </WidgetCard>

        {/* 2. Trade Recommendations */}
        <WidgetCard
          icon={<BarChart2 size={16} className="text-terminal-buy" />}
          title="TRADE RECOMMENDATIONS"
          accent="buy"
          onClick={() => onNavigate("stocks")}
        >
          <div className="flex gap-4 mt-2">
            <Pill label="BUY SIGNALS" value={buySignals.length} color="text-terminal-buy" />
            <Pill label="SELL SIGNALS" value={sellSignals.length} color="text-terminal-sell" />
          </div>
          <div className="mt-3 space-y-1.5">
            {topBuy && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp size={11} className="text-terminal-buy" />
                <span className="text-terminal-buy font-bold">{topBuy.asset_label}</span>
                <span className="text-terminal-dim ml-auto">{topBuy.confidence}% conf</span>
              </div>
            )}
            {topSell && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingDown size={11} className="text-terminal-sell" />
                <span className="text-terminal-sell font-bold">{topSell.asset_label}</span>
                <span className="text-terminal-dim ml-auto">{topSell.confidence}% conf</span>
              </div>
            )}
          </div>
        </WidgetCard>

        {/* 3. Live Markets */}
        <WidgetCard
          icon={<Activity size={16} className="text-terminal-accent" />}
          title="LIVE MARKETS"
          accent="accent"
          onClick={() => onNavigate("markets")}
        >
          <div className="flex gap-4 mt-2">
            <Pill label="LIVE PRICES" value={Object.keys(prices).length} color="text-terminal-accent" />
            <Pill
              label="GAINERS"
              value={Object.values(prices).filter(p => p.change_pct >= 0).length}
              color="text-terminal-buy"
            />
          </div>
          <div className="mt-3 space-y-1.5">
            {movers.map(p => (
              <div key={p.ticker} className="flex items-center gap-2 text-xs">
                <span className="text-terminal-text font-mono font-bold w-20 truncate">{p.ticker}</span>
                <span className="text-terminal-dim font-mono">{p.formatted}</span>
                <span className={`ml-auto font-bold font-mono ${p.change_pct >= 0 ? "text-terminal-buy" : "text-terminal-sell"}`}>
                  {p.change_pct >= 0 ? "▲" : "▼"} {Math.abs(p.change_pct).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </WidgetCard>

        {/* 4. Portfolio */}
        <WidgetCard
          icon={<Briefcase size={16} className="text-terminal-accent" />}
          title="PORTFOLIO"
          accent="accent"
          onClick={() => onNavigate("portfolio")}
        >
          <div className="flex gap-4 mt-2">
            <Pill label="OPEN" value={openTrades} color="text-terminal-buy" />
            <Pill label="CLOSED" value={closedTrades} color="text-terminal-dim" />
          </div>
          {openTrades === 0 && closedTrades === 0 ? (
            <p className="text-terminal-dim text-xs mt-3">No trades tracked yet. Add from Trade Recommendations.</p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {portfolio.filter(p => p.status === "OPEN").slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  {p.direction === "BUY"
                    ? <TrendingUp size={11} className="text-terminal-buy" />
                    : <TrendingDown size={11} className="text-terminal-sell" />}
                  <span className="text-terminal-text font-bold">{p.asset_label}</span>
                  <span className={`ml-auto font-bold text-xs ${p.direction === "BUY" ? "text-terminal-buy" : "text-terminal-sell"}`}>
                    {p.direction}
                  </span>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* 5. World Heatmap — spans 2 columns */}
        <div
          className="md:col-span-2 xl:col-span-2 border border-terminal-border/30 rounded-xl bg-terminal-card/20 hover:border-terminal-accent/40 transition-all cursor-pointer group overflow-hidden"
          onClick={() => onNavigate("worldmap")}
          style={{ minHeight: 220 }}
        >
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-terminal-accent group-hover:animate-spin" style={{ animationDuration: "3s" }} />
              <span className="text-terminal-accent text-xs tracking-widest font-bold">WORLD HEATMAP</span>
              <span className="text-terminal-dim text-xs">— {activeRegions} active regions</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-terminal-dim">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#ff0a3c" }} />
                CRITICAL
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#ff6b00" }} />
                HIGH
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#f5c518" }} />
                MED
              </span>
              <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Mini map */}
          <div className="px-2 pb-2" style={{ height: 170 }}>
            <ComposableMap
              projection="geoNaturalEarth1"
              style={{ width: "100%", height: "100%" }}
              projectionConfig={{ scale: 130, center: [10, 10] }}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const isoNum = Number(geo.id);
                    const sev = countryMap.get(isoNum);
                    const fill = severityFill(sev);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#0d1b2a"
                        strokeWidth={0.4}
                        style={{
                          default: {
                            outline: "none",
                            filter: sev ? `drop-shadow(0 0 3px ${fill})` : "none",
                          },
                          hover: { outline: "none" },
                          pressed: { outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ComposableMap>
          </div>
        </div>

      </div>

      {/* Alert strip */}
      {critical > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border text-xs cursor-pointer hover:opacity-90 transition-opacity"
          style={{ borderColor: "#ff0a3c44", background: "#ff0a3c0a", color: "#ff0a3c" }}
          onClick={() => onNavigate("news")}
        >
          <ShieldAlert size={14} className="shrink-0 animate-pulse" />
          <span className="font-bold">{critical} CRITICAL ALERT{critical !== 1 ? "S" : ""} ACTIVE</span>
          <span className="text-terminal-dim font-normal">— Click to view in Signals Feed</span>
          <ArrowRight size={12} className="ml-auto" />
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  icon, title, accent, onClick, children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: "accent" | "buy" | "sell";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const borderHover = accent === "buy" ? "hover:border-terminal-buy/40" : accent === "sell" ? "hover:border-terminal-sell/40" : "hover:border-terminal-accent/40";
  const arrowColor  = accent === "buy" ? "text-terminal-buy" : accent === "sell" ? "text-terminal-sell" : "text-terminal-accent";

  return (
    <div
      className={`border border-terminal-border/30 rounded-xl bg-terminal-card/20 p-4 cursor-pointer group transition-all ${borderHover} hover:bg-terminal-card/40`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs tracking-widest font-bold text-terminal-dim">{title}</span>
        </div>
        <ArrowRight size={12} className={`${arrowColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all`} />
      </div>
      {children}
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-terminal-dim text-xs">{label}</span>
      <span className={`font-bold text-lg leading-tight ${color}`}>{value}</span>
    </div>
  );
}
