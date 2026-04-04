import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Target, Activity } from "lucide-react";

interface SignalRecord {
  signal_id: string;
  date: string;
  news_title: string;
  news_url: string;
  severity: string;
  asset: string;
  asset_label: string;
  category: string;
  direction: string;
  confidence: number;
  entry_price: number | null;
  exit_price: number | null;
  pct_change: number | null;
  outcome: "CORRECT" | "WRONG" | "PENDING";
}

interface Stats {
  total_tracked: number;
  total_pending: number;
  overall_accuracy: number | null;
  buy_accuracy: number | null;
  sell_accuracy: number | null;
  total_buy: number;
  total_sell: number;
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400 border-red-400/40 bg-red-400/10",
  HIGH: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  MEDIUM: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  LOW: "text-terminal-dim border-terminal-border bg-terminal-card",
};

export default function SignalHistoryPage() {
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);
  const [filter, setFilter] = useState<"ALL" | "CORRECT" | "WRONG" | "PENDING">("ALL");
  const [dirFilter, setDirFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/signals/history?days=${days}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setSignals(data.signals || []);
        setStats(data.stats || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const filtered = signals.filter((s) => {
    if (filter !== "ALL" && s.outcome !== filter) return false;
    if (dirFilter !== "ALL" && s.direction !== dirFilter) return false;
    return true;
  });

  function AccuracyRing({ value, label, color }: { value: number | null; label: string; color: string }) {
    const pct = value ?? 0;
    const dash = 2 * Math.PI * 36;
    const offset = dash - (dash * pct) / 100;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="6" className="text-terminal-border" />
            <circle
              cx="40" cy="40" r="36" fill="none" strokeWidth="6"
              stroke={color} strokeLinecap="round"
              strokeDasharray={dash} strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold" style={{ color }}>
              {value !== null ? `${value}%` : "—"}
            </span>
          </div>
        </div>
        <span className="text-xs text-terminal-dim">{label}</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-terminal-accent text-sm font-bold tracking-widest flex items-center gap-2">
          <Activity size={14} /> SIGNAL HISTORY &amp; ACCURACY
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-terminal-dim text-xs">WINDOW:</span>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                days === d
                  ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
                  : "border-terminal-border text-terminal-dim hover:text-terminal-text"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-terminal-card border border-terminal-border rounded-lg p-6">
          {/* Accuracy rings */}
          <div className="flex items-center justify-around">
            <AccuracyRing value={stats.overall_accuracy} label="OVERALL" color="#00ff88" />
            <AccuracyRing value={stats.buy_accuracy} label="BUY SIGNALS" color="#00ccff" />
            <AccuracyRing value={stats.sell_accuracy} label="SELL SIGNALS" color="#ff4444" />
          </div>

          {/* Counters */}
          <div className="grid grid-cols-2 gap-3">
            <StatBox icon={<Target size={16} />} label="SIGNALS TRACKED" value={stats.total_tracked} color="text-terminal-accent" />
            <StatBox icon={<Clock size={16} />} label="PENDING" value={stats.total_pending} color="text-yellow-400" />
            <StatBox icon={<TrendingUp size={16} />} label="BUY SIGNALS" value={stats.total_buy} color="text-terminal-buy" />
            <StatBox icon={<TrendingDown size={16} />} label="SELL SIGNALS" value={stats.total_sell} color="text-terminal-sell" />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-terminal-dim text-xs">OUTCOME:</span>
        {(["ALL", "CORRECT", "WRONG", "PENDING"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              filter === f
                ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
                : "border-terminal-border text-terminal-dim hover:text-terminal-text"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="text-terminal-dim text-xs ml-4">DIRECTION:</span>
        {(["ALL", "BUY", "SELL"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setDirFilter(f)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              dirFilter === f
                ? f === "BUY"
                  ? "border-terminal-buy text-terminal-buy bg-terminal-buy/10"
                  : f === "SELL"
                  ? "border-terminal-sell text-terminal-sell bg-terminal-sell/10"
                  : "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
                : "border-terminal-border text-terminal-dim hover:text-terminal-text"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="text-terminal-dim text-xs ml-auto">{filtered.length} signals</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-terminal-dim">
          <div className="w-6 h-6 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
          <span className="text-sm">Analysing signal outcomes...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-terminal-dim py-16 text-sm">No signals found for selected filters.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-terminal-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-terminal-border bg-terminal-card/80 text-terminal-dim">
                <th className="text-left px-3 py-2 font-medium tracking-wider">DATE</th>
                <th className="text-left px-3 py-2 font-medium tracking-wider">ASSET</th>
                <th className="text-left px-3 py-2 font-medium tracking-wider">DIR</th>
                <th className="text-right px-3 py-2 font-medium tracking-wider">CONF</th>
                <th className="text-left px-3 py-2 font-medium tracking-wider">SEV</th>
                <th className="text-right px-3 py-2 font-medium tracking-wider">ENTRY</th>
                <th className="text-right px-3 py-2 font-medium tracking-wider">24H LATER</th>
                <th className="text-right px-3 py-2 font-medium tracking-wider">MOVE</th>
                <th className="text-center px-3 py-2 font-medium tracking-wider">OUTCOME</th>
                <th className="text-left px-3 py-2 font-medium tracking-wider">NEWS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={`${s.signal_id}-${s.asset}-${i}`}
                  className="border-b border-terminal-border/40 hover:bg-terminal-card/60 transition-colors"
                >
                  <td className="px-3 py-2 text-terminal-dim whitespace-nowrap">
                    {new Date(s.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="text-terminal-accent font-bold">{s.asset_label}</span>
                    <span className="text-terminal-dim ml-1">({s.category})</span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                        s.direction === "BUY"
                          ? "text-terminal-buy border-terminal-buy/40 bg-terminal-buy/10"
                          : "text-terminal-sell border-terminal-sell/40 bg-terminal-sell/10"
                      }`}
                    >
                      {s.direction}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-terminal-text">{s.confidence}%</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs border ${SEV_COLOR[s.severity] || SEV_COLOR.LOW}`}>
                      {s.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-terminal-dim">
                    {s.entry_price != null ? `$${s.entry_price.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-terminal-dim">
                    {s.exit_price != null ? `$${s.exit_price.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.pct_change != null ? (
                      <span className={s.pct_change >= 0 ? "text-terminal-buy" : "text-terminal-sell"}>
                        {s.pct_change >= 0 ? "+" : ""}{s.pct_change.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-terminal-dim">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {s.outcome === "CORRECT" ? (
                      <span className="flex items-center justify-center gap-1 text-terminal-buy">
                        <CheckCircle size={13} /> <span className="text-xs font-bold">CORRECT</span>
                      </span>
                    ) : s.outcome === "WRONG" ? (
                      <span className="flex items-center justify-center gap-1 text-terminal-sell">
                        <XCircle size={13} /> <span className="text-xs font-bold">WRONG</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1 text-yellow-400">
                        <Clock size={13} /> <span className="text-xs">PENDING</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    {s.news_url ? (
                      <a
                        href={s.news_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-terminal-dim hover:text-terminal-accent transition-colors truncate block"
                        title={s.news_title}
                      >
                        {s.news_title.length > 60 ? s.news_title.slice(0, 60) + "…" : s.news_title}
                      </a>
                    ) : (
                      <span className="text-terminal-dim truncate block" title={s.news_title}>
                        {s.news_title.length > 60 ? s.news_title.slice(0, 60) + "…" : s.news_title}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-terminal-bg border border-terminal-border rounded-lg p-3 flex flex-col gap-1">
      <div className={`flex items-center gap-1.5 ${color}`}>
        {icon}
        <span className="text-xs text-terminal-dim">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}
