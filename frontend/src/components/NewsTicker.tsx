import type { SignalItem } from "../types";

interface Props {
  signals: SignalItem[];
}

export default function NewsTicker({ signals }: Props) {
  if (!signals.length) return null;

  const items = signals.slice(0, 15);

  return (
    <div className="border-b border-terminal-border bg-terminal-bg overflow-hidden">
      <div className="flex items-center">
        <div className="shrink-0 bg-terminal-accent text-terminal-bg text-xs font-bold px-3 py-1.5 z-10">
          LIVE
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex animate-ticker whitespace-nowrap">
            {items.map((s) => {
              const topSignal = s.market_signals[0];
              return (
                <span key={s.id} className="inline-flex items-center gap-2 px-6 text-xs text-terminal-dim">
                  <span className="text-terminal-text">{s.news_title.slice(0, 80)}</span>
                  {topSignal && (
                    <span
                      className={`font-semibold ${
                        topSignal.signal === "BUY" ? "text-terminal-buy" : "text-terminal-sell"
                      }`}
                    >
                      [{topSignal.asset_label} {topSignal.signal} {topSignal.confidence}%]
                    </span>
                  )}
                  <span className="text-terminal-border mx-2">|</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}