import { ChevronDown, ChevronUp, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import type { MarketSignal, SignalItem } from "../types";

interface Props {
  item: SignalItem;
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "border-red-500/40 bg-red-500/5",
  HIGH:     "border-orange-500/40 bg-orange-500/5",
  MEDIUM:   "border-yellow-500/30 bg-yellow-500/5",
  LOW:      "border-terminal-border bg-terminal-card",
};

const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH:     "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  LOW:      "bg-blue-500/20 text-blue-400 border-blue-500/40",
};

export default function SignalCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);

  const topSignals = item.market_signals.slice(0, expanded ? 8 : 4);
  const relativeTime = getRelativeTime(item.published_at);
  const sentiment = item.sentiment;

  return (
    <article
      className={`rounded-xl border p-4 space-y-3 animate-slide-up transition-all ${
        SEVERITY_STYLES[item.severity] ?? SEVERITY_STYLES.LOW
      }`}
    >
      {/* Top row: badges + meta */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`border rounded px-2 py-0.5 font-semibold ${
            SEVERITY_BADGE[item.severity] ?? ""
          }`}
        >
          {item.severity}
        </span>
        <EventBadge label={item.event_label} />
        <span className="text-terminal-dim ml-auto">{item.source}</span>
        <span className="text-terminal-dim">·</span>
        <span className="text-terminal-dim">{relativeTime}</span>
      </div>

      {/* Headline */}
      <div>
        <h3 className="text-terminal-text font-medium text-sm leading-snug">
          {item.news_title}
        </h3>
        {item.news_summary && (
          <p className="text-terminal-dim text-xs mt-1 leading-relaxed line-clamp-2">
            {item.news_summary}
          </p>
        )}
      </div>

      {/* Entities + sentiment */}
      <div className="flex flex-wrap items-center gap-2">
        {item.entities.map((e) => (
          <span
            key={e}
            className="text-xs border border-terminal-border text-terminal-dim px-1.5 py-0.5 rounded"
          >
            {e}
          </span>
        ))}
        <span
          className={`ml-auto text-xs font-mono ${
            sentiment >= 0.1
              ? "text-terminal-buy"
              : sentiment <= -0.1
              ? "text-terminal-sell"
              : "text-terminal-dim"
          }`}
        >
          {sentiment >= 0.1 ? "+" : ""}
          {sentiment.toFixed(2)} SENT
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-terminal-border/50" />

      {/* Market signals */}
      <div className="space-y-2">
        <p className="text-terminal-dim text-xs tracking-widest">MARKET SIGNALS</p>
        <div className="space-y-1.5">
          {topSignals.map((ms) => (
            <SignalRow key={ms.asset} signal={ms} showReason={expanded} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        {item.market_signals.length > 4 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs text-terminal-dim hover:text-terminal-accent transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp size={12} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={12} /> +{item.market_signals.length - 4} more signals
              </>
            )}
          </button>
        )}
        {item.news_url && (
          <a
            href={item.news_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-terminal-dim hover:text-terminal-accent transition-colors"
          >
            Source <ExternalLink size={11} />
          </a>
        )}
      </div>
    </article>
  );
}

function SignalRow({ signal, showReason }: { signal: MarketSignal; showReason: boolean }) {
  const isBuy = signal.signal === "BUY";
  const barColor = isBuy ? "bg-terminal-buy" : "bg-terminal-sell";
  const textColor = isBuy ? "text-terminal-buy" : "text-terminal-sell";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        {/* Direction icon */}
        <span className={`shrink-0 ${textColor}`}>
          {isBuy ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        </span>

        {/* Asset name */}
        <span className="text-terminal-text text-xs w-28 truncate">{signal.asset_label}</span>

        {/* Confidence bar */}
        <div className="flex-1 h-1.5 bg-terminal-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${signal.confidence}%` }}
          />
        </div>

        {/* Signal + confidence */}
        <span className={`text-xs font-mono font-semibold w-20 text-right ${textColor}`}>
          {signal.signal} {signal.confidence}%
        </span>

        {/* Category tag */}
        <span className="hidden sm:inline text-xs text-terminal-dim w-20 text-right">
          {signal.category}
        </span>
      </div>
      {showReason && (
        <p className="text-terminal-dim text-xs pl-5 italic leading-relaxed">
          {signal.reasoning}
        </p>
      )}
    </div>
  );
}

function EventBadge({ label }: { label: string }) {
  return (
    <span className="bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/20 rounded px-2 py-0.5 text-xs">
      {label}
    </span>
  );
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}