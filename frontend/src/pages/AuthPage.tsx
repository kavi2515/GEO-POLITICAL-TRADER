import { useState } from "react";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "register" | "forgot" | "reset";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>(() => {
    if (window.location.pathname === "/reset-password") return "reset";
    return "login";
  });
  const resetToken = new URLSearchParams(window.location.search).get("token") ?? "";

  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register") {
        await register(email, name, password);
      } else if (mode === "forgot") {
        const r = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await r.json();
        setSuccess(data.message ?? "Reset link sent — check your email.");
      } else if (mode === "reset") {
        if (password !== confirm) { setError("Passwords do not match"); return; }
        const r = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, new_password: password }),
        });
        if (!r.ok) {
          const d = await r.json();
          throw new Error(d.detail ?? "Reset failed");
        }
        setSuccess("Password updated. You can now log in.");
        setTimeout(() => { window.location.href = "/"; }, 2000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, string> = {
    login:    "LOGIN",
    register: "REGISTER",
    forgot:   "RESET PASSWORD",
    reset:    "NEW PASSWORD",
  };

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-terminal-accent text-2xl font-bold tracking-widest">GEO TRADER</div>
          <div className="text-terminal-dim text-xs mt-1 tracking-wider">GEOPOLITICAL INTELLIGENCE PLATFORM</div>
        </div>

        {/* Card */}
        <div className="border border-terminal-accent/30 rounded-lg p-6 bg-terminal-bg">
          {/* Tabs (login/register only) */}
          {(mode === "login" || mode === "register") && (
            <div className="flex mb-6 border-b border-terminal-accent/20">
              {(["login", "register"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                  className={`flex-1 pb-2 text-sm tracking-wider transition-colors ${
                    mode === m
                      ? "text-terminal-accent border-b-2 border-terminal-accent"
                      : "text-terminal-dim hover:text-terminal-text"
                  }`}
                >
                  {m === "login" ? "LOGIN" : "REGISTER"}
                </button>
              ))}
            </div>
          )}

          {/* Heading for forgot/reset */}
          {(mode === "forgot" || mode === "reset") && (
            <div className="mb-5">
              <p className="text-terminal-accent text-sm font-bold tracking-widest">{titles[mode]}</p>
              <button onClick={() => setMode("login")} className="text-terminal-dim text-xs hover:text-terminal-accent mt-1">← Back to login</button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-terminal-dim mb-1 tracking-wider">NAME</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                  placeholder="John Doe" />
              </div>
            )}

            {(mode === "login" || mode === "register" || mode === "forgot") && (
              <div>
                <label className="block text-xs text-terminal-dim mb-1 tracking-wider">EMAIL</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                  placeholder="you@example.com" />
              </div>
            )}

            {(mode === "login" || mode === "register" || mode === "reset") && (
              <div>
                <label className="block text-xs text-terminal-dim mb-1 tracking-wider">
                  {mode === "reset" ? "NEW PASSWORD" : "PASSWORD"}
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                  placeholder="••••••••" />
              </div>
            )}

            {mode === "reset" && (
              <div>
                <label className="block text-xs text-terminal-dim mb-1 tracking-wider">CONFIRM PASSWORD</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6}
                  className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                  placeholder="••••••••" />
              </div>
            )}

            {error && (
              <div className="text-red-400 text-xs border border-red-400/30 rounded px-3 py-2">{error}</div>
            )}
            {success && (
              <div className="text-terminal-buy text-xs border border-terminal-buy/30 rounded px-3 py-2">{success}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-terminal-accent/10 border border-terminal-accent/50 hover:bg-terminal-accent/20 text-terminal-accent py-2 rounded text-sm tracking-wider transition-colors disabled:opacity-50">
              {loading ? "PLEASE WAIT..." : titles[mode]}
            </button>

            {mode === "login" && (
              <button type="button" onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                className="w-full text-xs text-terminal-dim hover:text-terminal-accent transition-colors text-center mt-1">
                Forgot password?
              </button>
            )}
          </form>
        </div>

        {/* Legal links */}
        <div className="flex justify-center gap-4 mt-4 text-xs text-terminal-dim">
          <a href="/terms" className="hover:text-terminal-accent transition-colors">Terms of Service</a>
          <a href="/privacy" className="hover:text-terminal-accent transition-colors">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
