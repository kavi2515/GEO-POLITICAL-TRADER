import { Filter, X } from "lucide-react";
import type { Filters } from "../types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const EVENT_TYPES = [
  { value: "", label: "All Events" },
  { value: "military_conflict",   label: "Military Conflict" },
  { value: "sanctions",           label: "Sanctions / Embargo" },
  { value: "political_instability", label: "Political Instability" },
  { value: "trade_dispute",       label: "Trade Dispute" },
  { value: "energy_crisis",       label: "Energy Crisis" },
  { value: "monetary_policy",     label: "Monetary Policy" },
  { value: "natural_disaster",    label: "Natural Disaster" },
  { value: "diplomatic",          label: "Diplomatic" },
  { value: "economic_data",       label: "Economic Data" },
];

const SEVERITIES = [
  { value: "", label: "All Severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH",     label: "High" },
  { value: "MEDIUM",   label: "Medium" },
  { value: "LOW",      label: "Low" },
];

const DIRECTIONS = [
  { value: "", label: "All Signals" },
  { value: "BUY",  label: "BUY Only" },
  { value: "SELL", label: "SELL Only" },
];

const CATEGORIES = [
  { value: "",             label: "All Assets" },
  { value: "Commodity",   label: "Commodities" },
  { value: "Currency",    label: "Currencies" },
  { value: "Index",       label: "Indices" },
  { value: "Crypto",      label: "Crypto" },
  { value: "Sector",      label: "Sectors" },
  { value: "Fixed Income", label: "Fixed Income" },
];

const TIMEFRAMES = [
  { value: 6,  label: "Last 6h" },
  { value: 12, label: "Last 12h" },
  { value: 24, label: "Last 24h" },
  { value: 48, label: "Last 48h" },
  { value: 72, label: "Last 72h" },
];

export default function FilterPanel({ filters, onChange }: Props) {
  const update = (key: keyof Filters, value: string | number) =>
    onChange({ ...filters, [key]: value });

  const hasActive =
    filters.event_type || filters.severity || filters.signal_direction || filters.asset_category;

  const reset = () =>
    onChange({ event_type: "", severity: "", signal_direction: "", asset_category: "", hours: 24 });

  return (
    <aside className="w-56 shrink-0 border-r border-terminal-border bg-terminal-card/30 p-4 space-y-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-terminal-accent text-xs font-semibold">
          <Filter size={13} />
          FILTERS
        </div>
        {hasActive && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-xs text-terminal-dim hover:text-terminal-sell transition-colors"
          >
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {/* Timeframe */}
      <FilterSection label="TIMEFRAME">
        <div className="grid grid-cols-2 gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.value}
              onClick={() => update("hours", t.value)}
              className={`text-xs py-1 px-2 rounded border transition-colors ${
                filters.hours === t.value
                  ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10"
                  : "border-terminal-border text-terminal-dim hover:border-terminal-dim"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* Event Type */}
      <FilterSection label="EVENT TYPE">
        {EVENT_TYPES.map((e) => (
          <FilterOption
            key={e.value}
            label={e.label}
            active={filters.event_type === e.value}
            onClick={() => update("event_type", e.value)}
          />
        ))}
      </FilterSection>

      {/* Severity */}
      <FilterSection label="SEVERITY">
        {SEVERITIES.map((s) => (
          <FilterOption
            key={s.value}
            label={s.label}
            active={filters.severity === s.value}
            color={severityColor(s.value)}
            onClick={() => update("severity", s.value)}
          />
        ))}
      </FilterSection>

      {/* Signal Direction */}
      <FilterSection label="SIGNAL">
        {DIRECTIONS.map((d) => (
          <FilterOption
            key={d.value}
            label={d.label}
            active={filters.signal_direction === d.value}
            color={d.value === "BUY" ? "text-terminal-buy" : d.value === "SELL" ? "text-terminal-sell" : ""}
            onClick={() => update("signal_direction", d.value)}
          />
        ))}
      </FilterSection>

      {/* Asset Category */}
      <FilterSection label="ASSET CLASS">
        {CATEGORIES.map((c) => (
          <FilterOption
            key={c.value}
            label={c.label}
            active={filters.asset_category === c.value}
            onClick={() => update("asset_category", c.value)}
          />
        ))}
      </FilterSection>
    </aside>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-terminal-dim text-xs mb-2 tracking-widest">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function FilterOption({
  label,
  active,
  color = "",
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-xs py-1.5 px-2 rounded transition-colors ${
        active
          ? "bg-terminal-accent/15 text-terminal-accent font-semibold"
          : `text-terminal-dim hover:text-terminal-text hover:bg-terminal-muted ${color}`
      }`}
    >
      {active && <span className="mr-1.5">›</span>}
      {label}
    </button>
  );
}

function severityColor(val: string) {
  switch (val) {
    case "CRITICAL": return "text-red-400";
    case "HIGH":     return "text-orange-400";
    case "MEDIUM":   return "text-yellow-400";
    case "LOW":      return "text-blue-400";
    default:         return "";
  }
}