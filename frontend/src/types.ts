export interface MarketSignal {
  asset: string;
  asset_label: string;
  category: string;
  signal: "BUY" | "SELL";
  confidence: number;
  reasoning: string;
}

export interface SignalItem {
  id: string;
  news_title: string;
  news_summary: string | null;
  news_url: string | null;
  source: string;
  published_at: string;
  event_type: string;
  event_label: string;
  entities: string[];
  sentiment: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  severity_score: number;
  market_signals: MarketSignal[];
  created_at: string;
}

export interface Stats {
  total_signals: number;
  buy_signals: number;
  sell_signals: number;
  top_assets: Array<{ asset: string; count: number }>;
  recent_sources: string[];
  last_updated: string | null;
}

export interface Filters {
  event_type: string;
  severity: string;
  signal_direction: string;
  asset_category: string;
  hours: number;
}