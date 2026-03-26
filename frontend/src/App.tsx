import { useState } from "react";
import FilterPanel from "./components/FilterPanel";
import Header from "./components/Header";
import NewsTicker from "./components/NewsTicker";
import RegisterModal from "./components/RegisterModal";
import SignalCard from "./components/SignalCard";
import StatsBar from "./components/StatsBar";
import { useAuth } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import { useSignals } from "./hooks/useSignals";
import type { Filters } from "./types";

const DEFAULT_FILTERS: Filters = {
  event_type:       "",
  severity:         "",
  signal_direction: "",
  asset_category:   "",
  hours:            24,
};

export default function App() {
  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return <Dashboard onLogout={logout} userName={user.name} />;
}

function Dashboard({ onLogout, userName }: { onLogout: () => void; userName: string }) {
  const [filters, setFilters]       = useState<Filters>(DEFAULT_FILTERS);
  const [showRegister, setShowRegister] = useState(false);

  const { signals, stats, loading, newCount, refresh } = useSignals(filters);

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono">
      <div className="flex items-center justify-between bg-terminal-bg border-b border-terminal-accent/20 px-4 py-1">
        <Header
          newCount={newCount}
          loading={loading}
          onRefresh={refresh}
          onRegister={() => setShowRegister(true)}
        />
        <div className="flex items-center gap-3 text-xs text-terminal-dim shrink-0">
          <span>{userName}</span>
          <button onClick={onLogout} className="text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded transition-colors">
            LOGOUT
          </button>
        </div>
      </div>

      <NewsTicker signals={signals} />
      <StatsBar stats={stats} />

      <div className="max-w-screen-2xl mx-auto flex">
        <FilterPanel filters={filters} onChange={setFilters} />

        {/* Main content */}
        <main className="flex-1 p-4 min-h-screen">
          {loading && signals.length === 0 ? (
            <LoadingState />
          ) : signals.length === 0 ? (
            <EmptyState onRefresh={refresh} />
          ) : (
            <>
              <p className="text-terminal-dim text-xs mb-4">
                Showing {signals.length} signal{signals.length !== 1 ? "s" : ""}
                {filters.event_type && ` · ${filters.event_type.replace(/_/g, " ")}`}
                {filters.severity && ` · ${filters.severity}`}
              </p>
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                {signals.map((s) => (
                  <SignalCard key={s.id} item={s} />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-terminal-dim">
      <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
      <div className="text-sm">Fetching geopolitical intelligence...</div>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-terminal-dim text-center">
      <div className="text-4xl">📡</div>
      <div>
        <p className="text-terminal-text font-medium">No signals found</p>
        <p className="text-sm mt-1">Try adjusting your filters or refresh to fetch latest news</p>
      </div>
      <button
        onClick={onRefresh}
        className="text-sm text-terminal-accent border border-terminal-accent/40 hover:bg-terminal-accent/10 px-4 py-2 rounded-lg transition-colors"
      >
        Fetch Latest News
      </button>
    </div>
  );
}