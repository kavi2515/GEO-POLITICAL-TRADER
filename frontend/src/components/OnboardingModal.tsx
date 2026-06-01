import { useState } from "react";
import { Globe, Zap, BarChart2, MessageSquare, TrendingUp, X, ChevronRight } from "lucide-react";

const STEPS = [
  {
    icon: <Zap size={32} className="text-terminal-accent" />,
    title: "Welcome to GeoTrader",
    desc: "You now have access to real-time geopolitical intelligence. Here's a quick tour of what you can do.",
    tip: null,
  },
  {
    icon: <TrendingUp size={32} className="text-terminal-accent" />,
    title: "Signals Feed",
    desc: "The Signals Feed shows live BUY/SELL signals generated from global news events. Each signal includes a confidence score and the geopolitical event driving it.",
    tip: "Start here — check it every morning for today's key market signals.",
  },
  {
    icon: <BarChart2 size={32} className="text-terminal-accent" />,
    title: "Live Markets",
    desc: "Track 87 assets across stocks, crypto, commodities, currencies, and indices. Click any asset to see its chart and the signals driving it.",
    tip: "Assets with active BUY/SELL signals sort to the top automatically.",
  },
  {
    icon: <Globe size={32} className="text-terminal-accent" />,
    title: "World Heatmap",
    desc: "See which countries are generating geopolitical stress. Countries glow red for CRITICAL alerts, orange for HIGH, yellow for MEDIUM.",
    tip: "Click any country to see which assets are affected by events there.",
  },
  {
    icon: <MessageSquare size={32} className="text-terminal-accent" />,
    title: "Thor AI & Pro Features",
    desc: "Upgrade to Pro to unlock Thor AI Chat, Signal History & Accuracy Tracker, AI Trade Bot, and Email Alerts.",
    tip: "Pro is $19/month — cancel anytime. Click ⭐ UPGRADE in the nav to get started.",
  },
];

export default function OnboardingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      localStorage.setItem("geotrader_onboarded", "true");
      onClose();
    } else {
      setStep(s => s + 1);
    }
  }

  function skip() {
    localStorage.setItem("geotrader_onboarded", "true");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-terminal-bg border border-terminal-accent/30 rounded-2xl p-6 max-w-md w-full space-y-5 relative">

        {/* Close */}
        <button onClick={skip} className="absolute top-4 right-4 text-terminal-dim hover:text-terminal-text transition-colors">
          <X size={16} />
        </button>

        {/* Step indicator */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-terminal-accent" : "bg-terminal-border"}`} />
          ))}
        </div>

        {/* Content */}
        <div className="text-center space-y-3 py-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-terminal-accent/10 border border-terminal-accent/20 flex items-center justify-center">
              {current.icon}
            </div>
          </div>
          <h3 className="text-terminal-text font-bold text-lg">{current.title}</h3>
          <p className="text-terminal-dim text-sm leading-relaxed">{current.desc}</p>
          {current.tip && (
            <div className="bg-terminal-accent/10 border border-terminal-accent/20 rounded-lg px-4 py-2.5 text-xs text-terminal-accent text-left">
              <span className="font-bold">TIP: </span>{current.tip}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button onClick={skip} className="text-xs text-terminal-dim hover:text-terminal-text transition-colors">
            Skip tour
          </button>
          <button onClick={next}
            className="flex items-center gap-1.5 text-xs text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 px-5 py-2 rounded-lg font-bold transition-colors">
            {isLast ? "Let's Go!" : "Next"} <ChevronRight size={12} />
          </button>
        </div>

        <p className="text-center text-terminal-dim/40 text-xs">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
