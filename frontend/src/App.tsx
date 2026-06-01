import { useState } from "react";
import { Menu, X } from "lucide-react";
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
import PricingPage from "./pages/PricingPage";
import LandingPage from "./pages/LandingPage";
import OnboardingModal from "./components/OnboardingModal";
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

type Page = "home" | "news" | "stocks" | "markets" | "portfolio" | "worldmap" | "watchlist" | "history" | "chat" | "pricing" | "settings" | "admin" | "bot";

export default function App() {
  const path = window.location.pathname;
  if (path === "/terms") return <TermsPage />;
  if (path === "/privacy") return <PrivacyPage />;

  const { user, loading: authLoading, logout } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-terminal-accent/30 border-t-terminal-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (path === "/reset-password") return <AuthPage />;
  if (!user && !showAuth) return <LandingPage onGetStarted={() => setShowAuth(true)} />;
  if (!user && showAuth) return <AuthPage />;

  if (!user) return null;
  return <Dashboard onLogout={logout} user={user} />;
}

function Dashboard({ onLogout, user }: { onLogout: () => void; user: { name: string; email: string; is_admin: boolean; is_pro: boolean } }) {
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [showRegister, setShowRegister] = useState(false);
  const [activePage, setActivePage]   = useState<Page>("home");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [displayName, setDisplayName] = useState(user.name);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("geotrader_onboarded")
  );

  function navigate(page: Page) {
    setActivePage(page);
    setShowMobileMenu(false);
  }

  async function handleDeleteAccount() {
    const token = localStorage.getItem("token");
    await fetch("/api/auth/account", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    onLogout();
  }

  const { signals, stats, loading, newCount, refresh } = useSignals(filters);
  const { prices } = usePrices();

  const tabs: { id: Page; label: string; adminOnly?: boolean; proOrAdmin?: boolean }[] = [
    { id: "home",      label: "⌂ HOME" },
    { id: "news",      label: "◈ SIGNALS FEED" },
    { id: "stocks",    label: "▲ TRADE RECOMMENDATIONS" },
    { id: "markets",   label: "◎ LIVE MARKETS" },
    { id: "portfolio", label: "◉ PORTFOLIO" },
    { id: "worldmap",  label: "⬡ WORLD MAP" },
    { id: "watchlist", label: "★ WATCHLIST" },
    { id: "history",   label: "◷ SIGNAL HISTORY" },
    { id: "chat",      label: "⚡ THOR AI" },
    { id: "pricing",   label: user.is_pro ? "👑 PRO" : "⭐ UPGRADE" },
    { id: "settings",  label: "⚙ SETTINGS" },
    { id: "bot",       label: "⚡ AI BOT", proOrAdmin: true },
    { id: "admin",     label: "⬡ ADMIN", adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-text font-mono">

      {/* Top bar */}
      <div className="flex items-center justify-between bg-terminal-bg border-b border-terminal-accent/20 px-3 py-1">
        <Header
          newCount={newCount}
          loading={loading}
          onRefresh={refresh}
          onRegister={() => setShowRegister(true)}
        />
        {/* Desktop user controls */}
        <div className="hidden md:flex items-center gap-3 text-xs text-terminal-dim shrink-0">
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
        {/* Mobile hamburger */}
        <button
          onClick={() => setShowMobileMenu(true)}
          className="md:hidden p-2 text-terminal-dim hover:text-terminal-accent transition-colors"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile full-screen menu */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 bg-terminal-bg flex flex-col">
          {/* Menu header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border">
            <div>
              <span className="text-terminal-accent font-bold text-base tracking-tight">GEO</span>
              <span className="text-terminal-text font-light text-base tracking-tight">TRADER</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-terminal-dim text-xs">{displayName}</span>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 text-terminal-dim hover:text-terminal-accent">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto py-2">
            {tabs.map(tab => {
              if (tab.adminOnly && !user.is_admin) return null;
              if (tab.proOrAdmin && !user.is_pro && !user.is_admin) return null;
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.id)}
                  className={`w-full text-left px-6 py-4 text-sm font-bold tracking-widest border-b border-terminal-border/20 transition-colors ${
                    isActive
                      ? "text-terminal-accent bg-terminal-accent/10"
                      : "text-terminal-dim hover:text-terminal-text hover:bg-terminal-card/30"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Mobile menu footer */}
          <div className="border-t border-terminal-border p-4 space-y-2">
            <button onClick={() => { navigate("settings"); }} className="w-full text-xs text-terminal-dim border border-terminal-border py-2.5 rounded transition-colors hover:text-terminal-accent">
              ⚙ SETTINGS
            </button>
            <button onClick={onLogout} className="w-full text-xs text-red-400 border border-red-400/30 py-2.5 rounded transition-colors hover:bg-red-400/10 font-bold">
              LOGOUT
            </button>
          </div>
        </div>
      )}

      <NewsTicker signals={signals} />
      <StatsBar stats={stats} />

      {/* Desktop tab bar */}
      <div className="hidden md:block border-b border-terminal-border bg-terminal-card/50 overflow-x-auto">
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

      {/* Mobile: current page indicator */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-terminal-card/30 border-b border-terminal-border/30">
        <span className="text-terminal-accent text-xs font-bold tracking-widest">
          {tabs.find(t => t.id === activePage)?.label ?? "HOME"}
        </span>
        <button onClick={() => setShowMobileMenu(true)} className="text-terminal-dim text-xs border border-terminal-border px-2 py-1 rounded">
          MENU
        </button>
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
          {user.is_pro ? <SignalHistoryPage /> : <UpgradePrompt onUpgrade={() => setActivePage("pricing")} feature="Signal History & Accuracy Tracker" />}
        </div>
      ) : activePage === "chat" ? (
        <div className="max-w-screen-2xl mx-auto">
          {user.is_pro ? <ChatPage /> : <UpgradePrompt onUpgrade={() => setActivePage("pricing")} feature="Thor AI Chat" />}
        </div>
      ) : activePage === "pricing" ? (
        <div className="max-w-screen-2xl mx-auto">
          <PricingPage isPro={user.is_pro} />
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
      {showOnboarding && <OnboardingModal onClose={() => setShowOnboarding(false)} />}
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

function UpgradePrompt({ feature, onUpgrade }: { feature: string; onUpgrade: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-5 text-center p-6">
      <div className="w-16 h-16 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-3xl">
        👑
      </div>
      <div>
        <p className="text-terminal-text font-bold text-base">{feature} is a Pro feature</p>
        <p className="text-terminal-dim text-sm mt-1">Upgrade to GeoTrader Pro for $19/month to unlock this and more.</p>
      </div>
      <button
        onClick={onUpgrade}
        className="text-sm text-terminal-bg bg-terminal-accent hover:bg-terminal-accent/80 px-6 py-2.5 rounded-lg font-bold transition-colors"
      >
        Upgrade to Pro — $19/mo
      </button>
      <p className="text-terminal-dim/50 text-xs">Cancel anytime · Instant access · Powered by Stripe</p>
    </div>
  );
}
