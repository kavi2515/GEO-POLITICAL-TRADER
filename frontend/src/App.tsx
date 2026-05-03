import { useState } from "react";
import CookieConsent from "./components/CookieConsent";
import FilterPanel from "./components/FilterPanel";
import Header from "./components/Header";
import NewsTicker from "./components/NewsTicker";
import RegisterModal from "./components/RegisterModal";
import SignalCard from "./components/SignalCard";
import StatsBar from "./components/StatsBar";
import { useAuth } from "./context/AuthContext";
import AdminPage from "./pages/AdminPage";
import BotPage from "./pages/BotPage";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import MarketsPage from "./pages/MarketsPage";
import PortfolioPage from "./pages/PortfolioPage";
import PrivacyPage from "./pages/PrivacyPage";
import StocksPage from "./pages/StocksPage";
import TermsPage from "./pages/TermsPage";
import WatchlistPage from "./pages/WatchlistPage";
import WorldMapPage from "./pages/WorldMapPage";
import SignalHistoryPage from "./pages/SignalHistoryPage";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import { useSignals } from "./hooks/useSignals";
import { usePrices } from "./hooks/usePrices";
import type { Filters } from "./types";

const DEFAULT_FILTERS: Filters = {
  event_type:       "",
  severity:         "",
  signal_direction: "",
  asset_category:   "",
  hours:            24,
};

type Page = "home" | "news" | "stocks" | "markets" | "portfolio" | "worldmap" | "watchlist" | "history" | "chat" | "settings" | "admin" | "bot";

export default function App() {
  const path = window.location.pathname;
  if (path === "/terms") return <TermsPage />;
  if (path === "/privacy") return <PrivacyPage />;

  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || path === "/reset-password") return <AuthPage />;

  return <Dashboard onLogout={logout} user={user} />;
}

function Dashboard({ onLogout, user }: { onLogout: () => void; user: { name: string; email: string; is_admin: boolean } }) {
  const [filters, setFilters]       = useState<Filters>(DEFAULT_FILTERS);
  const [showRegister, setShowRegister] = useState(false);
  const [activePage, setActivePage] = useState<Page>("home");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);

  async function handleDeleteAccount() {
    const token = localStorage.getItem("token");
    await fetch("/api/auth/account", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    onLogout();
  }

  const { signals, stats, loading, newCount, refresh } = useSignals(filters);
  const { prices } = usePrices();

  const tabs: { id: Page; label: string; adminOnly?: boolean }[] = [
    { id: "home",      label: "⌂ HOME" },
    { id: "news",      label: "◈ SIGNALS FEED" },
    { id: "stocks",    label: "▲ TRADE RECOMMENDATIONS" },
    { id: "markets",   label: "◎ LIVE MARKETS" },
    { id: "portfolio", label: "◉ PORTFOLIO" },
    { id: "worldmap",  label: "⬡ WORLD MAP" },
    { id: "watchlist", label: "★ WATCHLIST" },
    { id: "history",   label: "◷ SIGNAL HISTORY" },
    { id: "chat",      label: "⚡ THOR AI" },
    { id: "settings",  label: "⚙ SETTINGS" },
    { id: "bot",       label: "⚡ AI BOT", adminOnly: true },
    { id: "admin",     label: "⬡ ADMIN", adminOnly: true },
  ];

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
          <span>{displayName}</span>
          {showDeleteConfirm ? (
            <span className="flex items-center gap-2">
              <span className="text-red-400">Delete account?</span>
              <button onClick={handleDeleteAccount} className="text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded transition-colors">YES</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="text-terminal-dim hover:text-terminal-text border border-terminal-border px-2 py-1 rounded transition-colors">NO</button>
            </span>
          ) : (
            <>
              <button onClick={() => setShowDeleteConfirm(true)} className="text-terminal-dim hover:text-red-400 border border-terminal-border hover:border-red-400/30 px-2 py-1 rounded transition-colors">
                DELETE ACCOUNT
              </button>
              <button onClick={onLogout} className="text-red-400 hover:text-red-300 border border-red-400/30 px-2 py-1 rounded transition-colors">
                LOGOUT
              </button>
            </>
          )}
        </div>
      </div>

      <NewsTicker signals={signals} />
      <StatsBar stats={stats} />

      {/* Page tabs */}
      <div className="border-b border-terminal-border bg-terminal-card/50 overflow-x-auto">
        <div className="max-w-screen-2xl mx-auto px-4 flex gap-1 min-w-max">
          {tabs.map(tab => {
            if (tab.adminOnly && !user.is_admin) return null;
            const isActive = activePage === tab.id;
            const isBuy = tab.id === "stocks";
            return (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                className={`px-5 py-2.5 text-xs tracking-widest font-bold transition-all border-b-2 whitespace-nowrap ${
                  isActive
                    ? isBuy
                      ? "text-terminal-buy border-terminal-buy glow-buy"
                      : "text-terminal-accent border-terminal-accent glow-accent"
                    : "text-terminal-dim border-transparent hover:text-terminal-text"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      {activePage === "home" ? (
        <HomePage
          signals={signals}
          prices={prices}
          onNavigate={setActivePage}
          userName={user.name}
        />
      ) : activePage === "worldmap" ? (
        <div className="max-w-screen-2xl mx-auto">
          <WorldMapPage signals={signals} />
        </div>
      ) : activePage === "markets" ? (
        <div className="max-w-screen-2xl mx-auto">
          <MarketsPage signals={signals} onRefresh={refresh} />
        </div>
      ) : activePage === "watchlist" ? (
        <div className="max-w-screen-2xl mx-auto">
          <WatchlistPage />
        </div>
      ) : activePage === "history" ? (
        <div className="max-w-screen-2xl mx-auto">
          <SignalHistoryPage />
        </div>
      ) : activePage === "chat" ? (
        <div className="max-w-screen-2xl mx-auto">
          <ChatPage />
        </div>
      ) : activePage === "settings" ? (
        <div className="max-w-screen-2xl mx-auto">
          <SettingsPage userName={displayName} userEmail={user.email} onNameChange={setDisplayName} />
        </div>
      ) : activePage === "bot" ? (
        <div className="max-w-screen-2xl mx-auto">
          <BotPage />
        </div>
      ) : activePage === "admin" ? (
        <div className="max-w-screen-2xl mx-auto">
          <AdminPage />
        </div>
      ) : activePage === "portfolio" ? (
        <div className="max-w-screen-2xl mx-auto">
          <PortfolioPage />
        </div>
      ) : activePage === "stocks" ? (
        <div className="max-w-screen-2xl mx-auto">
          <StocksPage signals={signals} />
        </div>
      ) : (
        <div className="max-w-screen-2xl mx-auto flex">
          <FilterPanel filters={filters} onChange={setFilters} />
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
      )}

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
      <CookieConsent />

      {/* Footer */}
      <footer className="border-t border-terminal-border/30 mt-8 py-4 px-6 space-y-2 text-xs text-terminal-dim">
        <p className="text-terminal-dim/70 leading-relaxed text-center max-w-3xl mx-auto">
          <span className="text-yellow-400/80 font-bold">DISCLAIMER:</span> GeoTrader provides algorithmic market signals for informational purposes only. Nothing on this platform constitutes financial advice or a recommendation to buy or sell any financial instrument. Trading involves significant risk of loss. Always consult a qualified financial adviser before making investment decisions.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} <span className="text-terminal-accent">GeoTrader</span> — Kavi Godithi. All Rights Reserved.</span>
          <div className="flex gap-3">
            <a href="/terms" className="hover:text-terminal-accent transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-terminal-accent transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
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
