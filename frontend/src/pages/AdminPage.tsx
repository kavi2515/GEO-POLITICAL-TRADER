import { useEffect, useState } from "react";
import { Shield, UserCheck, UserX } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  };

  useEffect(() => {
    fetch("/api/admin/users", { headers: getHeaders() })
      .then(r => r.json())
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  async function toggleUser(id: string) {
    const r = await fetch(`/api/admin/users/${id}/toggle`, { method: "PATCH", headers: getHeaders() });
    if (r.ok) {
      const data = await r.json();
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: data.is_active } : x));
    }
  }

  async function toggleAdmin(id: string) {
    const r = await fetch(`/api/admin/users/${id}/make-admin`, { method: "PATCH", headers: getHeaders() });
    if (r.ok) {
      const data = await r.json();
      setUsers(u => u.map(x => x.id === id ? { ...x, is_admin: data.is_admin } : x));
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Shield size={16} className="text-terminal-accent" />
        <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">ADMIN PANEL</h2>
        <span className="text-terminal-dim text-xs">— {users.length} users</span>
      </div>

      <div className="border border-terminal-accent/20 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-terminal-accent/5 text-xs text-terminal-dim tracking-widest border-b border-terminal-accent/20">
          <div className="col-span-3">NAME</div>
          <div className="col-span-4">EMAIL</div>
          <div className="col-span-2">JOINED</div>
          <div className="col-span-1 text-center">ROLE</div>
          <div className="col-span-2 text-center">ACTIONS</div>
        </div>

        {users.map((user) => (
          <div key={user.id} className={`grid grid-cols-12 gap-2 px-4 py-3 text-xs border-b border-terminal-border/30 hover:bg-terminal-muted/30 transition-colors ${!user.is_active ? "opacity-40" : ""}`}>
            <div className="col-span-3 text-terminal-text font-medium truncate">{user.name}</div>
            <div className="col-span-4 text-terminal-dim truncate">{user.email}</div>
            <div className="col-span-2 text-terminal-dim">{new Date(user.created_at).toLocaleDateString()}</div>
            <div className="col-span-1 text-center">
              {user.is_admin
                ? <span className="text-terminal-accent glow-accent font-bold">ADMIN</span>
                : <span className="text-terminal-dim">USER</span>}
            </div>
            <div className="col-span-2 flex items-center justify-center gap-2">
              <button
                onClick={() => toggleUser(user.id)}
                title={user.is_active ? "Deactivate" : "Activate"}
                className={`p-1 rounded transition-colors ${user.is_active ? "text-terminal-buy hover:text-red-400" : "text-terminal-dim hover:text-terminal-buy"}`}
              >
                {user.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
              </button>
              <button
                onClick={() => toggleAdmin(user.id)}
                title={user.is_admin ? "Remove Admin" : "Make Admin"}
                className={`p-1 rounded transition-colors ${user.is_admin ? "text-terminal-accent" : "text-terminal-dim hover:text-terminal-accent"}`}
              >
                <Shield size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-terminal-dim space-y-1 border border-terminal-border/30 rounded p-3">
        <p className="text-terminal-accent font-bold">EMAIL ALERTS SETUP</p>
        <p>To enable email alerts for CRITICAL signals, set these environment variables on EC2:</p>
        <code className="block bg-terminal-muted/50 p-2 rounded mt-1 text-terminal-text">
          SMTP_HOST=smtp.gmail.com<br/>
          SMTP_PORT=587<br/>
          SMTP_USER=your@gmail.com<br/>
          SMTP_PASS=your-app-password<br/>
          SMTP_FROM=your@gmail.com
        </code>
      </div>
    </div>
  );
}
