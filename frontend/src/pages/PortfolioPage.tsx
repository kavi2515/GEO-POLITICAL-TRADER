import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Trash2, CheckCircle, Briefcase } from "lucide-react";

interface PortfolioItem {
  id: string;
  signal_id: string;
  news_title: string;
  asset: string;
  asset_label: string;
  category: string;
  direction: "BUY" | "SELL";
  confidence: number;
  entry_price: number | null;
  notes: string | null;
  status: "OPEN" | "CLOSED";
  created_at: string;
}

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    fetch("/api/portfolio", { headers: getHeaders() })
      .then(r => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function closeTrade(id: string) {
    const r = await fetch(`/api/portfolio/${id}/close`, { method: "PATCH", headers: getHeaders() });
    if (r.ok) setItems(items => items.map(i => i.id === id ? { ...i, status: "CLOSED" } : i));
  }

  async function removeTrade(id: string) {
    const r = await fetch(`/api/portfolio/${id}`, { method: "DELETE", headers: getHeaders() });
    if (r.ok) setItems(items => items.filter(i => i.id !== id));
  }

  const open = items.filter(i => i.status === "OPEN");
  const closed = items.filter(i => i.status === "CLOSED");

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
    </div>
  );

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-terminal-dim">
      <Briefcase size={32} className="text-terminal-accent/40" />
      <p className="text-sm">No trades tracked yet.</p>
      <p className="text-xs">Go to TRADE RECOMMENDATIONS and click "Track" on any signal.</p>
    </div>
  );

  return (
    <div className="p-4 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Briefcase size={16} className="text-terminal-accent" />
        <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">MY PORTFOLIO</h2>
        <span className="text-terminal-dim text-xs">— {open.length} open · {closed.length} closed</span>
      </div>

      {open.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-terminal-text text-xs tracking-widest font-bold">OPEN TRADES</h3>
          {open.map(item => <TradeCard key={item.id} item={item} onClose={closeTrade} onRemove={removeTrade} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-3 opacity-60">
          <h3 className="text-terminal-dim text-xs tracking-widest font-bold">CLOSED TRADES</h3>
          {closed.map(item => <TradeCard key={item.id} item={item} onClose={closeTrade} onRemove={removeTrade} />)}
        </div>
      )}
    </div>
  );
}

function TradeCard({ item, onClose, onRemove }: { item: PortfolioItem; onClose: (id: string) => void; onRemove: (id: string) => void }) {
  const isBuy = item.direction === "BUY";
  const borderColor = isBuy ? "border-terminal-buy/30" : "border-terminal-sell/30";
  const bgColor = isBuy ? "bg-terminal-buy/5" : "bg-terminal-sell/5";
  const textColor = isBuy ? "text-terminal-buy glow-buy" : "text-terminal-sell glow-sell";

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={textColor}>{isBuy ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span>
          <div>
            <div className={`font-bold text-sm ${textColor}`}>{item.asset_label}</div>
            <div className="text-terminal-dim text-xs">{item.category} · {item.confidence}% confidence</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.status === "OPEN" && (
            <button onClick={() => onClose(item.id)} title="Close trade" className="text-terminal-dim hover:text-terminal-buy transition-colors p-1">
              <CheckCircle size={14} />
            </button>
          )}
          <button onClick={() => onRemove(item.id)} title="Remove" className="text-terminal-dim hover:text-terminal-sell transition-colors p-1">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-terminal-dim text-xs mt-2 line-clamp-1">{item.news_title}</p>
      {item.entry_price && <p className="text-terminal-text text-xs mt-1">Entry: ${item.entry_price}</p>}
      {item.notes && <p className="text-terminal-dim text-xs italic mt-1">{item.notes}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs px-2 py-0.5 rounded border ${item.status === "OPEN" ? "text-terminal-buy border-terminal-buy/30 bg-terminal-buy/10" : "text-terminal-dim border-terminal-border"}`}>
          {item.status}
        </span>
        <span className="text-terminal-dim text-xs">{new Date(item.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
