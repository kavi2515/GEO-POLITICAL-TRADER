import { useCallback, useEffect, useRef, useState } from "react";
import type { Filters, SignalItem, Stats } from "../types";

const API = "";  // proxied via vite

export function useSignals(filters: Filters) {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchSignals = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.event_type)     params.set("event_type", filters.event_type);
    if (filters.severity)       params.set("severity", filters.severity);
    if (filters.signal_direction) params.set("signal_direction", filters.signal_direction);
    if (filters.asset_category) params.set("asset_category", filters.asset_category);
    params.set("hours", String(filters.hours));
    params.set("limit", "40");

    try {
      const [sigRes, statsRes] = await Promise.all([
        fetch(`${API}/api/signals?${params}`),
        fetch(`${API}/api/stats?hours=${filters.hours}`),
      ]);
      if (sigRes.ok)   setSignals(await sigRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (_) {
      // network error — keep stale data
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load and filter changes
  useEffect(() => {
    setLoading(true);
    fetchSignals();
  }, [fetchSignals]);

  // WebSocket for live push notifications
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "new_signals") {
          setNewCount((n) => n + msg.count);
          fetchSignals();
        }
      } catch (_) {}
    };

    return () => ws.close();
  }, [fetchSignals]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNewCount(0);
    await fetch("/api/refresh", { method: "POST" });
    await fetchSignals();
  }, [fetchSignals]);

  return { signals, stats, loading, newCount, refresh };
}