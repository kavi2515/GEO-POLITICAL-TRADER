import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Globe, AlertTriangle, TrendingDown, TrendingUp, X } from "lucide-react";
import type { SignalItem } from "../types";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Map entity names (from NLP) to ISO numeric country codes used by world-atlas
const ENTITY_TO_ISO: Record<string, number[]> = {
  "Russia":         [643],
  "Ukraine":        [804],
  "China":          [156],
  "United States":  [840],
  "Usa":            [840],
  "America":        [840],
  "Iran":           [364],
  "Saudi Arabia":   [682],
  "Japan":          [392],
  "Uk":             [826],
  "United Kingdom": [826],
  "India":          [356],
  "Brazil":         [76],
  "Turkey":         [792],
  "Israel":         [376],
  "North Korea":    [408],
  "Venezuela":      [862],
  "Taiwan":         [158],
  "South Korea":    [410],
  "Germany":        [276],
  "France":         [250],
  "Pakistan":       [586],
  "Afghanistan":    [4],
  // Regional groupings — highlight key representative countries
  "Europe":         [276, 250, 380, 724, 528, 40],
  "European Union": [276, 250, 380, 724, 528],
  "Middle East":    [364, 682, 368, 760, 400],
  "Africa":         [710, 566, 818, 12],
  "Latin America":  [76, 484, 32, 170, 604],
  "Opec":           [682, 364, 706, 784, 12],
};

const SEVERITY_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface CountryData {
  maxSeverity: Severity;
  signals: SignalItem[];
  entityName: string;
}

function buildCountryMap(signals: SignalItem[]): Map<number, CountryData> {
  // entity name → { maxSeverity, signals }
  const entityMap = new Map<string, { maxSeverity: Severity; signals: SignalItem[] }>();

  for (const signal of signals) {
    for (const entity of signal.entities) {
      const key = entity;
      if (!entityMap.has(key)) {
        entityMap.set(key, { maxSeverity: signal.severity, signals: [] });
      }
      const entry = entityMap.get(key)!;
      entry.signals.push(signal);
      if (SEVERITY_ORDER[signal.severity] > SEVERITY_ORDER[entry.maxSeverity]) {
        entry.maxSeverity = signal.severity;
      }
    }
  }

  // iso numeric → CountryData (highest severity wins if multiple entities map to same country)
  const isoMap = new Map<number, CountryData>();

  for (const [entityName, data] of entityMap.entries()) {
    const isoCodes = ENTITY_TO_ISO[entityName];
    if (!isoCodes) continue;
    for (const iso of isoCodes) {
      const existing = isoMap.get(iso);
      if (!existing || SEVERITY_ORDER[data.maxSeverity] > SEVERITY_ORDER[existing.maxSeverity]) {
        isoMap.set(iso, { maxSeverity: data.maxSeverity, signals: data.signals, entityName });
      }
    }
  }

  return isoMap;
}

function severityFill(severity: Severity | undefined): string {
  switch (severity) {
    case "CRITICAL": return "#ff0a3c";
    case "HIGH":     return "#ff6b00";
    case "MEDIUM":   return "#f5c518";
    case "LOW":      return "#00aaff";
    default:         return "#1a2332";
  }
}

function severityGlow(severity: Severity): string {
  switch (severity) {
    case "CRITICAL": return "0 0 12px #ff0a3c, 0 0 24px #ff0a3c66";
    case "HIGH":     return "0 0 10px #ff6b00, 0 0 20px #ff6b0066";
    case "MEDIUM":   return "0 0 8px #f5c518, 0 0 16px #f5c51866";
    case "LOW":      return "0 0 6px #00aaff, 0 0 12px #00aaff66";
  }
}

interface TooltipState {
  x: number;
  y: number;
  name: string;
  data: CountryData | undefined;
}

interface Props {
  signals: SignalItem[];
}

export default function WorldMapPage({ signals }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selected, setSelected] = useState<CountryData | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  const countryMap = useMemo(() => buildCountryMap(signals), [signals]);

  const activeCountries = countryMap.size;
  const criticalCount = [...countryMap.values()].filter(d => d.maxSeverity === "CRITICAL").length;
  const highCount = [...countryMap.values()].filter(d => d.maxSeverity === "HIGH").length;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-terminal-accent" />
          <h2 className="text-terminal-accent text-sm tracking-widest font-bold glow-accent">GEOPOLITICAL STRESS MAP</h2>
          <span className="text-terminal-dim text-xs">— {activeCountries} active regions</span>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#ff0a3c", boxShadow: "0 0 6px #ff0a3c" }} />
            <span className="text-terminal-dim">CRITICAL</span>
            <span className="text-terminal-sell font-bold">{criticalCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#ff6b00", boxShadow: "0 0 6px #ff6b00" }} />
            <span className="text-terminal-dim">HIGH</span>
            <span className="font-bold" style={{ color: "#ff6b00" }}>{highCount}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#f5c518", boxShadow: "0 0 6px #f5c518" }} />
            <span className="text-terminal-dim">MEDIUM</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#00aaff", boxShadow: "0 0 6px #00aaff" }} />
            <span className="text-terminal-dim">LOW</span>
          </span>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 border border-terminal-border/30 rounded-lg overflow-hidden bg-terminal-card/20 relative"
          style={{ minHeight: 480 }}
        >
          <ComposableMap
            projection="geoNaturalEarth1"
            style={{ width: "100%", height: "100%", minHeight: 480 }}
            projectionConfig={{ scale: 160, center: [10, 10] }}
          >
            <ZoomableGroup zoom={1}>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo: any) => {
                    const isoNum = Number(geo.id);
                    const data = countryMap.get(isoNum);
                    const fill = severityFill(data?.maxSeverity);
                    const isActive = !!data;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#0d1b2a"
                        strokeWidth={0.5}
                        style={{
                          default: {
                            outline: "none",
                            filter: isActive ? `drop-shadow(0 0 4px ${fill})` : "none",
                            cursor: isActive ? "pointer" : "default",
                          },
                          hover: {
                            fill: isActive ? fill : "#243040",
                            outline: "none",
                            filter: isActive ? `drop-shadow(0 0 8px ${fill})` : "none",
                          },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(e: any) => {
                          if (!isActive) return;
                          setTooltip({
                            x: e.clientX,
                            y: e.clientY,
                            name: geo.properties.name,
                            data,
                          });
                        }}
                        onMouseMove={(e: any) => {
                          if (!isActive) return;
                          setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={() => {
                          if (!isActive) return;
                          setSelected(data);
                          setSelectedName(geo.properties.name);
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {tooltip && tooltip.data && (
            <div
              className="fixed z-50 pointer-events-none px-3 py-2 rounded border text-xs"
              style={{
                left: tooltip.x + 12,
                top: tooltip.y - 10,
                background: "#050d18",
                borderColor: severityFill(tooltip.data.maxSeverity),
                boxShadow: severityGlow(tooltip.data.maxSeverity),
                color: severityFill(tooltip.data.maxSeverity),
              }}
            >
              <div className="font-bold">{tooltip.name}</div>
              <div className="text-terminal-dim mt-0.5">{tooltip.data.maxSeverity} · {tooltip.data.signals.length} signal{tooltip.data.signals.length !== 1 ? "s" : ""}</div>
            </div>
          )}

          <div className="absolute bottom-3 left-3 text-terminal-dim text-xs opacity-50">
            Click a highlighted country to view signals · Scroll to zoom
          </div>
        </div>

        {/* Side panel — selected country signals */}
        {selected && (
          <div className="w-96 border border-terminal-border/30 rounded-lg bg-terminal-card/20 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border/30"
              style={{ borderColor: `${severityFill(selected.maxSeverity)}44` }}
            >
              <div>
                <div className="text-xs text-terminal-dim tracking-widest">ACTIVE SIGNALS</div>
                <div className="font-bold text-sm mt-0.5" style={{ color: severityFill(selected.maxSeverity) }}>
                  {selectedName}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-terminal-dim hover:text-terminal-text">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              {selected.signals.slice(0, 20).map(sig => (
                <div
                  key={sig.id}
                  className="border border-terminal-border/20 rounded p-3 space-y-1.5 hover:bg-terminal-muted/20 transition-colors"
                  style={{ borderLeftColor: severityFill(sig.severity), borderLeftWidth: 2 }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="text-xs font-bold shrink-0 mt-0.5"
                      style={{ color: severityFill(sig.severity) }}
                    >
                      {sig.severity}
                    </span>
                    <a
                      href={sig.news_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-terminal-text hover:text-terminal-accent leading-snug"
                    >
                      {sig.news_title}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-terminal-dim">
                    <span>{sig.source}</span>
                    <span>·</span>
                    <span>{sig.event_label}</span>
                  </div>
                  {sig.market_signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {sig.market_signals.slice(0, 4).map(ms => (
                        <span
                          key={ms.asset}
                          className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded border font-bold ${
                            ms.signal === "BUY"
                              ? "text-terminal-buy border-terminal-buy/30 bg-terminal-buy/10"
                              : "text-terminal-sell border-terminal-sell/30 bg-terminal-sell/10"
                          }`}
                        >
                          {ms.signal === "BUY" ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                          {ms.asset_label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {selected.signals.length === 0 && (
                <div className="text-center py-8 text-terminal-dim text-xs">No signals</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom legend / active hotspots */}
      {activeCountries > 0 && (
        <div className="border border-terminal-border/30 rounded p-3 bg-terminal-card/20">
          <div className="text-xs text-terminal-dim tracking-widest mb-2 flex items-center gap-2">
            <AlertTriangle size={11} />
            ACTIVE HOTSPOTS
          </div>
          <div className="flex flex-wrap gap-2">
            {[...countryMap.entries()]
              .sort((a, b) => SEVERITY_ORDER[b[1].maxSeverity] - SEVERITY_ORDER[a[1].maxSeverity])
              .slice(0, 15)
              .map(([iso, data]) => (
                <span
                  key={iso}
                  className="text-xs px-2 py-0.5 rounded border font-bold cursor-pointer hover:opacity-80 transition-opacity"
                  style={{
                    color: severityFill(data.maxSeverity),
                    borderColor: `${severityFill(data.maxSeverity)}44`,
                    background: `${severityFill(data.maxSeverity)}11`,
                  }}
                >
                  {data.entityName} · {data.signals.length}
                </span>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
