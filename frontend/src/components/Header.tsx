import { RefreshCw, Wifi, WifiOff, Bell } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  newCount: number;
  loading: boolean;
  onRefresh: () => void;
  onRegister: () => void;
}

export default function Header({ newCount, loading, onRefresh, onRegister }: Props) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatTime = (d: Date) =>
    d.toUTCString().replace("GMT", "UTC").split(" ").slice(-2).join(" ");

  return (
    <header className="border-b border-terminal-border bg-terminal-card sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-terminal-accent font-bold text-lg tracking-tight">GEO</span>
            <span className="text-terminal-text font-light text-lg tracking-tight">TRADER</span>
          </div>
          <span className="hidden sm:block text-terminal-dim text-xs border border-terminal-border px-2 py-0.5 rounded">
            INTELLIGENCE TERMINAL
          </span>
        </div>

        {/* Center: live clock + status */}
        <div className="hidden md:flex items-center gap-4 text-xs text-terminal-dim font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-terminal-buy animate-pulse-glow" />
            <span className="text-terminal-buy">LIVE</span>
          </div>
          <span className="text-terminal-text">{formatTime(time)}</span>
          <div className="flex items-center gap-1 text-terminal-dim">
            <Wifi size={12} className="text-terminal-accent" />
            <span>RSS FEEDS ACTIVE</span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <span className="text-xs bg-terminal-buy/20 text-terminal-buy border border-terminal-buy/30 px-2 py-1 rounded animate-pulse">
              +{newCount} NEW
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-terminal-dim hover:text-terminal-accent border border-terminal-border hover:border-terminal-accent/50 px-3 py-1.5 rounded transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">REFRESH</span>
          </button>
          <button
            onClick={onRegister}
            className="flex items-center gap-1.5 text-xs text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 px-3 py-1.5 rounded font-semibold transition-colors"
          >
            <Bell size={12} />
            <span>ALERTS</span>
          </button>
        </div>
      </div>
    </header>
  );
}