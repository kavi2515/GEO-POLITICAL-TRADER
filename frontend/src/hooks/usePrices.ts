import { useEffect, useState } from "react";

export interface PriceData {
  price: number;
  change_pct: number;
  ticker: string;
  formatted: string;
}

export function usePrices() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/prices", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : {})
      .then(setPrices)
      .catch(() => {})
      .finally(() => setLoading(false));

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      fetch("/api/prices", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : {})
        .then(setPrices)
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { prices, loading };
}
