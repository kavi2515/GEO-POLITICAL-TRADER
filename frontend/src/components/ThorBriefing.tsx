import { useState, useEffect } from "react";
import { Volume2, VolumeX, RefreshCw, Zap } from "lucide-react";

interface BriefingData {
  text: string;
  weather: string;
  signals: { title: string; severity: string; event: string; entities: string[] }[];
  bot_positions: number;
  generated_at: string;
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-400",
  HIGH: "text-orange-400",
  MEDIUM: "text-yellow-400",
  LOW: "text-terminal-dim",
};

export default function ThorBriefing({ userName }: { userName: string }) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Load available voices (browser may load them async)
    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices());
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  async function fetchBriefing() {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const data: BriefingData = await fetch("/api/briefing/today", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json());
      setBriefing(data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  function pickVoice(): SpeechSynthesisVoice | null {
    // Prefer deep English male voices
    const preferred = ["Daniel", "David", "Alex", "Google UK English Male", "en-GB"];
    for (const name of preferred) {
      const v = voices.find(v => v.name.includes(name) || v.lang === name);
      if (v) return v;
    }
    // Fallback: any English voice
    return voices.find(v => v.lang.startsWith("en")) || null;
  }

  function speak(text: string) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utt.voice = voice;
    utt.rate = 0.88;
    utt.pitch = 0.75;
    utt.volume = 1;
    utt.onstart = () => setPlaying(true);
    utt.onend = () => setPlaying(false);
    utt.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utt);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  async function playBriefing() {
    let data = briefing;
    if (!data) {
      data = await fetchBriefing();
    }
    if (data) speak(data.text);
  }

  async function refreshAndPlay() {
    const data = await fetchBriefing();
    if (data) speak(data.text);
  }

  return (
    <div className="border border-yellow-400/30 rounded-lg bg-yellow-400/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-yellow-400/20 border border-yellow-400/50 flex items-center justify-center shrink-0">
            <Zap size={18} className="text-yellow-400" />
          </div>
          <div>
            <p className="text-yellow-400 text-xs font-bold tracking-widest">THOR — DAILY INTELLIGENCE BRIEFING</p>
            <p className="text-terminal-dim text-xs">
              {briefing
                ? `Generated ${new Date(briefing.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : `Good day, ${userName}. Ready to brief.`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {briefing && (
            <button
              onClick={refreshAndPlay}
              disabled={loading}
              title="Refresh & replay"
              className="text-xs text-terminal-dim border border-terminal-border hover:text-yellow-400 hover:border-yellow-400/30 px-2 py-1.5 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            </button>
          )}
          {playing ? (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 text-xs text-red-400 border border-red-400/40 hover:bg-red-400/10 px-3 py-1.5 rounded transition-colors font-bold"
            >
              <VolumeX size={11} /> STOP
            </button>
          ) : (
            <button
              onClick={playBriefing}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-yellow-400 border border-yellow-400/40 hover:bg-yellow-400/10 px-3 py-1.5 rounded transition-colors font-bold disabled:opacity-50"
            >
              {loading ? <RefreshCw size={11} className="animate-spin" /> : <Volume2 size={11} />}
              {loading ? "LOADING..." : "▶ PLAY BRIEFING"}
            </button>
          )}
        </div>
      </div>

      {/* Briefing content */}
      {briefing ? (
        <div className="space-y-2.5 text-xs">
          {briefing.weather && (
            <div className="flex items-start gap-2 text-terminal-dim">
              <span className="text-yellow-400 font-bold shrink-0">◈ WEATHER</span>
              <span>{briefing.weather}</span>
            </div>
          )}

          {briefing.signals.length > 0 && (
            <div className="space-y-1">
              <p className="text-yellow-400 font-bold tracking-widest">◈ TOP ALERTS</p>
              {briefing.signals.map((s, i) => (
                <div key={i} className="flex items-start gap-2 text-terminal-dim pl-2 border-l border-yellow-400/20">
                  <span className={`font-bold shrink-0 ${SEV_COLOR[s.severity] ?? "text-terminal-dim"}`}>
                    {s.severity}
                  </span>
                  <span>{s.event}{s.entities.length > 0 ? ` — ${s.entities.slice(0, 3).join(", ")}` : ""}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-terminal-dim">
            <span className="text-yellow-400 font-bold">◈ BOT</span>
            <span>
              {briefing.bot_positions > 0
                ? `${briefing.bot_positions} open position${briefing.bot_positions !== 1 ? "s" : ""} in virtual portfolio`
                : "No open bot positions"}
            </span>
          </div>

          {playing && (
            <div className="flex items-center gap-1.5 text-yellow-400/70 text-xs animate-pulse">
              <Volume2 size={10} /> Thor is speaking...
            </div>
          )}
        </div>
      ) : (
        <p className="text-terminal-dim text-xs">
          Click <span className="text-yellow-400 font-bold">▶ PLAY BRIEFING</span> — Thor will read today's intelligence report aloud covering weather, top geopolitical alerts, and your bot status.
        </p>
      )}
    </div>
  );
}
