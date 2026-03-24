import { TrendingDown, TrendingUp, Activity, Zap } from "lucide-react";
import type { Stats } from "../types";

interface Props {
  stats: Stats | null;
}

export default function StatsBar({ stats }: Props) {
  if (!stats) return null;

  const total = stats.buy_signals + stats.sell_signals || 1;
  const buyPct = Math.round((stats.buy_signals / total) * 100);
  const sellPct = 100 - buyPct;

  return (
    <div className="border-b border-terminal-border bg-terminal-card/50">
      <div className="max-w-screen-2xl mx-auto px-4 py-2">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Signal count */}
          <StatChip
            icon={<Activity size={12} />}
            label="SIGNALS"
            value={stats.total_signals}
            color="text-terminal-accent"
          />

          {/* Buy */}
          <StatChip
            icon={<TrendingUp size={12} />}
            label="BUY"
            value={stats.buy_signals}
            color="text-terminal-buy"
          />

          {/* Sell */}
          <StatChip
            icon={<TrendingDown size={12} />}
            label="SELL"
            value={stats.sell_signals}
            color="text-terminal-sell"
          />

          {/* Sentiment bar */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-terminal-dim">SENTIMENT</span>
            <div className="flex h-2 w-24 rounded overflow-hidden">
              <div
                className="bg-terminal-buy transition-all"
                style={{ width: `${buyPct}%` }}
              />
              <div
                className="bg-terminal-sell transition-all"
                style={{ width: `${sellPct}%` }}
              />
            </div>
            <span className="text-terminal-buy">{buyPct}%</span>
            <span className="text-terminal-dim">/</span>
            <span className="text-terminal-sell">{sellPct}%</span>
          </div>

          {/* Top asset */}
          {stats.top_assets[0] && (
            <div className="flex items-center gap-1 ml-auto">
              <Zap size={12} className="text-terminal-hold" />
              <span className="text-terminal-dim">TOP ASSET:</span>
              <span className="text-terminal-text font-semibold">
                {stats.top_assets[0].asset}
              </span>
              <span className="text-terminal-dim">({stats.top_assets[0].count})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-terminal-dim">{label}:</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}