import { useState } from "react";
import { Settings, Lock, User, CheckCircle, XCircle } from "lucide-react";

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" };
}

interface Props {
  userName: string;
  userEmail: string;
  onNameChange: (name: string) => void;
}

export default function SettingsPage({ userName, userEmail, onNameChange }: Props) {
  // Change password state
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [pwStatus, setPwStatus]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [pwLoading, setPwLoading]   = useState(false);

  // Change name state
  const [name, setName]             = useState(userName);
  const [nameStatus, setNameStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [nameLoading, setNameLoading] = useState(false);

  async function changePassword() {
    if (!currentPw || !newPw || !confirmPw) {
      setPwStatus({ ok: false, msg: "All fields are required" });
      return;
    }
    if (newPw !== confirmPw) {
      setPwStatus({ ok: false, msg: "New passwords do not match" });
      return;
    }
    if (newPw.length < 8) {
      setPwStatus({ ok: false, msg: "New password must be at least 8 characters" });
      return;
    }
    setPwLoading(true);
    setPwStatus(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwStatus({ ok: true, msg: "Password changed successfully" });
        setCurrentPw(""); setNewPw(""); setConfirmPw("");
      } else {
        setPwStatus({ ok: false, msg: data.detail || "Failed to change password" });
      }
    } catch {
      setPwStatus({ ok: false, msg: "Connection error. Please try again." });
    } finally {
      setPwLoading(false);
    }
  }

  async function updateName() {
    if (!name.trim()) {
      setNameStatus({ ok: false, msg: "Name cannot be empty" });
      return;
    }
    setNameLoading(true);
    setNameStatus(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setNameStatus({ ok: true, msg: "Name updated successfully" });
        onNameChange(data.name);
      } else {
        setNameStatus({ ok: false, msg: data.detail || "Failed to update name" });
      }
    } catch {
      setNameStatus({ ok: false, msg: "Connection error. Please try again." });
    } finally {
      setNameLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings size={16} className="text-terminal-accent" />
        <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">ACCOUNT SETTINGS</h2>
      </div>

      {/* Account info */}
      <div className="border border-terminal-border/30 rounded-lg p-4 bg-terminal-card/20 space-y-2 text-xs">
        <p className="text-terminal-dim tracking-widest">ACCOUNT INFO</p>
        <div className="flex justify-between text-terminal-dim">
          <span>Email</span>
          <span className="text-terminal-text font-mono">{userEmail}</span>
        </div>
        <div className="flex justify-between text-terminal-dim">
          <span>Display name</span>
          <span className="text-terminal-text font-mono">{userName}</span>
        </div>
      </div>

      {/* Update name */}
      <div className="border border-terminal-border/30 rounded-lg p-4 bg-terminal-card/20 space-y-3">
        <div className="flex items-center gap-2">
          <User size={13} className="text-terminal-accent" />
          <p className="text-terminal-accent text-xs font-bold tracking-widest">CHANGE DISPLAY NAME</p>
        </div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full bg-transparent border border-terminal-border rounded px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent font-mono"
        />
        {nameStatus && (
          <div className={`flex items-center gap-1.5 text-xs ${nameStatus.ok ? "text-terminal-buy" : "text-terminal-sell"}`}>
            {nameStatus.ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
            {nameStatus.msg}
          </div>
        )}
        <button
          onClick={updateName}
          disabled={nameLoading}
          className="w-full text-xs text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 py-2 rounded tracking-widest transition-colors font-bold disabled:opacity-50"
        >
          {nameLoading ? "SAVING..." : "SAVE NAME"}
        </button>
      </div>

      {/* Change password */}
      <div className="border border-terminal-border/30 rounded-lg p-4 bg-terminal-card/20 space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={13} className="text-terminal-accent" />
          <p className="text-terminal-accent text-xs font-bold tracking-widest">CHANGE PASSWORD</p>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-xs text-terminal-dim tracking-widest mb-1">CURRENT PASSWORD</label>
            <input
              type="password"
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              placeholder="Enter current password"
              className="w-full bg-transparent border border-terminal-border rounded px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-terminal-dim tracking-widest mb-1">NEW PASSWORD</label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full bg-transparent border border-terminal-border rounded px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-terminal-dim tracking-widest mb-1">CONFIRM NEW PASSWORD</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              className="w-full bg-transparent border border-terminal-border rounded px-3 py-2 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent font-mono"
              onKeyDown={e => e.key === "Enter" && changePassword()}
            />
          </div>
        </div>

        {pwStatus && (
          <div className={`flex items-center gap-1.5 text-xs ${pwStatus.ok ? "text-terminal-buy" : "text-terminal-sell"}`}>
            {pwStatus.ok ? <CheckCircle size={11} /> : <XCircle size={11} />}
            {pwStatus.msg}
          </div>
        )}

        <button
          onClick={changePassword}
          disabled={pwLoading}
          className="w-full text-xs text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 py-2 rounded tracking-widest transition-colors font-bold disabled:opacity-50"
        >
          {pwLoading ? "SAVING..." : "CHANGE PASSWORD"}
        </button>
      </div>
    </div>
  );
}
