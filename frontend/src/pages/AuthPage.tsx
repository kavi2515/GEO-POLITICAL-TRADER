import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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
          {/* Tabs */}
          <div className="flex mb-6 border-b border-terminal-accent/20">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 pb-2 text-sm tracking-wider transition-colors ${
                mode === "login"
                  ? "text-terminal-accent border-b-2 border-terminal-accent"
                  : "text-terminal-dim hover:text-terminal-text"
              }`}
            >
              LOGIN
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 pb-2 text-sm tracking-wider transition-colors ${
                mode === "register"
                  ? "text-terminal-accent border-b-2 border-terminal-accent"
                  : "text-terminal-dim hover:text-terminal-text"
              }`}
            >
              REGISTER
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs text-terminal-dim mb-1 tracking-wider">NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-terminal-dim mb-1 tracking-wider">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-terminal-dim mb-1 tracking-wider">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-transparent border border-terminal-accent/30 rounded px-3 py-2 text-sm text-terminal-text focus:outline-none focus:border-terminal-accent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs border border-red-400/30 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-terminal-accent/10 border border-terminal-accent/50 hover:bg-terminal-accent/20 text-terminal-accent py-2 rounded text-sm tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? "PLEASE WAIT..." : mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
