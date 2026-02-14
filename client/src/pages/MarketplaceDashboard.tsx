import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  useCities,
  useCityInvestment,
  useCityFunnel,
  useProperties,
  usePropertyTypes,
  useAmenities,
  useTopAmenitiesByCity,
  useDeviceMetrics,
  type PropertyData,
  type AmenityData,
  type TopAmenityByCityData,
} from "@/hooks/useAnalytics";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

interface FunnelData {
  viewers: number;
  bookers: number;
  completed: number;
}

interface CityInvestment {
  city: string;
  demand: number;
  conversion: number;
  revenue: number;
  quadrant?: string;
}

interface WeeklyTrend {
  w: string;
  mobile: number;
  desktop: number;
  tablet: number;
}

interface AmenityChartData {
  name: string;
  lift: number;
}

interface CityTopAmenity {
  city: string;
  propertyType: string;
  top3: AmenityChartData[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const DATES = ["Last 30 Days", "Last 90 Days", "Last 365 Days"];
const DATE_TO_DAYS: Record<string, number> = {
  "Last 30 Days": 30,
  "Last 90 Days": 90,
  "Last 365 Days": 365,
};

/* ═══════════════════════════════════════════════════════════════════════════
   PALETTE
   ═══════════════════════════════════════════════════════════════════════════ */

const C = {
  bg: "#07090F",
  surface: "#0D1117",
  card: "#131922",
  cardAlt: "#19202B",
  border: "#1C2433",
  borderLight: "#253044",
  text: "#E8ECF1",
  textSoft: "#A0ADBF",
  muted: "#5C6B7F",
  cyan: "#22D3EE",
  cyanDim: "#0E4B55",
  green: "#34D399",
  greenDim: "#064E3B",
  yellow: "#FBBF24",
  yellowDim: "#713F12",
  red: "#F87171",
  redDim: "#7F1D1D",
  purple: "#A78BFA",
  purpleDim: "#3B1F7E",
  pink: "#F472B6",
  orange: "#FB923C",
};

const QC: Record<string, string> = {
  "Fix Supply/UX": C.red,
  "Invest Marketing": C.yellow,
  "Protect & Expand": C.green,
  Deprioritize: C.muted,
};

/* ═══════════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label?: string;
}

const Select = ({ value, onChange, options, label }: SelectProps) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    {label && (
      <span
        style={{
          color: C.muted,
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1.5,
        }}
      >
        {label}
      </span>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.cardAlt,
        color: C.text,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        padding: "5px 10px",
        fontSize: 12,
        fontFamily: "'JetBrains Mono',monospace",
        cursor: "pointer",
        outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Pill = ({ active, onClick, children }: PillProps) => (
  <button
    onClick={onClick}
    style={{
      padding: "7px 18px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      background: active ? C.cyan : "transparent",
      color: active ? C.bg : C.muted,
      border: `1px solid ${active ? C.cyan : C.border}`,
      transition: "all .15s",
      fontFamily: "'DM Sans',sans-serif",
      letterSpacing: 0.2,
    }}
  >
    {children}
  </button>
);

interface PanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const Panel = ({ children, style }: PanelProps) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: 20,
      ...style,
    }}
  >
    {children}
  </div>
);

interface SHProps {
  title: string;
  subtitle?: string;
  controls?: React.ReactNode;
}

const SH = ({ title, subtitle, controls }: SHProps) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: 10,
      marginBottom: 14,
    }}
  >
    <div>
      <h3
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p style={{ margin: "2px 0 0", fontSize: 11, color: C.muted }}>
          {subtitle}
        </p>
      )}
    </div>
    {controls && (
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {controls}
      </div>
    )}
  </div>
);

interface DFProps {
  value: string;
  onChange: (value: string) => void;
}

const DF = ({ value, onChange }: DFProps) => (
  <Select value={value} onChange={onChange} options={DATES} label="Period" />
);

/* ═══════════════════════════════════════════════════════════════════════════
   LOADING COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const LoadingSpinner = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
      color: C.muted,
    }}
  >
    <div
      style={{
        width: 24,
        height: 24,
        border: `2px solid ${C.border}`,
        borderTopColor: C.cyan,
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1: OVERVIEW
   ═══════════════════════════════════════════════════════════════════════════ */

function OverviewTab() {
  const [dateRange, setDateRange] = useState("Last 90 Days");
  const [funnelCity, setFunnelCity] = useState<string | null>(null);

  // Fetch data from API
  const { data: cities = [], isLoading: citiesLoading } = useCities();
  const { data: investmentData = [], isLoading: investmentLoading } =
    useCityInvestment();
  const days = DATE_TO_DAYS[dateRange] || 90;
  const { data: funnelData, isLoading: funnelLoading } = useCityFunnel(
    funnelCity,
    days
  );

  // Map investment data with quadrant (comes from API)
  const data = investmentData.map((c) => ({
    ...c,
    quadrant: c.quadrant || "Unknown",
  }));

  const recs: Record<string, { icon: string; desc: string }> = {
    "Fix Supply/UX": {
      icon: "🔧",
      desc: "High demand, low conversion. Improve listings, pricing, or checkout.",
    },
    "Invest Marketing": {
      icon: "📣",
      desc: "Strong conversion, low traffic. Scale acquisition for high ROI.",
    },
    "Protect & Expand": {
      icon: "🛡️",
      desc: "Performing well. Protect share, expand supply.",
    },
    Deprioritize: { icon: "⏸️", desc: "Low signal. Revisit quarterly." },
  };

  // Calculate funnel metrics from API data
  const cf = funnelData?.funnel || { viewers: 0, bookers: 0, completed: 0 };
  const viewToBook =
    cf.viewers > 0 ? ((1 - cf.bookers / cf.viewers) * 100).toFixed(1) : "0";
  const bookToComplete =
    cf.bookers > 0 ? ((1 - cf.completed / cf.bookers) * 100).toFixed(1) : "0";
  const biggestDrop =
    parseFloat(viewToBook) > parseFloat(bookToComplete)
      ? "View → Book"
      : "Book → Complete";

  // Calculate vs platform average
  const allCitiesFunnel = investmentData.reduce(
    (acc, c) => ({
      viewers: acc.viewers + c.demand,
      completed: acc.completed + Math.round((c.demand * c.conversion) / 100),
    }),
    { viewers: 0, completed: 0 }
  );
  const allRate =
    allCitiesFunnel.viewers > 0
      ? (allCitiesFunnel.completed / allCitiesFunnel.viewers) * 100
      : 0;
  const thisRate = cf.viewers > 0 ? (cf.completed / cf.viewers) * 100 : 0;
  const vsAll = funnelCity ? (thisRate - allRate).toFixed(1) : null;

  if (investmentLoading || citiesLoading || funnelLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Row 1: Matrix + Combined Funnel */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 14 }}
      >
        <Panel>
          <SH
            title="Investment Priority Matrix"
            subtitle="Bubble size = estimated revenue"
            controls={<DF value={dateRange} onChange={setDateRange} />}
          />
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 12, right: 22, bottom: 22, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                type="number"
                dataKey="demand"
                stroke={C.muted}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Demand (Viewers)",
                  position: "insideBottom",
                  offset: -14,
                  fill: C.muted,
                  fontSize: 10,
                }}
              />
              <YAxis
                type="number"
                dataKey="conversion"
                stroke={C.muted}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Conv %",
                  angle: -90,
                  position: "insideLeft",
                  fill: C.muted,
                  fontSize: 10,
                }}
              />
              <ZAxis type="number" dataKey="revenue" range={[100, 450]} />
              <ReferenceLine
                x={8000}
                stroke={C.borderLight}
                strokeDasharray="6 4"
              />
              <ReferenceLine
                y={20}
                stroke={C.borderLight}
                strokeDasharray="6 4"
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload as CityInvestment & {
                    quadrant: string;
                  };
                  return (
                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 11,
                        color: C.text,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {d.city}
                      </div>
                      <div>Viewers: {d.demand.toLocaleString()}</div>
                      <div>Conversion: {d.conversion}%</div>
                      <div
                        style={{
                          marginTop: 4,
                          color: QC[d.quadrant],
                          fontWeight: 600,
                        }}
                      >
                        → {d.quadrant}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={data}>
                {data.map((d, i) => (
                  <Cell key={i} fill={QC[d.quadrant!]} fillOpacity={0.85} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            {Object.entries(QC).map(([l, c]) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  color: C.textSoft,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: c,
                  }}
                />
                {l}
              </div>
            ))}
          </div>
        </Panel>

        {/* Combined Funnel */}
        <Panel>
          <SH
            title="Conversion Funnel"
            controls={
              <Select
                value={funnelCity ?? "All Cities"}
                onChange={(v) => setFunnelCity(v === "All Cities" ? null : v)}
                options={["All Cities", ...cities]}
                label=""
              />
            }
          />
          {[
            { label: "Viewers", val: cf.viewers, pct: 100, color: C.cyan },
            {
              label: "Booked",
              val: cf.bookers,
              pct: (cf.bookers / cf.viewers) * 100,
              color: C.yellow,
            },
            {
              label: "Completed",
              val: cf.completed,
              pct: (cf.completed / cf.viewers) * 100,
              color: C.green,
            },
          ].map((s) => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: C.textSoft,
                  marginBottom: 3,
                }}
              >
                <span>{s.label}</span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    color: s.color,
                  }}
                >
                  {s.val.toLocaleString()}{" "}
                  <span style={{ color: C.muted }}>({s.pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div
                style={{
                  background: C.bg,
                  borderRadius: 4,
                  height: 18,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${s.pct}%`,
                    height: "100%",
                    background: `linear-gradient(90deg,${s.color},${s.color}55)`,
                    borderRadius: 4,
                    transition: "width .4s",
                  }}
                />
              </div>
            </div>
          ))}

          {/* Drop-offs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: vsAll !== null ? "1fr 1fr 1fr" : "1fr 1fr",
              gap: 8,
              marginTop: 12,
            }}
          >
            {[
              {
                label: "View → Book",
                pct: viewToBook,
                isMax: biggestDrop === "View → Book",
              },
              {
                label: "Book → Complete",
                pct: bookToComplete,
                isMax: biggestDrop === "Book → Complete",
              },
            ].map((dr) => (
              <div
                key={dr.label}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: dr.isMax ? C.redDim : C.bg,
                  border: `1px solid ${dr.isMax ? `${C.red}35` : C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: C.muted,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  {dr.label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: dr.isMax ? C.red : C.yellow,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  -{dr.pct}%
                </div>
                {dr.isMax && (
                  <div style={{ fontSize: 9, color: C.red }}>⚠ Largest</div>
                )}
              </div>
            ))}
            {vsAll !== null && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: C.muted,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  vs. Platform
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: parseFloat(vsAll) >= 0 ? C.green : C.red,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {parseFloat(vsAll) >= 0 ? "+" : ""}
                  {vsAll}pp
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Row 2: Quadrant cards */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}
      >
        {Object.entries(recs).map(([q, r]) => {
          const cities = data.filter((d) => d.quadrant === q);
          return (
            <div
              key={q}
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: 12,
                borderTop: `3px solid ${QC[q]}`,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 2,
                }}
              >
                {r.icon} {q}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.muted,
                  marginBottom: 6,
                  lineHeight: 1.4,
                }}
              >
                {r.desc}
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {cities.map((c) => (
                  <span
                    key={c.city}
                    style={{
                      background: C.bg,
                      padding: "2px 7px",
                      borderRadius: 4,
                      fontSize: 10,
                      color: QC[q],
                      fontWeight: 600,
                    }}
                  >
                    {c.city}
                  </span>
                ))}
                {cities.length === 0 && (
                  <span style={{ fontSize: 10, color: C.muted }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2: PROPERTY PERFORMANCE
   ═══════════════════════════════════════════════════════════════════════════ */

function PropertyTab() {
  const [city, setCity] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("Last Quarter");

  // Fetch data from API
  const { data: cities = [], isLoading: citiesLoading } = useCities();
  const { data: propertiesResult, isLoading: propertiesLoading } = useProperties(city);

  if (citiesLoading || propertiesLoading) {
    return <LoadingSpinner />;
  }

  const properties = propertiesResult?.properties ?? [];

  // Use backend bucketing, sorted by views descending within each bucket
  const promote = properties
    .filter((p) => p.bucket === "promote")
    .sort((a, b) => b.views - a.views);
  const intervention = properties
    .filter((p) => p.bucket === "intervention")
    .sort((a, b) => b.views - a.views);
  const atRisk = properties
    .filter((p) => p.bucket === "at_risk")
    .sort((a, b) => b.views - a.views);

  const PropertyCard = ({
    p,
    borderColor,
  }: {
    p: PropertyData;
    borderColor: string;
  }) => (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${borderColor}30`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 6,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {p.name}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            {p.city} · {p.propertyType || "Unknown"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {p.avgReviewRating && (
            <div style={{ fontSize: 11, color: C.yellow }}>
              ★ {p.avgReviewRating}
            </div>
          )}
          <div
            style={{
              fontSize: 11,
              color: C.cyan,
              fontFamily: "'JetBrains Mono',monospace",
            }}
          >
            ${p.revenue.toLocaleString()}
          </div>
        </div>
      </div>
      {/* Key metrics grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 4,
          fontSize: 10,
          fontFamily: "'JetBrains Mono',monospace",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Views</div>
          <div style={{ color: C.textSoft, fontWeight: 600 }}>
            {p.views.toLocaleString()}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Booked</div>
          <div style={{ color: C.textSoft, fontWeight: 600 }}>{p.bookings}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Book %</div>
          <div
            style={{
              fontWeight: 600,
              color: p.bucket === "promote" ? C.green : p.bucket === "intervention" ? C.yellow : C.red,
            }}
          >
            {p.initiationRate}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Comp %</div>
          <div style={{ color: C.textSoft, fontWeight: 600 }}>
            {p.completionRate}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Fail %</div>
          <div
            style={{
              fontWeight: 600,
              color: p.paymentFailRate > 10 ? C.red : C.textSoft,
            }}
          >
            {p.paymentFailRate}%
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: C.muted, marginBottom: 2 }}>Cancel %</div>
          <div
            style={{
              fontWeight: 600,
              color: p.cancelRate > 20 ? C.orange : C.textSoft,
            }}
          >
            {p.cancelRate}%
          </div>
        </div>
      </div>
    </div>
  );

  const GroupSection = ({
    title,
    color,
    items,
    borderColor,
  }: {
    title: string;
    color: string;
    items: PropertyData[];
    borderColor: string;
  }) =>
    items.length > 0 && (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color }}>
            {title} ({items.length})
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((p) => (
            <PropertyCard key={p.id} p={p} borderColor={borderColor} />
          ))}
        </div>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Select
          value={city ?? "All Cities"}
          onChange={(v) => setCity(v === "All Cities" ? null : v)}
          options={["All Cities", ...cities]}
          label="City"
        />
        <DF value={dateRange} onChange={setDateRange} />
      </div>

      {/* Chart + Grouped Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Panel>
          <SH title="Distribution" subtitle="Views vs. Initiation Rate" />
          {/* Legend at top */}
          <div
            style={{
              display: "flex",
              gap: 14,
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: C.textSoft,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: C.green,
                }}
              />
              Promote
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: C.textSoft,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: C.yellow,
                }}
              />
              Intervention
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 10,
                color: C.textSoft,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: C.red,
                }}
              />
              At Risk
            </span>
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 10, right: 15, bottom: 35, left: 45 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                type="number"
                dataKey="views"
                stroke={C.muted}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Total Property Views",
                  position: "insideBottom",
                  offset: -10,
                  fill: C.muted,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="initiationRate"
                stroke={C.muted}
                tick={{ fontSize: 10 }}
                label={{
                  value: "Initiation Rate %",
                  angle: -90,
                  position: "insideLeft",
                  fill: C.muted,
                  fontSize: 11,
                  style: { textAnchor: "middle" },
                }}
              />
              <ZAxis type="number" dataKey="revenue" range={[80, 300]} />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null;
                  const d = payload[0].payload as PropertyData;
                  const bucketColor = d.bucket === "promote" ? C.green : d.bucket === "intervention" ? C.yellow : C.red;
                  return (
                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 11,
                        color: C.text,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div style={{ color: C.muted, marginBottom: 4 }}>{d.city}</div>
                      <div>Views: {d.views.toLocaleString()} · Booked: {d.bookings}</div>
                      <div>
                        Book %: <span style={{ color: bucketColor }}>{d.initiationRate}%</span>
                        {" · "}Comp: {d.completionRate}%
                      </div>
                      <div>
                        Fail: <span style={{ color: d.paymentFailRate > 10 ? C.red : C.textSoft }}>{d.paymentFailRate}%</span>
                        {" · "}Cancel: <span style={{ color: d.cancelRate > 20 ? C.orange : C.textSoft }}>{d.cancelRate}%</span>
                      </div>
                      {d.avgReviewRating && (
                        <div style={{ color: C.yellow }}>★ {d.avgReviewRating}</div>
                      )}
                      <div style={{ color: C.cyan }}>${d.revenue.toLocaleString()}</div>
                      <div style={{ marginTop: 4, color: bucketColor, fontWeight: 600 }}>
                        → {d.bucket.replace("_", " ").toUpperCase()}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={properties}>
                {properties.map((p, i) => {
                  const cat = p.bucket === "promote" ? C.green : p.bucket === "intervention" ? C.yellow : C.red;
                  return <Cell key={i} fill={cat} fillOpacity={0.8} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Panel>

        {/* Grouped Property Cards */}
        <div style={{ maxHeight: 540, overflowY: "auto", paddingRight: 4 }}>
          <GroupSection
            title="Intervention Required"
            color={C.red}
            items={intervention}
            borderColor={C.red}
          />
          <GroupSection
            title="At Risk"
            color={C.yellow}
            items={atRisk}
            borderColor={C.yellow}
          />
          <GroupSection
            title="Promote"
            color={C.green}
            items={promote}
            borderColor={C.green}
          />
        </div>
      </div>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 3: AMENITY IMPACT
   ═══════════════════════════════════════════════════════════════════════════ */

function AmenityTab() {
  const [city, setCity] = useState<string | null>(null);
  const [propType, setPropType] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("Last Quarter");

  // Fetch data from API
  const { data: cities = [], isLoading: citiesLoading } = useCities();
  const { data: propertyTypes = [], isLoading: typesLoading } =
    usePropertyTypes();
  const { data: amenities = [], isLoading: amenitiesLoading } = useAmenities(
    city,
    propType
  );
  const { data: topAmenitiesData = [], isLoading: topLoading } =
    useTopAmenitiesByCity();

  // Transform amenities data for chart
  const chartData: AmenityChartData[] = amenities
    .map((a: AmenityData) => ({ name: a.name, lift: a.lift }))
    .sort((a, b) => b.lift - a.lift);

  const topAmenity = chartData[0] || { name: "N/A", lift: 0 };
  const baseline = chartData.filter((a) => a.lift >= 8);
  const negligible = chartData.filter((a) => a.lift < 4);

  // Group top amenities by city for the grid
  const cityTopAmenities: CityTopAmenity[] = useMemo(() => {
    const grouped = new Map<string, TopAmenityByCityData[]>();
    topAmenitiesData.forEach((item) => {
      const key = item.city;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    return Array.from(grouped.entries()).map(([c, items]) => ({
      city: c,
      propertyType: items[0]?.propertyType || "",
      top3: items
        .sort((a, b) => a.rank - b.rank)
        .slice(0, 3)
        .map((i) => ({ name: i.amenityName, lift: i.lift })),
    }));
  }, [topAmenitiesData]);

  if (citiesLoading || typesLoading || amenitiesLoading || topLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel>
        <SH
          title="Amenity Impact on Booking Conversion"
          subtitle="Conversion lift when amenity present vs. absent"
          controls={
            <div style={{ display: "flex", gap: 8 }}>
              <Select
                value={city ?? "All Cities"}
                onChange={(v) => setCity(v === "All Cities" ? null : v)}
                options={["All Cities", ...cities]}
                label="City"
              />
              <Select
                value={propType ?? "All Types"}
                onChange={(v) => setPropType(v === "All Types" ? null : v)}
                options={["All Types", ...propertyTypes]}
                label="Type"
              />
              <DF value={dateRange} onChange={setDateRange} />
            </div>
          }
        />
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 85, right: 20, top: 5, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={C.border}
              horizontal={false}
            />
            <XAxis
              type="number"
              stroke={C.muted}
              tick={{ fontSize: 10 }}
              label={{
                value: "Conversion Lift %",
                position: "insideBottom",
                offset: -5,
                fill: C.muted,
                fontSize: 10,
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={C.muted}
              tick={{ fontSize: 11 }}
              width={80}
            />
            <Tooltip
              cursor={{ fill: `${C.cyan}08` }}
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const v = payload[0].value as number;
                const tier =
                  v >= 8 ? "Must-Have" : v >= 4 ? "Differentiator" : "Low Impact";
                const tc = v >= 8 ? C.green : v >= 4 ? C.cyan : C.muted;
                return (
                  <div
                    style={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 11,
                      color: C.text,
                    }}
                  >
                    <strong>{payload[0].payload.name}</strong>: +{v}% lift
                    <br />
                    <span style={{ color: tc }}>{tier}</span>
                  </div>
                );
              }}
            />
            <Bar dataKey="lift" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.lift >= 8 ? C.green : d.lift >= 4 ? C.cyan : C.muted}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Insights */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginTop: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: `${C.green}08`,
              border: `1px solid ${C.green}20`,
            }}
          >
            <span style={{ fontSize: 15 }}>🏆</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
                Top Driver: {topAmenity.name}
              </div>
              <div style={{ fontSize: 11, color: C.textSoft }}>
                +{topAmenity.lift}% conversion lift
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: `${C.cyan}08`,
              border: `1px solid ${C.cyan}20`,
            }}
          >
            <span style={{ fontSize: 15 }}>📋</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.cyan }}>
                {baseline.length} Must-Haves
              </div>
              <div style={{ fontSize: 11, color: C.textSoft }}>
                {baseline.map((a) => a.name).join(", ")}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 8,
              background: `${C.muted}08`,
              border: `1px solid ${C.muted}20`,
            }}
          >
            <span style={{ fontSize: 15 }}>💤</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
                {negligible.length} Low Impact
              </div>
              <div style={{ fontSize: 11, color: C.textSoft }}>
                {negligible.length > 0
                  ? negligible.map((a) => a.name).join(", ")
                  : "All meaningful"}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Per-city top amenities */}
      <Panel>
        <SH
          title="Top Conversion Amenities by City"
          subtitle="Highest-lift amenities per city"
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 10,
          }}
        >
          {cityTopAmenities.map(({ city: c, top3 }) => (
            <div
              key={c}
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 8,
                }}
              >
                {c}
              </div>
              {top3.map((a, i) => (
                <div
                  key={a.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: C.muted,
                        fontFamily: "'JetBrains Mono',monospace",
                        width: 14,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: i === 0 ? C.green : C.textSoft,
                        fontWeight: i === 0 ? 600 : 400,
                      }}
                    >
                      {a.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: i === 0 ? C.green : C.cyan,
                      fontFamily: "'JetBrains Mono',monospace",
                      fontWeight: 600,
                    }}
                  >
                    +{a.lift}%
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 4: DEMAND & SEGMENTATION
   ═══════════════════════════════════════════════════════════════════════════ */

function DemandTab() {
  const [city, setCity] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("Last Quarter");

  // Fetch data from API
  const { data: cities = [], isLoading: citiesLoading } = useCities();
  const { data: deviceData, isLoading: deviceLoading } = useDeviceMetrics(
    city,
    6
  );

  if (citiesLoading || deviceLoading || !deviceData) {
    return <LoadingSpinner />;
  }

  // Extract device funnel data
  const df = deviceData.deviceFunnel || {};
  const defaultFunnel: FunnelData = { viewers: 0, bookers: 0, completed: 0 };

  const devices: {
    key: string;
    label: string;
    color: string;
    data: FunnelData;
  }[] = [
    {
      key: "desktop",
      label: "Desktop",
      color: C.cyan,
      data: df["desktop"] || defaultFunnel,
    },
    {
      key: "mobile",
      label: "Mobile",
      color: C.pink,
      data: df["mobile"] || defaultFunnel,
    },
    {
      key: "tablet",
      label: "Tablet",
      color: C.yellow,
      data: df["tablet"] || defaultFunnel,
    },
  ];

  // Transform weekly trends for chart
  const trends: WeeklyTrend[] = (deviceData.weeklyTrends || []).map((t) => ({
    w: t.week,
    desktop: t.desktop ?? 0,
    mobile: t.mobile ?? 0,
    tablet: t.tablet ?? 0,
  }));

  // Use diagnosis from API
  const diagnosis = deviceData.diagnosis || {
    desktopRate: 0,
    mobileRate: 0,
    tabletRate: 0,
    deviceGap: 0,
    diagnosis: "Unknown",
    mobileTrend: "stable",
  };

  const gap = Math.round(diagnosis.deviceGap);
  const isUXIssue = diagnosis.diagnosis.toLowerCase().includes("ux");
  const mobileTrend = diagnosis.mobileTrend;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Diagnostic legend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div
          style={{
            background: `${C.red}06`,
            border: `1px solid ${C.red}15`,
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: C.red }}>
            Large device gap → UX / experience problem
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Mobile underperformance points to checkout, speed, or layout issues.
          </div>
        </div>
        <div
          style={{
            background: `${C.green}06`,
            border: `1px solid ${C.green}15`,
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
            Consistent across devices → Supply or pricing problem
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Similar rates across devices means the bottleneck is listings or
            price.
          </div>
        </div>
      </div>

      {/* Device-segmented funnel */}
      <Panel>
        <SH
          title="Funnel by Device"
          subtitle="Full conversion journey segmented by device type"
          controls={
            <div style={{ display: "flex", gap: 8 }}>
              <Select
                value={city ?? "All Cities"}
                onChange={(v) => setCity(v === "All Cities" ? null : v)}
                options={["All Cities", ...cities]}
                label="City"
              />
              <DF value={dateRange} onChange={setDateRange} />
            </div>
          }
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
          }}
        >
          {devices.map((dev) => {
            const d = dev.data;
            const viewToBook = ((1 - d.bookers / d.viewers) * 100).toFixed(1);
            const bookToComplete = ((1 - d.completed / d.bookers) * 100).toFixed(
              1
            );
            const convRate = ((d.completed / d.viewers) * 100).toFixed(1);
            const bigDrop =
              parseFloat(viewToBook) > parseFloat(bookToComplete)
                ? "View→Book"
                : "Book→Complete";
            const bigVal = Math.max(
              parseFloat(viewToBook),
              parseFloat(bookToComplete)
            );
            return (
              <div
                key={dev.key}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 14,
                  borderTop: `3px solid ${dev.color}`,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: dev.color,
                    marginBottom: 10,
                  }}
                >
                  {dev.label}
                </div>

                {/* Mini funnel bars */}
                {[
                  { label: "Viewers", val: d.viewers, pct: 100 },
                  {
                    label: "Booked",
                    val: d.bookers,
                    pct: (d.bookers / d.viewers) * 100,
                  },
                  {
                    label: "Completed",
                    val: d.completed,
                    pct: (d.completed / d.viewers) * 100,
                  },
                ].map((s) => (
                  <div key={s.label} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        color: C.textSoft,
                        marginBottom: 2,
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                        {s.val.toLocaleString()}
                      </span>
                    </div>
                    <div
                      style={{
                        background: C.card,
                        borderRadius: 3,
                        height: 12,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${s.pct}%`,
                          height: "100%",
                          background: `${dev.color}55`,
                          borderRadius: 3,
                          transition: "width .4s",
                        }}
                      />
                    </div>
                  </div>
                ))}

                {/* Stats */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      background: C.card,
                      borderRadius: 6,
                      padding: 8,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Conv Rate
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: dev.color,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      {convRate}%
                    </div>
                  </div>
                  <div
                    style={{
                      background: C.card,
                      borderRadius: 6,
                      padding: 8,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      Biggest Drop
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.red,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      {bigDrop}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.red,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      -{bigVal}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Conversion trend over time */}
      <Panel>
        <SH title="Conversion Trend Over Time" />
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={trends}
            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="w" stroke={C.muted} tick={{ fontSize: 10 }} />
            <YAxis
              stroke={C.muted}
              tick={{ fontSize: 10 }}
              label={{
                value: "Conv %",
                angle: -90,
                position: "insideLeft",
                fill: C.muted,
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: 11,
                color: C.text,
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="desktop"
              stroke={C.cyan}
              strokeWidth={2.5}
              dot={{ r: 3, fill: C.cyan }}
            />
            <Line
              type="monotone"
              dataKey="mobile"
              stroke={C.pink}
              strokeWidth={2.5}
              dot={{ r: 3, fill: C.pink }}
            />
            <Line
              type="monotone"
              dataKey="tablet"
              stroke={C.yellow}
              strokeWidth={2.5}
              dot={{ r: 3, fill: C.yellow }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Diagnosis */}
      <div
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: isUXIssue ? C.redDim : C.greenDim,
          border: `1px solid ${isUXIssue ? `${C.red}30` : `${C.green}30`}`,
        }}
      >
        <span style={{ fontSize: 18 }}>{isUXIssue ? "📱" : "✅"}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: isUXIssue ? C.red : C.green,
          }}
        >
          {diagnosis.diagnosis}
        </span>
        <span style={{ fontSize: 11, color: C.textSoft }}>
          · Device gap: {gap}% · Mobile trend:{" "}
          {mobileTrend.toLowerCase().includes("improving") ? "↑" : "↓"}{" "}
          {mobileTrend}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const TABS = [
  "Overview",
  "Property Performance",
  "Amenity Impact",
  "Demand & Segmentation",
];

export function MarketplaceDashboard() {
  const [tab, setTab] = useState(0);

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        color: C.text,
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ padding: "24px 32px 0", maxWidth: 1140, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.green,
              boxShadow: `0 0 8px ${C.green}60`,
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: C.green,
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: 700,
            }}
          >
            Marketplace Intelligence
          </span>
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono',monospace",
            color: C.text,
            letterSpacing: -0.5,
          }}
        >
          Where Do We Invest Next?
        </h1>
        <p
          style={{ margin: "5px 0 18px", fontSize: 12, color: C.muted }}
        >
          Marketing · Supply Quality · Amenities · Experience
        </p>
        <div
          style={{
            display: "flex",
            gap: 6,
            paddingBottom: 18,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {TABS.map((t, i) => (
            <Pill key={t} active={tab === i} onClick={() => setTab(i)}>
              {t}
            </Pill>
          ))}
        </div>
      </div>

      <div
        style={{ maxWidth: 1140, margin: "0 auto", padding: "20px 32px 60px" }}
      >
        {tab === 0 && <OverviewTab />}
        {tab === 1 && <PropertyTab />}
        {tab === 2 && <AmenityTab />}
        {tab === 3 && <DemandTab />}
      </div>
    </div>
  );
}
