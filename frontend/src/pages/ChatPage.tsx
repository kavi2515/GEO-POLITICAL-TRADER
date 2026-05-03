import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, RefreshCw, Zap } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What are today's top geopolitical risks?",
  "Which assets should I watch based on current signals?",
  "Explain the latest CRITICAL alert",
  "How does the Middle East tension affect oil prices?",
  "What's the bot's current strategy?",
];

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I am Thor — GeoTrader AI. I have access to your live signals, open positions, and geopolitical data. Ask me anything about current market risks, signal interpretation, or trading strategy. Remember: this is a virtual portfolio — not real financial advice.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.reply || "No response received." },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col space-y-4" style={{ height: "calc(100vh - 160px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-yellow-400/20 border border-yellow-400/50 flex items-center justify-center">
          <Zap size={15} className="text-yellow-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">GEOTRADER AI CHAT</h2>
            <span className="text-xs text-terminal-dim px-2 py-0.5 border border-terminal-border rounded">
              Powered by Claude · Call sign: THOR
            </span>
          </div>
          <p className="text-terminal-dim text-xs">Live signal context · Virtual portfolio only · Not financial advice</p>
        </div>
      </div>

      {/* Starter prompts */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 shrink-0">
          {STARTERS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs text-terminal-dim border border-terminal-border/40 hover:text-terminal-accent hover:border-terminal-accent/40 px-2.5 py-1 rounded transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 border border-terminal-border/30 rounded-lg overflow-y-auto p-4 space-y-4 bg-terminal-card/10">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Zap size={11} className="text-yellow-400" />
              </div>
            )}
            <div
              className={`max-w-[80%] text-xs rounded-lg px-3 py-2.5 leading-relaxed ${
                msg.role === "user"
                  ? "bg-terminal-accent/15 border border-terminal-accent/30 text-terminal-text"
                  : "bg-terminal-card/60 border border-terminal-border/30 text-terminal-dim"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="text-yellow-400 font-bold mr-1.5">THOR</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center mr-2 mt-0.5 shrink-0">
              <Zap size={11} className="text-yellow-400" />
            </div>
            <div className="bg-terminal-card/60 border border-terminal-border/30 rounded-lg px-3 py-2.5 text-xs text-terminal-dim flex items-center gap-2">
              <RefreshCw size={10} className="animate-spin text-yellow-400" />
              <span className="text-yellow-400 font-bold mr-1">THOR</span> analysing...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Ask about signals, markets, geopolitical risks..."
          className="flex-1 bg-transparent border border-terminal-border rounded px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent font-mono placeholder:text-terminal-dim/50"
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="text-xs text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 px-4 py-2 rounded transition-colors disabled:opacity-40 flex items-center gap-1.5 font-bold"
        >
          <Send size={11} /> SEND
        </button>
      </div>

      <p className="text-terminal-dim/40 text-xs text-center shrink-0">
        <MessageSquare size={9} className="inline mr-1" />
        GeoTrader AI uses live signal data. Virtual portfolio only — not real financial advice.
      </p>
    </div>
  );
}
