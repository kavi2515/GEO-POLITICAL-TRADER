import { useState, useEffect } from "react";

const STORAGE_KEY = "cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-terminal-accent/30 bg-terminal-bg/95 backdrop-blur px-6 py-4">
      <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-xs text-terminal-dim leading-relaxed max-w-2xl">
          <span className="text-terminal-accent font-bold">COOKIES</span> — We use essential cookies to keep you logged in. By clicking{" "}
          <span className="text-terminal-text">Accept</span>, you also consent to anonymous analytics that help us improve the platform.
          See our{" "}
          <a href="/privacy" className="text-terminal-accent hover:underline">Privacy Policy</a>{" "}
          for details.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={decline}
            className="text-xs px-4 py-2 border border-terminal-border text-terminal-dim hover:text-terminal-text hover:border-terminal-accent/30 rounded transition-colors tracking-widest"
          >
            DECLINE
          </button>
          <button
            onClick={accept}
            className="text-xs px-4 py-2 border border-terminal-accent/50 text-terminal-accent hover:bg-terminal-accent/10 rounded transition-colors tracking-widest font-bold"
          >
            ACCEPT
          </button>
        </div>
      </div>
    </div>
  );
}
