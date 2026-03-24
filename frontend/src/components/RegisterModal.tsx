import { Bell, CheckCircle, X } from "lucide-react";
import { useState } from "react";

interface Props {
  onClose: () => void;
}

export default function RegisterModal({ onClose }: Props) {
  const [email, setEmail]     = useState("");
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Subscription failed.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md mx-4 bg-terminal-card border border-terminal-border rounded-2xl p-6 space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terminal-accent/10 border border-terminal-accent/30 flex items-center justify-center">
              <Bell size={20} className="text-terminal-accent" />
            </div>
            <div>
              <h2 className="text-terminal-text font-semibold text-base">Subscribe to Alerts</h2>
              <p className="text-terminal-dim text-xs">Get geopolitical trading signals delivered</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-terminal-dim hover:text-terminal-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle size={40} className="text-terminal-buy" />
            <p className="text-terminal-text font-medium">You're subscribed!</p>
            <p className="text-terminal-dim text-sm">
              We'll send you real-time geopolitical trading alerts.
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-sm text-terminal-accent hover:underline"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-terminal-dim text-xs tracking-widest">NAME (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2.5 text-sm text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-accent/60 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-terminal-dim text-xs tracking-widest">EMAIL *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@example.com"
                required
                className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-3 py-2.5 text-sm text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-accent/60 transition-colors"
              />
            </div>

            {error && (
              <p className="text-terminal-sell text-xs border border-terminal-sell/30 bg-terminal-sell/10 rounded px-3 py-2">
                {error}
              </p>
            )}

            <div className="text-terminal-dim text-xs border border-terminal-border/50 rounded-lg p-3 space-y-1">
              <p className="text-terminal-text font-medium text-xs">What you'll receive:</p>
              <p>• Real-time geopolitical event alerts</p>
              <p>• Buy / sell signal summaries</p>
              <p>• Affected market analysis</p>
              <p>• No spam — only high-severity events</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-terminal-accent hover:bg-terminal-accent/80 text-terminal-bg font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Subscribing..." : "Subscribe for Free Alerts"}
            </button>

            <p className="text-terminal-dim text-xs text-center">
              No credit card required. Unsubscribe anytime.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}