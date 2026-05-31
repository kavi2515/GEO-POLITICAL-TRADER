import { useState } from "react";
import { Check, X, Zap, Crown, RefreshCw } from "lucide-react";

interface Props {
  isPro: boolean;
  onUpgraded?: () => void;
}

const FREE_FEATURES = [
  { label: "Live geopolitical signals (last 24h)", included: true },
  { label: "Live Markets — 87 assets", included: true },
  { label: "World Heatmap", included: true },
  { label: "Portfolio Tracker", included: true },
  { label: "Watchlist", included: true },
  { label: "Trade Recommendations", included: true },
  { label: "Signal History & Accuracy", included: false },
  { label: "Thor AI Chat (Claude)", included: false },
  { label: "7-day signal history", included: false },
  { label: "Email Alerts", included: false },
  { label: "Priority signal feed", included: false },
];

const PRO_FEATURES = FREE_FEATURES.map(f => ({ ...f, included: true }));

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" };
}

export default function PricingPage({ isPro, onUpgraded }: Props) {
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  async function upgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Payment system error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function manageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/payments/portal", {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Could not open billing portal. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-terminal-accent text-lg font-bold tracking-widest glow-accent">GEOTRADER PLANS</h2>
        <p className="text-terminal-dim text-sm">Intelligence-grade geopolitical trading signals</p>
        {isPro && (
          <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400 border border-yellow-400/40 bg-yellow-400/10 px-3 py-1 rounded-full font-bold">
            <Crown size={11} /> YOU ARE ON PRO
          </span>
        )}
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Free plan */}
        <div className={`border rounded-xl p-6 space-y-5 ${isPro ? "border-terminal-border/30 opacity-60" : "border-terminal-border/50"} bg-terminal-card/20`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-terminal-dim" />
              <span className="text-terminal-text font-bold tracking-widest text-sm">FREE</span>
            </div>
            <div className="text-3xl font-bold text-terminal-text font-mono">$0</div>
            <div className="text-terminal-dim text-xs mt-1">Forever free · No card required</div>
          </div>

          <div className="space-y-2">
            {FREE_FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {f.included
                  ? <Check size={13} className="text-terminal-buy shrink-0" />
                  : <X size={13} className="text-terminal-dim/40 shrink-0" />}
                <span className={f.included ? "text-terminal-dim" : "text-terminal-dim/40"}>{f.label}</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-terminal-dim text-center py-2 border border-terminal-border/30 rounded-lg">
            {isPro ? "Your previous plan" : "Current plan"}
          </div>
        </div>

        {/* Pro plan */}
        <div className={`border rounded-xl p-6 space-y-5 relative overflow-hidden ${
          isPro
            ? "border-yellow-400/50 bg-yellow-400/5"
            : "border-terminal-accent/50 bg-terminal-accent/5"
        }`}>
          {!isPro && (
            <div className="absolute top-3 right-3 text-xs text-terminal-bg bg-terminal-accent px-2 py-0.5 rounded font-bold">
              RECOMMENDED
            </div>
          )}
          {isPro && (
            <div className="absolute top-3 right-3 text-xs text-terminal-bg bg-yellow-400 px-2 py-0.5 rounded font-bold flex items-center gap-1">
              <Crown size={10} /> ACTIVE
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown size={16} className={isPro ? "text-yellow-400" : "text-terminal-accent"} />
              <span className={`font-bold tracking-widest text-sm ${isPro ? "text-yellow-400" : "text-terminal-accent"}`}>PRO</span>
            </div>
            <div className={`text-3xl font-bold font-mono ${isPro ? "text-yellow-400" : "text-terminal-accent"}`}>
              $19<span className="text-lg text-terminal-dim font-normal">/mo</span>
            </div>
            <div className="text-terminal-dim text-xs mt-1">Cancel anytime · Instant access</div>
          </div>

          <div className="space-y-2">
            {PRO_FEATURES.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Check size={13} className={`shrink-0 ${isPro ? "text-yellow-400" : "text-terminal-buy"}`} />
                <span className="text-terminal-dim">{f.label}</span>
              </div>
            ))}
          </div>

          {isPro ? (
            <button
              onClick={manageSubscription}
              disabled={portalLoading}
              className="w-full text-xs text-yellow-400 border border-yellow-400/40 hover:bg-yellow-400/10 py-3 rounded-lg transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {portalLoading ? <RefreshCw size={12} className="animate-spin" /> : <Crown size={12} />}
              MANAGE SUBSCRIPTION
            </button>
          ) : (
            <button
              onClick={upgrade}
              disabled={loading}
              className="w-full text-xs text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 py-3 rounded-lg transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
              {loading ? "REDIRECTING TO CHECKOUT..." : "UPGRADE TO PRO — $19/mo"}
            </button>
          )}
        </div>
      </div>

      {/* Trust signals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs text-terminal-dim">
        <div className="border border-terminal-border/20 rounded-lg p-3">
          <div className="text-terminal-accent font-bold mb-1">🔒 SECURE</div>
          Payments via Stripe. We never store card details.
        </div>
        <div className="border border-terminal-border/20 rounded-lg p-3">
          <div className="text-terminal-accent font-bold mb-1">⚡ INSTANT</div>
          Pro features unlock immediately after payment.
        </div>
        <div className="border border-terminal-border/20 rounded-lg p-3">
          <div className="text-terminal-accent font-bold mb-1">↩ CANCEL ANYTIME</div>
          No lock-in. Cancel from your billing portal.
        </div>
      </div>

      <p className="text-center text-terminal-dim/50 text-xs">
        GeoTrader uses virtual portfolios for simulation only. Nothing on this platform is financial advice.
      </p>
    </div>
  );
}
