import { useState } from "react";
import { Globe, Zap, TrendingUp, Shield, BarChart2, MessageSquare, Crown, Check, ChevronRight } from "lucide-react";

interface Props {
  onGetStarted: () => void;
}

const FEATURES = [
  {
    icon: <Globe size={20} className="text-terminal-accent" />,
    title: "Real-Time Geopolitical Signals",
    desc: "AI analyses 23+ global news sources every 15 minutes to generate BUY/SELL signals based on geopolitical events.",
  },
  {
    icon: <BarChart2 size={20} className="text-terminal-accent" />,
    title: "87 Assets Tracked",
    desc: "Stocks, crypto, commodities, currencies, indices — all mapped to geopolitical events in real time.",
  },
  {
    icon: <Zap size={20} className="text-terminal-accent" />,
    title: "AI Trade Bot",
    desc: "Virtual portfolio bot with sniper, grid, and standard strategies. Trades automatically on high-confidence signals.",
  },
  {
    icon: <MessageSquare size={20} className="text-terminal-accent" />,
    title: "Thor AI Chat",
    desc: "Ask Thor — our Claude-powered AI — anything about current signals, market conditions, or geopolitical risks.",
  },
  {
    icon: <TrendingUp size={20} className="text-terminal-accent" />,
    title: "Signal Accuracy Tracker",
    desc: "Every signal is tracked against 24h price movement. See exactly how accurate our intelligence is.",
  },
  {
    icon: <Shield size={20} className="text-terminal-accent" />,
    title: "World Heatmap",
    desc: "Visual geopolitical stress map. See which countries are generating CRITICAL alerts and which assets are affected.",
  },
];

const STEPS = [
  { num: "01", title: "Global Events Detected", desc: "Our AI monitors 23+ news sources including Reuters, BBC, Al Jazeera, and financial feeds 24/7." },
  { num: "02", title: "NLP Analysis", desc: "Natural language processing scores each event for market impact, entities, and signal direction." },
  { num: "03", title: "Trading Signals", desc: "BUY/SELL signals with confidence scores are generated and mapped to affected assets instantly." },
];

const FREE_FEATURES = ["Live signals (24h)", "87 assets tracked", "Live Markets", "Portfolio Tracker", "World Heatmap", "Watchlist"];
const PRO_FEATURES  = ["Everything in Free", "7-day signal history", "Signal Accuracy Tracker", "Thor AI Chat", "AI Trade Bot", "Email Alerts"];

export default function LandingPage({ onGetStarted }: Props) {
  const [showVideo, setShowVideo] = useState(false);

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono">

      {/* Nav */}
      <nav className="border-b border-terminal-border/30 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-terminal-accent font-bold text-xl tracking-tight">GEO</span>
          <span className="text-terminal-text font-light text-xl tracking-tight">TRADER</span>
          <span className="hidden sm:block text-terminal-dim text-xs border border-terminal-border px-2 py-0.5 rounded ml-2">
            INTELLIGENCE TERMINAL
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onGetStarted}
            className="text-xs text-terminal-dim hover:text-terminal-accent border border-terminal-border hover:border-terminal-accent/40 px-3 py-1.5 rounded transition-colors">
            SIGN IN
          </button>
          <button onClick={onGetStarted}
            className="text-xs text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 px-3 py-1.5 rounded font-bold transition-colors">
            GET STARTED FREE
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 text-xs text-terminal-buy border border-terminal-buy/30 bg-terminal-buy/10 px-3 py-1 rounded-full animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-terminal-buy" /> LIVE — Signals updating every 15 minutes
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
          <span className="text-terminal-accent glow-accent">Geopolitical Intelligence</span>
          <br />
          <span className="text-terminal-text">for Smarter Trading</span>
        </h1>
        <p className="text-terminal-dim text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          GeoTrader monitors global news 24/7 and converts geopolitical events into actionable trading signals for stocks, crypto, commodities and more.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={onGetStarted}
            className="flex items-center gap-2 text-sm text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 px-6 py-3 rounded-lg font-bold transition-colors">
            <Zap size={14} /> Start Free — No Card Required
          </button>
          <button onClick={onGetStarted}
            className="flex items-center gap-2 text-sm text-terminal-dim border border-terminal-border hover:text-terminal-accent hover:border-terminal-accent/40 px-6 py-3 rounded-lg transition-colors">
            View Live Signals <ChevronRight size={14} />
          </button>
        </div>
        <p className="text-terminal-dim/50 text-xs">
          Virtual portfolio only · Not financial advice · Cancel anytime
        </p>
      </section>

      {/* Stats bar */}
      <section className="border-y border-terminal-border/30 bg-terminal-card/20 py-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 px-6 text-center">
          {[
            { value: "87", label: "Assets Tracked" },
            { value: "23+", label: "News Sources" },
            { value: "15min", label: "Signal Refresh" },
            { value: "24/7", label: "AI Monitoring" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-2xl font-bold text-terminal-accent font-mono glow-accent">{s.value}</div>
              <div className="text-terminal-dim text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <p className="text-terminal-accent text-xs tracking-widest font-bold">HOW IT WORKS</p>
          <h2 className="text-2xl font-bold text-terminal-text">From Global Events to Trading Signals</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step, i) => (
            <div key={i} className="border border-terminal-border/30 rounded-xl p-5 bg-terminal-card/20 space-y-3">
              <div className="text-terminal-accent font-bold text-2xl font-mono glow-accent">{step.num}</div>
              <h3 className="text-terminal-text font-bold text-sm">{step.title}</h3>
              <p className="text-terminal-dim text-xs leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-terminal-card/10 border-y border-terminal-border/20">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <p className="text-terminal-accent text-xs tracking-widest font-bold">FEATURES</p>
            <h2 className="text-2xl font-bold text-terminal-text">Everything You Need to Trade Geopolitics</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="border border-terminal-border/30 rounded-xl p-5 bg-terminal-bg space-y-3 hover:border-terminal-accent/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-terminal-accent/10 border border-terminal-accent/20 flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="text-terminal-text font-bold text-sm">{f.title}</h3>
                <p className="text-terminal-dim text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-16 max-w-4xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <p className="text-terminal-accent text-xs tracking-widest font-bold">PRICING</p>
          <h2 className="text-2xl font-bold text-terminal-text">Simple, Transparent Pricing</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <div className="border border-terminal-border/40 rounded-xl p-6 space-y-5 bg-terminal-card/20">
            <div>
              <p className="text-terminal-dim text-xs font-bold tracking-widest mb-2">FREE</p>
              <div className="text-3xl font-bold font-mono text-terminal-text">$0</div>
              <p className="text-terminal-dim text-xs mt-1">Forever free</p>
            </div>
            <div className="space-y-2">
              {FREE_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-terminal-dim">
                  <Check size={12} className="text-terminal-buy shrink-0" /> {f}
                </div>
              ))}
            </div>
            <button onClick={onGetStarted}
              className="w-full text-xs text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 py-2.5 rounded-lg font-bold transition-colors">
              GET STARTED FREE
            </button>
          </div>
          {/* Pro */}
          <div className="border border-terminal-accent/50 rounded-xl p-6 space-y-5 bg-terminal-accent/5 relative">
            <div className="absolute top-3 right-3 text-xs text-terminal-bg bg-terminal-accent px-2 py-0.5 rounded font-bold">
              POPULAR
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown size={14} className="text-terminal-accent" />
                <p className="text-terminal-accent text-xs font-bold tracking-widest">PRO</p>
              </div>
              <div className="text-3xl font-bold font-mono text-terminal-accent">$19<span className="text-lg text-terminal-dim font-normal">/mo</span></div>
              <p className="text-terminal-dim text-xs mt-1">Cancel anytime</p>
            </div>
            <div className="space-y-2">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-terminal-dim">
                  <Check size={12} className="text-terminal-buy shrink-0" /> {f}
                </div>
              ))}
            </div>
            <button onClick={onGetStarted}
              className="w-full text-xs text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 py-2.5 rounded-lg font-bold transition-colors">
              START WITH PRO
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center border-t border-terminal-border/30 bg-terminal-card/10">
        <div className="max-w-2xl mx-auto space-y-5">
          <h2 className="text-2xl font-bold text-terminal-text">Ready to Trade with Intelligence?</h2>
          <p className="text-terminal-dim text-sm">Join GeoTrader and get real-time geopolitical trading signals — free forever, upgrade anytime.</p>
          <button onClick={onGetStarted}
            className="inline-flex items-center gap-2 text-sm text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 px-8 py-3 rounded-lg font-bold transition-colors">
            <Zap size={14} /> Get Started Free
          </button>
          <p className="text-terminal-dim/40 text-xs">Virtual portfolio only. Not financial advice. © 2026 GeoTrader — Kavi Godithi.</p>
        </div>
      </section>

    </div>
  );
}
