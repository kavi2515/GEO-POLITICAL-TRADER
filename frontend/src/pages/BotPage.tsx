import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Activity, PlayCircle, StopCircle,
  RefreshCw, Zap, DollarSign, BarChart2, Clock, Target, Crosshair,
} from "lucide-react";

interface Position {
  id: string;
  asset: string;
  asset_label: string;
  category: string;
  direction: string;
  entry_price: number;
  current_price: number;
  quantity_usd: number;
  current_value: number;
  pnl_pct: number;
  pnl_usd: number;
  stop_loss_price: number;
  take_profit_price: number;
  entry_signal_score: number;
  entry_reasoning: string;
  opened_at: string;
}

interface BotStatus {
  enabled: boolean;
  starting_capital: number;
  available_cash: number;
  position_value: number;
  total_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  positions: Position[];
  config: {
    min_signal_score: number;
    max_position_pct: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    max_positions: number;
  };
}

interface PreMarketPick {
  id: string;
  asset: string;
  asset_label: string;
  category: string;
  direction: string;
  signal_score: number;
  mismatch_score: number;
  price_at_analysis: number;
  price_now: number | null;
  price_change_since: number | null;
  reasoning: string;
  acted_on: boolean;
}

interface PreMarketData {
  date: string;
  picks: PreMarketPick[];
  market_open: boolean;
}

interface Trade {
  id: string;
  asset: string;
  asset_label: string;
  action: string;
  price: number;
  quantity_usd: number;
  signal_score: number | null;
  reasoning: string;
  pnl: number | null;
  created_at: string;
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" };
}

const ACTION_COLOR: Record<string, string> = {
  BUY:          "text-terminal-buy border-terminal-buy/30 bg-terminal-buy/10",
  SELL:         "text-terminal-sell border-terminal-sell/30 bg-terminal-sell/10",
  STOP_LOSS:    "text-red-400 border-red-400/30 bg-red-400/10",
  TAKE_PROFIT:  "text-terminal-accent border-terminal-accent/30 bg-terminal-accent/10",
  SIGNAL_EXIT:  "text-orange-400 border-orange-400/30 bg-orange-400/10",
  SNIPER_BUY:   "text-purple-400 border-purple-400/30 bg-purple-400/10",
  SNIPER_SELL:  "text-pink-400 border-pink-400/30 bg-pink-400/10",
};

interface SniperConfig {
  enabled: boolean;
  mismatch_threshold: number;
  min_signal_score: number;
  position_pct: number;
  max_sniper_positions: number;
}

interface AssetConfig {
  asset: string;
  asset_label: string;
  category: string;
  enabled: boolean;
  sniper_only: boolean;
  min_signal_score: number | null;
  stop_loss_pct: number | null;
  take_profit_pct: number | null;
  max_position_pct: number | null;
}

interface GridBot {
  id: string;
  asset: string;
  asset_label: string;
  category: string;
  enabled: boolean;
  base_price: number;
  grid_spacing_pct: number;
  num_levels: number;
  capital_per_level: number;
  total_pnl: number;
  open_orders: number;
  filled_orders: number;
}

interface GridOrder {
  id: string;
  level: number;
  price: number;
  direction: string;
  status: string;
  filled_price: number | null;
  pnl: number | null;
}

export default function BotPage() {
  const [status, setStatus]           = useState<BotStatus | null>(null);
  const [trades, setTrades]           = useState<Trade[]>([]);
  const [premarket, setPremarket]     = useState<PreMarketData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [running, setRunning]         = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [activeTab, setActiveTab]     = useState<"standard"|"sniper"|"assets"|"grid"|"trades">("standard");

  // Sniper state
  const [sniperCfg, setSniperCfg]         = useState<SniperConfig | null>(null);
  const [sniperEnabled, setSniperEnabled] = useState(false);
  const [sniperThreshold, setSniperThreshold] = useState("85");
  const [sniperMinScore, setSniperMinScore]   = useState("90");
  const [sniperPosPct, setSniperPosPct]       = useState("35");
  const [sniperMaxPos, setSniperMaxPos]       = useState("2");

  // Per-asset state
  const [assetCfgs, setAssetCfgs]         = useState<AssetConfig[]>([]);
  const [newAsset, setNewAsset]           = useState("");
  const [newAssetLabel, setNewAssetLabel] = useState("");
  const [newAssetCat, setNewAssetCat]     = useState("Stock");

  // Grid state
  const [gridBots, setGridBots]           = useState<GridBot[]>([]);
  const [expandedGrid, setExpandedGrid]   = useState<string | null>(null);
  const [gridOrders, setGridOrders]       = useState<Record<string, GridOrder[]>>({});
  const [newGrid, setNewGrid]             = useState({ asset: "", asset_label: "", category: "Stock", base_price: "", grid_spacing_pct: "2", num_levels: "5", capital_per_level: "" });

  // Config edit state
  const [capital, setCapital]     = useState("");
  const [minScore, setMinScore]   = useState("");
  const [maxPos, setMaxPos]       = useState("");
  const [stopLoss, setStopLoss]   = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [maxPositions, setMaxPositions] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [s, t, pm, sc, ac, gb] = await Promise.all([
        fetch("/api/bot/status",        { headers: authHeaders() }).then(r => r.json()),
        fetch("/api/bot/trades",        { headers: authHeaders() }).then(r => r.json()),
        fetch("/api/bot/premarket",     { headers: authHeaders() }).then(r => r.json()).catch(() => null),
        fetch("/api/bot/sniper/config", { headers: authHeaders() }).then(r => r.json()).catch(() => null),
        fetch("/api/bot/assets",        { headers: authHeaders() }).then(r => r.json()).catch(() => []),
        fetch("/api/bot/grid",          { headers: authHeaders() }).then(r => r.json()).catch(() => []),
      ]);
      setStatus(s);
      setTrades(t);
      if (pm && pm.picks) setPremarket(pm);
      if (sc) {
        setSniperCfg(sc);
        setSniperEnabled(sc.enabled);
        setSniperThreshold(String(sc.mismatch_threshold));
        setSniperMinScore(String(sc.min_signal_score));
        setSniperPosPct(String(sc.position_pct));
        setSniperMaxPos(String(sc.max_sniper_positions));
      }
      if (Array.isArray(ac)) setAssetCfgs(ac);
      if (Array.isArray(gb)) setGridBots(gb);
      if (s.config) {
        setMinScore(String(s.config.min_signal_score));
        setMaxPos(String(s.config.max_position_pct));
        setStopLoss(String(s.config.stop_loss_pct));
        setTakeProfit(String(s.config.take_profit_pct));
        setMaxPositions(String(s.config.max_positions));
      }
      if (s.starting_capital) setCapital(String(s.starting_capital));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function toggleBot() {
    if (!status) return;
    await fetch("/api/bot/config", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ enabled: !status.enabled }),
    });
    fetchAll();
  }

  async function saveConfig() {
    await fetch("/api/bot/config", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({
        starting_capital: parseFloat(capital),
        min_signal_score: parseFloat(minScore),
        max_position_pct: parseFloat(maxPos),
        stop_loss_pct:    parseFloat(stopLoss),
        take_profit_pct:  parseFloat(takeProfit),
        max_positions:    parseInt(maxPositions),
      }),
    });
    fetchAll();
  }

  async function runScan() {
    setScanRunning(true);
    try {
      await fetch("/api/bot/premarket/run", { method: "POST", headers: authHeaders() });
      await fetchAll();
    } finally {
      setScanRunning(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      await fetch("/api/bot/run", { method: "POST", headers: authHeaders() });
      await fetchAll();
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="w-6 h-6 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin mr-3" />
        Loading bot...
      </div>
    );
  }
  if (!status) return <div className="p-6 text-terminal-dim">Failed to load bot status.</div>;

  const pnlPositive = status.total_pnl >= 0;

  return (
    <div className="p-4 space-y-5 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Zap size={16} className="text-terminal-accent" />
          <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">AI TRADE BOT</h2>
          <span className={`text-xs px-2 py-0.5 rounded border font-bold ${status.enabled ? "text-terminal-buy border-terminal-buy/40 bg-terminal-buy/10 animate-pulse" : "text-terminal-dim border-terminal-border"}`}>
            {status.enabled ? "● RUNNING" : "○ STOPPED"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runScan} disabled={scanRunning}
            className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 border border-purple-400/40 hover:border-purple-300/40 hover:bg-purple-400/10 px-3 py-1.5 rounded transition-colors disabled:opacity-50">
            {scanRunning ? <RefreshCw size={11} className="animate-spin" /> : <Crosshair size={11} />} SCAN MARKET
          </button>
          <button onClick={runNow} disabled={running}
            className="flex items-center gap-1.5 text-xs text-terminal-dim hover:text-terminal-accent border border-terminal-border hover:border-terminal-accent/40 px-3 py-1.5 rounded transition-colors disabled:opacity-50">
            {running ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />} RUN NOW
          </button>
          <button onClick={toggleBot}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border font-bold transition-colors ${
              status.enabled
                ? "text-red-400 border-red-400/40 hover:bg-red-400/10"
                : "text-terminal-buy border-terminal-buy/40 hover:bg-terminal-buy/10"
            }`}>
            {status.enabled ? <><StopCircle size={12} /> STOP BOT</> : <><PlayCircle size={12} /> START BOT</>}
          </button>
        </div>
      </div>

      {/* Portfolio summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<DollarSign size={14} />} label="TOTAL VALUE" value={`$${status.total_value.toFixed(2)}`} color="text-terminal-text" />
        <StatCard
          icon={pnlPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          label="TOTAL P&L"
          value={`${pnlPositive ? "+" : ""}$${status.total_pnl.toFixed(2)} (${status.total_pnl_pct > 0 ? "+" : ""}${status.total_pnl_pct.toFixed(2)}%)`}
          color={pnlPositive ? "text-terminal-buy" : "text-terminal-sell"}
        />
        <StatCard icon={<DollarSign size={14} />} label="CASH" value={`$${status.available_cash.toFixed(2)}`} color="text-terminal-accent" />
        <StatCard icon={<BarChart2 size={14} />} label="POSITIONS" value={`${status.positions.length} / ${status.config.max_positions}`} color="text-terminal-dim" />
      </div>

      {/* Today's Edge — Pre-market mismatch picks */}
      {premarket && (
        <div className="border border-purple-400/30 rounded-lg bg-purple-400/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-purple-400" />
              <span className="text-purple-400 text-xs font-bold tracking-widest">TODAY'S EDGE — MARKET MISMATCH SCANNER</span>
              {premarket.market_open && (
                <span className="text-xs px-2 py-0.5 rounded border border-terminal-buy/40 text-terminal-buy bg-terminal-buy/10 animate-pulse font-bold">
                  ● MARKET OPEN — 5-MIN CYCLES ACTIVE
                </span>
              )}
            </div>
            <span className="text-terminal-dim text-xs">{premarket.date} · {premarket.picks.length} picks</span>
          </div>

          {premarket.picks.length === 0 ? (
            <div className="text-center py-4 text-terminal-dim text-xs">
              No picks yet — click SCAN MARKET to run pre-market analysis
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-terminal-dim border-b border-purple-400/20">
                    <th className="text-left py-1.5 px-2">ASSET</th>
                    <th className="text-left py-1.5 px-2">DIR</th>
                    <th className="text-right py-1.5 px-2">SIGNAL</th>
                    <th className="text-right py-1.5 px-2">MISMATCH</th>
                    <th className="text-right py-1.5 px-2">ENTRY PRICE</th>
                    <th className="text-right py-1.5 px-2">NOW</th>
                    <th className="text-right py-1.5 px-2">MOVE</th>
                    <th className="text-center py-1.5 px-2">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {premarket.picks.map(pick => {
                    const misCol = pick.mismatch_score >= 85
                      ? "text-red-400" : pick.mismatch_score >= 70
                      ? "text-orange-400" : pick.mismatch_score >= 55
                      ? "text-yellow-400" : "text-terminal-dim";
                    return (
                      <tr key={pick.id} className="border-b border-purple-400/10 hover:bg-purple-400/5 transition-colors">
                        <td className="py-2 px-2">
                          <span className="text-terminal-text font-semibold">{pick.asset_label}</span>
                          <span className="text-terminal-dim ml-1 opacity-60">({pick.category})</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-1.5 py-0.5 rounded border text-xs font-bold ${
                            pick.direction === "BUY"
                              ? "text-terminal-buy border-terminal-buy/40 bg-terminal-buy/10"
                              : "text-terminal-sell border-terminal-sell/40 bg-terminal-sell/10"
                          }`}>{pick.direction}</span>
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${pick.signal_score > 0 ? "text-terminal-buy" : "text-terminal-sell"}`}>
                          {pick.signal_score > 0 ? "+" : ""}{pick.signal_score?.toFixed(1)}
                        </td>
                        <td className={`py-2 px-2 text-right font-mono font-bold ${misCol}`}>
                          {pick.mismatch_score?.toFixed(0)}
                          {pick.mismatch_score >= 85 && " 🔴"}
                          {pick.mismatch_score >= 70 && pick.mismatch_score < 85 && " 🟠"}
                          {pick.mismatch_score >= 55 && pick.mismatch_score < 70 && " 🟡"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-terminal-dim">
                          ${pick.price_at_analysis < 1 ? pick.price_at_analysis?.toFixed(4) : pick.price_at_analysis?.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-terminal-text">
                          {pick.price_now ? `$${pick.price_now < 1 ? pick.price_now.toFixed(4) : pick.price_now.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">
                          {pick.price_change_since != null ? (
                            <span className={pick.price_change_since >= 0 ? "text-terminal-buy" : "text-terminal-sell"}>
                              {pick.price_change_since >= 0 ? "+" : ""}{pick.price_change_since.toFixed(2)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {pick.acted_on ? (
                            <span className="text-terminal-buy text-xs font-bold">✓ ENTERED</span>
                          ) : (
                            <span className="text-terminal-dim text-xs">WATCHING</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-terminal-dim/60 text-xs">
            Mismatch score = signal strength × how little the market has priced it in. 🔴 85+ = huge edge, market asleep.
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-terminal-border/40 overflow-x-auto">
        {(["standard","sniper","assets","grid","trades"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold tracking-widest whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? tab === "sniper" ? "text-purple-400 border-purple-400"
                  : tab === "grid" ? "text-cyan-400 border-cyan-400"
                  : "text-terminal-accent border-terminal-accent"
                : "text-terminal-dim border-transparent hover:text-terminal-text"
            }`}>
            {tab === "standard" ? "⚡ STANDARD" : tab === "sniper" ? "🎯 SNIPER" : tab === "assets" ? "⚙ PER-ASSET" : tab === "grid" ? "⊞ GRID" : "📋 TRADE LOG"}
          </button>
        ))}
      </div>

      {activeTab === "trades" && (
        <div className="space-y-3">
          <p className="text-terminal-dim text-xs tracking-widest">FULL TRADE LOG</p>
          <div className="border border-terminal-border/30 rounded-lg overflow-hidden">
            {trades.length === 0 ? (
              <div className="p-6 text-center text-terminal-dim text-xs">No trades yet</div>
            ) : trades.map(t => (
              <div key={t.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-terminal-border/20 text-xs hover:bg-terminal-card/20">
                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-xs font-bold ${ACTION_COLOR[t.action] ?? "text-terminal-dim border-terminal-border"}`}>
                  {t.action.replace("_", " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-terminal-text font-semibold">{t.asset_label}</span>
                  <span className="text-terminal-dim ml-2">@ ${t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2)}</span>
                  <span className="text-terminal-dim ml-2">${t.quantity_usd.toFixed(2)}</span>
                  {t.pnl != null && <span className={`ml-2 font-bold ${t.pnl >= 0 ? "text-terminal-buy" : "text-terminal-sell"}`}>{t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(3)}</span>}
                  <p className="text-terminal-dim opacity-60 truncate mt-0.5">{t.reasoning}</p>
                </div>
                <span className="text-terminal-dim opacity-50 shrink-0">{new Date(t.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "sniper" && sniperCfg && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded border font-bold ${sniperEnabled ? "text-purple-400 border-purple-400/40 bg-purple-400/10 animate-pulse" : "text-terminal-dim border-terminal-border"}`}>
              {sniperEnabled ? "● ACTIVE" : "○ OFF"}
            </span>
            <p className="text-terminal-dim text-xs">Sniper fires only when mismatch ≥ threshold AND signal score ≥ min score. Max {sniperCfg.max_sniper_positions} positions at once.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="border border-purple-400/20 rounded-lg p-4 space-y-4 bg-purple-400/5">
              <p className="text-purple-400 text-xs tracking-widest font-bold">SNIPER CONFIGURATION</p>
              <div className="flex items-center justify-between">
                <span className="text-terminal-dim text-xs">ENABLED</span>
                <button onClick={() => setSniperEnabled(e => !e)}
                  className={`px-3 py-1 text-xs rounded border font-bold transition-colors ${sniperEnabled ? "text-purple-400 border-purple-400/40 bg-purple-400/10" : "text-terminal-dim border-terminal-border"}`}>
                  {sniperEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <ConfigRow label="MISMATCH THRESHOLD" value={sniperThreshold} onChange={setSniperThreshold} hint="Minimum mismatch score to fire (default 85)" />
              <ConfigRow label="MIN SIGNAL SCORE" value={sniperMinScore} onChange={setSniperMinScore} hint="Minimum absolute signal score (default 90)" />
              <ConfigRow label="POSITION SIZE (%)" value={sniperPosPct} onChange={setSniperPosPct} hint="% of starting capital per sniper trade" />
              <ConfigRow label="MAX SNIPER POSITIONS" value={sniperMaxPos} onChange={setSniperMaxPos} hint="Max concurrent sniper positions" />
              <div className="flex gap-2">
                <button onClick={async () => {
                  await fetch("/api/bot/sniper/config", { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ enabled: sniperEnabled, mismatch_threshold: parseFloat(sniperThreshold), min_signal_score: parseFloat(sniperMinScore), position_pct: parseFloat(sniperPosPct), max_sniper_positions: parseInt(sniperMaxPos) }) });
                  fetchAll();
                }} className="flex-1 text-xs text-purple-400 border border-purple-400/40 hover:bg-purple-400/10 py-2 rounded tracking-widest transition-colors font-bold">
                  SAVE SNIPER CONFIG
                </button>
                <button onClick={async () => { await fetch("/api/bot/sniper/run", { method: "POST", headers: authHeaders() }); fetchAll(); }}
                  className="text-xs text-terminal-dim border border-terminal-border hover:text-purple-400 hover:border-purple-400/40 px-3 py-2 rounded transition-colors">
                  FIRE NOW
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-terminal-dim text-xs tracking-widest">ACTIVE SNIPER POSITIONS</p>
              {status?.positions.filter(p => p.entry_reasoning?.includes("[SNIPER]")).length === 0 ? (
                <div className="border border-terminal-border/30 rounded-lg p-6 text-center text-terminal-dim text-sm">No active sniper positions</div>
              ) : status?.positions.filter(p => p.entry_reasoning?.includes("[SNIPER]")).map(pos => (
                <div key={pos.id} className="border border-purple-400/20 rounded-lg p-3 bg-purple-400/5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 font-bold">{pos.asset_label}</span>
                    <span className={pos.pnl_usd >= 0 ? "text-terminal-buy font-bold" : "text-terminal-sell font-bold"}>
                      {pos.pnl_usd >= 0 ? "+" : ""}${pos.pnl_usd.toFixed(3)} ({pos.pnl_pct >= 0 ? "+" : ""}{pos.pnl_pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="text-terminal-dim">{pos.entry_reasoning?.slice(0, 120)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-terminal-dim text-xs tracking-widest">PER-ASSET OVERRIDES — null = inherits global config</p>
          </div>
          {/* Add asset form */}
          <div className="border border-terminal-border/30 rounded-lg p-4 bg-terminal-card/20 space-y-3">
            <p className="text-terminal-accent text-xs font-bold tracking-widest">ADD ASSET OVERRIDE</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <input placeholder="Asset key (e.g. GOLD)" value={newAsset} onChange={e => setNewAsset(e.target.value.toUpperCase())}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent" />
              <input placeholder="Label (e.g. Gold)" value={newAssetLabel} onChange={e => setNewAssetLabel(e.target.value)}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent" />
              <select value={newAssetCat} onChange={e => setNewAssetCat(e.target.value)}
                className="bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent">
                {["Stock","Commodity","Currency","Index","Crypto","Sector","Fixed Income"].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={async () => {
              if (!newAsset || !newAssetLabel) return;
              await fetch(`/api/bot/assets/${newAsset}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ asset_label: newAssetLabel, category: newAssetCat }) });
              setNewAsset(""); setNewAssetLabel(""); fetchAll();
            }} className="text-xs text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 px-4 py-1.5 rounded transition-colors font-bold">
              ADD OVERRIDE
            </button>
          </div>
          {/* Asset table */}
          {assetCfgs.length === 0 ? (
            <div className="text-center text-terminal-dim py-8 text-sm">No per-asset overrides set. Global config applies to all assets.</div>
          ) : (
            <div className="border border-terminal-border/30 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-terminal-card/80 text-terminal-dim border-b border-terminal-border">
                    <th className="text-left px-3 py-2">ASSET</th>
                    <th className="text-center px-3 py-2">ENABLED</th>
                    <th className="text-center px-3 py-2">SNIPER ONLY</th>
                    <th className="text-right px-3 py-2">MIN SCORE</th>
                    <th className="text-right px-3 py-2">STOP LOSS</th>
                    <th className="text-right px-3 py-2">TAKE PROFIT</th>
                    <th className="text-right px-3 py-2">MAX POS%</th>
                    <th className="text-center px-3 py-2">DELETE</th>
                  </tr>
                </thead>
                <tbody>
                  {assetCfgs.map(ac => (
                    <tr key={ac.asset} className="border-b border-terminal-border/30 hover:bg-terminal-card/30 transition-colors">
                      <td className="px-3 py-2">
                        <span className="text-terminal-accent font-bold">{ac.asset_label}</span>
                        <span className="text-terminal-dim ml-1">({ac.asset})</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={async () => {
                          await fetch(`/api/bot/assets/${ac.asset}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ ...ac, enabled: !ac.enabled }) });
                          fetchAll();
                        }} className={`px-2 py-0.5 rounded border text-xs font-bold transition-colors ${ac.enabled ? "text-terminal-buy border-terminal-buy/30" : "text-terminal-dim border-terminal-border"}`}>
                          {ac.enabled ? "ON" : "OFF"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={async () => {
                          await fetch(`/api/bot/assets/${ac.asset}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ ...ac, sniper_only: !ac.sniper_only }) });
                          fetchAll();
                        }} className={`px-2 py-0.5 rounded border text-xs font-bold transition-colors ${ac.sniper_only ? "text-purple-400 border-purple-400/30" : "text-terminal-dim border-terminal-border"}`}>
                          {ac.sniper_only ? "YES" : "NO"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right text-terminal-dim">{ac.min_signal_score ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-terminal-sell">{ac.stop_loss_pct != null ? `${ac.stop_loss_pct}%` : "—"}</td>
                      <td className="px-3 py-2 text-right text-terminal-buy">{ac.take_profit_pct != null ? `${ac.take_profit_pct}%` : "—"}</td>
                      <td className="px-3 py-2 text-right text-terminal-dim">{ac.max_position_pct != null ? `${ac.max_position_pct}%` : "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={async () => { await fetch(`/api/bot/assets/${ac.asset}`, { method: "DELETE", headers: authHeaders() }); fetchAll(); }}
                          className="text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-0.5 rounded text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "grid" && (
        <div className="space-y-4">
          {/* Create grid form */}
          <div className="border border-cyan-400/20 rounded-lg p-4 bg-cyan-400/5 space-y-3">
            <p className="text-cyan-400 text-xs font-bold tracking-widest">CREATE GRID BOT</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <input placeholder="Asset key (e.g. GOLD)" value={newGrid.asset} onChange={e => setNewGrid(g => ({...g, asset: e.target.value.toUpperCase()}))}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-cyan-400" />
              <input placeholder="Label (e.g. Gold)" value={newGrid.asset_label} onChange={e => setNewGrid(g => ({...g, asset_label: e.target.value}))}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-cyan-400" />
              <input placeholder="Base price ($)" type="number" value={newGrid.base_price} onChange={e => setNewGrid(g => ({...g, base_price: e.target.value}))}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-cyan-400" />
              <input placeholder="Grid spacing (%)" type="number" value={newGrid.grid_spacing_pct} onChange={e => setNewGrid(g => ({...g, grid_spacing_pct: e.target.value}))}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-cyan-400" />
              <input placeholder="Levels (each side)" type="number" value={newGrid.num_levels} onChange={e => setNewGrid(g => ({...g, num_levels: e.target.value}))}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-cyan-400" />
              <input placeholder="Capital per level ($)" type="number" value={newGrid.capital_per_level} onChange={e => setNewGrid(g => ({...g, capital_per_level: e.target.value}))}
                className="bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-cyan-400" />
            </div>
            <button onClick={async () => {
              if (!newGrid.asset || !newGrid.base_price || !newGrid.capital_per_level) return;
              await fetch("/api/bot/grid", { method: "POST", headers: authHeaders(), body: JSON.stringify({ ...newGrid, base_price: parseFloat(newGrid.base_price), grid_spacing_pct: parseFloat(newGrid.grid_spacing_pct), num_levels: parseInt(newGrid.num_levels), capital_per_level: parseFloat(newGrid.capital_per_level) }) });
              setNewGrid({ asset: "", asset_label: "", category: "Stock", base_price: "", grid_spacing_pct: "2", num_levels: "5", capital_per_level: "" });
              fetchAll();
            }} className="text-xs text-cyan-400 border border-cyan-400/40 hover:bg-cyan-400/10 px-4 py-1.5 rounded transition-colors font-bold">
              CREATE GRID BOT
            </button>
            <p className="text-terminal-dim/60 text-xs">Grid places BUY orders below base price and SELL orders above. Profits from price oscillating between levels. Best for volatile sideways assets (crypto, gold).</p>
          </div>

          {/* Grid bots list */}
          {gridBots.length === 0 ? (
            <div className="text-center text-terminal-dim py-8 text-sm">No grid bots created yet.</div>
          ) : gridBots.map(bot => (
            <div key={bot.id} className="border border-cyan-400/20 rounded-lg bg-cyan-400/5 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded border font-bold ${bot.enabled ? "text-terminal-buy border-terminal-buy/40 animate-pulse" : "text-terminal-dim border-terminal-border"}`}>
                    {bot.enabled ? "● ON" : "○ OFF"}
                  </span>
                  <span className="text-terminal-text font-bold text-sm">{bot.asset_label}</span>
                  <span className="text-terminal-dim text-xs">Base: ${bot.base_price.toLocaleString()} · ±{bot.grid_spacing_pct}% · {bot.num_levels} levels · ${bot.capital_per_level}/level</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold font-mono ${bot.total_pnl >= 0 ? "text-terminal-buy" : "text-terminal-sell"}`}>
                    P&L: {bot.total_pnl >= 0 ? "+" : ""}${bot.total_pnl.toFixed(4)}
                  </span>
                  <span className="text-terminal-dim text-xs">{bot.open_orders} open · {bot.filled_orders} filled</span>
                  <button onClick={async () => { await fetch(`/api/bot/grid/${bot.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ enabled: !bot.enabled }) }); fetchAll(); }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${bot.enabled ? "text-red-400 border-red-400/30 hover:bg-red-400/10" : "text-terminal-buy border-terminal-buy/30 hover:bg-terminal-buy/10"}`}>
                    {bot.enabled ? "DISABLE" : "ENABLE"}
                  </button>
                  <button onClick={async () => {
                    const orders = await fetch(`/api/bot/grid/${bot.id}/orders`, { headers: authHeaders() }).then(r => r.json());
                    setGridOrders(prev => ({ ...prev, [bot.id]: orders }));
                    setExpandedGrid(expandedGrid === bot.id ? null : bot.id);
                  }} className="text-xs text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/10 px-2 py-1 rounded transition-colors">
                    {expandedGrid === bot.id ? "HIDE" : "ORDERS"}
                  </button>
                  <button onClick={async () => { if (confirm("Delete this grid bot?")) { await fetch(`/api/bot/grid/${bot.id}`, { method: "DELETE", headers: authHeaders() }); fetchAll(); } }}
                    className="text-xs text-red-400 border border-red-400/30 hover:bg-red-400/10 px-2 py-1 rounded transition-colors">✕</button>
                </div>
              </div>
              {expandedGrid === bot.id && gridOrders[bot.id] && (
                <div className="border-t border-cyan-400/20 px-4 py-3 max-h-64 overflow-y-auto">
                  <div className="space-y-1">
                    {gridOrders[bot.id].map(order => (
                      <div key={order.id} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${order.status === "FILLED" ? "opacity-40" : order.direction === "BUY" ? "bg-terminal-buy/5" : "bg-terminal-sell/5"}`}>
                        <span className={`font-bold w-8 text-center ${order.direction === "BUY" ? "text-terminal-buy" : "text-terminal-sell"}`}>{order.level > 0 ? "+" : ""}{order.level}</span>
                        <span className={order.direction === "BUY" ? "text-terminal-buy" : "text-terminal-sell"}>{order.direction}</span>
                        <span className="font-mono text-terminal-text">${order.price.toLocaleString()}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${order.status === "FILLED" ? "text-terminal-dim border-terminal-border" : order.direction === "BUY" ? "text-terminal-buy border-terminal-buy/30" : "text-terminal-sell border-terminal-sell/30"}`}>
                          {order.status}
                        </span>
                        {order.filled_price && <span className="text-terminal-dim">filled @ ${order.filled_price.toLocaleString()}</span>}
                        {order.pnl != null && order.pnl > 0 && <span className="text-terminal-buy font-bold">+${order.pnl.toFixed(4)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(activeTab === "standard") && <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Open Positions */}
        <div className="xl:col-span-2 space-y-3">
          <p className="text-terminal-dim text-xs tracking-widest">OPEN POSITIONS ({status.positions.length})</p>
          {status.positions.length === 0 ? (
            <div className="border border-terminal-border/30 rounded-lg p-8 text-center text-terminal-dim text-sm">
              {status.enabled ? "No open positions — bot is watching for signals..." : "Start the bot to begin trading"}
            </div>
          ) : (
            <div className="border border-terminal-border/30 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-terminal-accent/5 text-xs text-terminal-dim tracking-widest border-b border-terminal-border/30">
                <div className="col-span-3">ASSET</div>
                <div className="col-span-2 text-right">ENTRY</div>
                <div className="col-span-2 text-right">CURRENT</div>
                <div className="col-span-2 text-right">SIZE</div>
                <div className="col-span-2 text-right">P&L</div>
                <div className="col-span-1 text-right">SCORE</div>
              </div>
              {status.positions.map(pos => (
                <div key={pos.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-xs border-b border-terminal-border/20 hover:bg-terminal-card/30 transition-colors">
                  <div className="col-span-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1 py-0.5 rounded font-bold border ${pos.direction === "SELL" ? "text-terminal-sell border-terminal-sell/40 bg-terminal-sell/10" : "text-terminal-buy border-terminal-buy/40 bg-terminal-buy/10"}`}>
                        {pos.direction === "SELL" ? "SHORT" : "LONG"}
                      </span>
                      <span className="text-terminal-text font-semibold">{pos.asset_label}</span>
                    </div>
                    <div className="text-terminal-dim opacity-60 text-xs">{pos.asset}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-terminal-dim">${pos.entry_price < 1 ? pos.entry_price.toFixed(6) : pos.entry_price.toFixed(2)}</div>
                  <div className="col-span-2 text-right font-mono text-terminal-text">${pos.current_price < 1 ? pos.current_price.toFixed(6) : pos.current_price.toFixed(2)}</div>
                  <div className="col-span-2 text-right font-mono text-terminal-text">${pos.quantity_usd.toFixed(2)}</div>
                  <div className="col-span-2 text-right font-mono">
                    <span className={pos.pnl_usd >= 0 ? "text-terminal-buy font-bold" : "text-terminal-sell font-bold"}>
                      {pos.pnl_usd >= 0 ? "+" : ""}${pos.pnl_usd.toFixed(3)}
                      <span className="text-xs ml-1 opacity-70">({pos.pnl_pct >= 0 ? "+" : ""}{pos.pnl_pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="col-span-1 text-right font-mono text-terminal-accent">{pos.entry_signal_score?.toFixed(0)}</div>
                  <div className="col-span-12 text-terminal-dim opacity-60 text-xs truncate pl-0 pt-0.5">{pos.entry_reasoning}</div>
                </div>
              ))}
            </div>
          )}

          {/* Trade Log */}
          <p className="text-terminal-dim text-xs tracking-widest mt-4">TRADE LOG</p>
          <div className="border border-terminal-border/30 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            {trades.length === 0 ? (
              <div className="p-6 text-center text-terminal-dim text-xs">No trades yet</div>
            ) : (
              trades.map(t => (
                <div key={t.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-terminal-border/20 text-xs hover:bg-terminal-card/20">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded border text-xs font-bold ${ACTION_COLOR[t.action] ?? "text-terminal-dim border-terminal-border"}`}>
                    {t.action.replace("_", " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-terminal-text font-semibold">{t.asset_label}</span>
                    <span className="text-terminal-dim ml-2">@ ${t.price < 1 ? t.price.toFixed(6) : t.price.toFixed(2)}</span>
                    <span className="text-terminal-dim ml-2">${t.quantity_usd.toFixed(2)}</span>
                    {t.pnl != null && (
                      <span className={`ml-2 font-bold ${t.pnl >= 0 ? "text-terminal-buy" : "text-terminal-sell"}`}>
                        {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(3)}
                      </span>
                    )}
                    <p className="text-terminal-dim opacity-60 truncate mt-0.5">{t.reasoning}</p>
                  </div>
                  <span className="text-terminal-dim opacity-50 shrink-0">{new Date(t.created_at).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Config panel */}
        <div className="space-y-4">
          <p className="text-terminal-dim text-xs tracking-widest">BOT CONFIGURATION</p>
          <div className="border border-terminal-border/30 rounded-lg p-4 space-y-4 bg-terminal-card/20">

            <ConfigRow label="STARTING CAPITAL ($)" value={capital} onChange={setCapital}
              hint="Resets positions & cash" />
            <ConfigRow label="MIN SIGNAL SCORE" value={minScore} onChange={setMinScore}
              hint="Enter above this score (0-100)" />
            <ConfigRow label="MAX POSITION SIZE (%)" value={maxPos} onChange={setMaxPos}
              hint="% of capital per trade" />
            <ConfigRow label="STOP LOSS (%)" value={stopLoss} onChange={setStopLoss}
              hint="Exit if loss exceeds this %" />
            <ConfigRow label="TAKE PROFIT (%)" value={takeProfit} onChange={setTakeProfit}
              hint="Exit if gain exceeds this %" />
            <ConfigRow label="MAX OPEN POSITIONS" value={maxPositions} onChange={setMaxPositions}
              hint="Max concurrent trades" />

            <button onClick={saveConfig}
              className="w-full text-xs text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 py-2 rounded tracking-widest transition-colors font-bold">
              SAVE CONFIG
            </button>
          </div>

          {/* Risk summary */}
          <div className="border border-terminal-border/30 rounded-lg p-4 bg-terminal-card/20 space-y-2 text-xs">
            <p className="text-terminal-dim tracking-widest">RISK SUMMARY</p>
            <div className="space-y-1.5 text-terminal-dim">
              <div className="flex justify-between">
                <span>Stop loss per trade</span>
                <span className="text-terminal-sell font-bold">-{status.config.stop_loss_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span>Take profit per trade</span>
                <span className="text-terminal-buy font-bold">+{status.config.take_profit_pct}%</span>
              </div>
              <div className="flex justify-between">
                <span>Max capital at risk</span>
                <span className="text-terminal-text font-bold">
                  ${(status.starting_capital * status.config.max_positions * status.config.max_position_pct / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Signal threshold</span>
                <span className="text-terminal-accent font-bold">{status.config.min_signal_score}+</span>
              </div>
            </div>
          </div>

          <div className="border border-yellow-400/20 rounded-lg p-3 bg-yellow-400/5 text-xs text-yellow-400/80 leading-relaxed">
            <Activity size={11} className="inline mr-1" />
            This is a <strong>virtual portfolio</strong>. No real money is used. All trades are simulated using live market data.
          </div>
        </div>
      </div>}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="border border-terminal-border/30 rounded-lg p-3 bg-terminal-card/20 space-y-1">
      <div className="flex items-center gap-1.5 text-terminal-dim text-xs tracking-widest">
        {icon}{label}
      </div>
      <div className={`font-mono font-bold text-sm ${color}`}>{value}</div>
    </div>
  );
}

function ConfigRow({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  return (
    <div>
      <label className="block text-xs text-terminal-dim tracking-widest mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border border-terminal-border rounded px-2 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent font-mono"
      />
      <p className="text-terminal-dim text-xs opacity-50 mt-0.5">{hint}</p>
    </div>
  );
}
