import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Activity, PlayCircle, StopCircle,
  RefreshCw, Zap, DollarSign, BarChart2, Clock,
} from "lucide-react";

interface Position {
  id: string;
  asset: string;
  asset_label: string;
  category: string;
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
  STOP_LOSS:    "text-red-400 border-red-400/30 bg-red-400/10",
  TAKE_PROFIT:  "text-terminal-accent border-terminal-accent/30 bg-terminal-accent/10",
  SIGNAL_EXIT:  "text-orange-400 border-orange-400/30 bg-orange-400/10",
};

export default function BotPage() {
  const [status, setStatus]   = useState<BotStatus | null>(null);
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Config edit state
  const [capital, setCapital]     = useState("");
  const [minScore, setMinScore]   = useState("");
  const [maxPos, setMaxPos]       = useState("");
  const [stopLoss, setStopLoss]   = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [maxPositions, setMaxPositions] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        fetch("/api/bot/status",  { headers: authHeaders() }).then(r => r.json()),
        fetch("/api/bot/trades",  { headers: authHeaders() }).then(r => r.json()),
      ]);
      setStatus(s);
      setTrades(t);
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

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
                    <div className="text-terminal-text font-semibold">{pos.asset_label}</div>
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
      </div>
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
