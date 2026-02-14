/**
 * VirtualizedPropertyList - Efficient rendering for thousands of property cards
 *
 * Uses react-window v2 to only render visible items, dramatically improving
 * performance when displaying thousands of properties.
 *
 * Structure:
 * - Three collapsible sections (Intervention, At Risk, Promote)
 * - Each section has its own virtualized list
 * - Preserves all property card metrics and styling
 */

import { useState, useRef, useEffect, ReactElement, CSSProperties } from "react";
import { List, ListImperativeAPI } from "react-window";
import type { PropertyData } from "@/hooks/useAnalytics";

// Color palette (matching MarketplaceDashboard)
const C = {
  bg: "#07090F",
  card: "#131922",
  cardAlt: "#19202B",
  border: "#1C2433",
  text: "#E8ECF1",
  textSoft: "#A0ADBF",
  muted: "#5C6B7F",
  cyan: "#22D3EE",
  green: "#34D399",
  yellow: "#FBBF24",
  red: "#F87171",
  orange: "#FB923C",
};

// ============================================================================
// Property Card Row Component (for react-window v2)
// ============================================================================

interface PropertyRowProps {
  items: PropertyData[];
  borderColor: string;
}

interface PropertyRowComponentProps {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: CSSProperties;
  items: PropertyData[];
  borderColor: string;
}

function PropertyRowComponent({
  index,
  style,
  items,
  borderColor,
}: PropertyRowComponentProps): ReactElement | null {
  const p = items[index];
  if (!p) return null;

  const bucketColor =
    p.bucket === "promote" ? C.green : p.bucket === "intervention" ? C.yellow : C.red;

  return (
    <div style={style}>
      <div
        style={{
          background: C.bg,
          border: `1px solid ${borderColor}30`,
          borderLeft: `3px solid ${borderColor}`,
          borderRadius: 6,
          padding: "10px 14px",
          marginBottom: 6,
          marginRight: 4,
        }}
      >
        {/* Header: Name, City, Rating, Revenue */}
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

        {/* Metrics Grid: Views, Booked, Book%, Comp%, Fail%, Cancel% */}
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
            <div style={{ fontWeight: 600, color: bucketColor }}>
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
    </div>
  );
}

// ============================================================================
// Virtualized Group Section
// ============================================================================

interface VirtualizedGroupSectionProps {
  title: string;
  color: string;
  items: PropertyData[];
  borderColor: string;
  maxHeight?: number;
  defaultExpanded?: boolean;
}

const ITEM_HEIGHT = 95; // Height of each property card + margin

export function VirtualizedGroupSection({
  title,
  color,
  items,
  borderColor,
  maxHeight = 300,
  defaultExpanded = true,
}: VirtualizedGroupSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const listRef = useRef<ListImperativeAPI | null>(null);

  // Reset scroll position when items change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollToRow({ index: 0 });
    }
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  // Calculate list height (capped at maxHeight)
  const listHeight = Math.min(items.length * ITEM_HEIGHT, maxHeight);

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: expanded ? 10 : 0,
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color }}>
            {title} ({items.length.toLocaleString()})
          </span>
        </div>
        <span
          style={{
            color: C.muted,
            fontSize: 12,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </div>

      {/* Virtualized List */}
      {expanded && (
        <List<PropertyRowProps>
          listRef={listRef}
          rowComponent={PropertyRowComponent}
          rowCount={items.length}
          rowHeight={ITEM_HEIGHT}
          rowProps={{ items, borderColor }}
          style={{ height: listHeight, overflowX: "hidden" }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Main Property List Container
// ============================================================================

interface VirtualizedPropertyListProps {
  properties: PropertyData[];
  maxSectionHeight?: number;
}

export function VirtualizedPropertyList({
  properties,
  maxSectionHeight = 250,
}: VirtualizedPropertyListProps) {
  // Sort properties into buckets by views descending
  const { intervention, atRisk, promote } = {
    intervention: properties
      .filter((p) => p.bucket === "intervention")
      .sort((a, b) => b.views - a.views),
    atRisk: properties
      .filter((p) => p.bucket === "at_risk")
      .sort((a, b) => b.views - a.views),
    promote: properties
      .filter((p) => p.bucket === "promote")
      .sort((a, b) => b.views - a.views),
  };

  return (
    <div style={{ maxHeight: 540, overflowY: "auto", paddingRight: 4 }}>
      <VirtualizedGroupSection
        title="Intervention Required"
        color={C.red}
        items={intervention}
        borderColor={C.red}
        maxHeight={maxSectionHeight}
        defaultExpanded={true}
      />
      <VirtualizedGroupSection
        title="At Risk"
        color={C.yellow}
        items={atRisk}
        borderColor={C.yellow}
        maxHeight={maxSectionHeight}
        defaultExpanded={true}
      />
      <VirtualizedGroupSection
        title="Promote"
        color={C.green}
        items={promote}
        borderColor={C.green}
        maxHeight={maxSectionHeight}
        defaultExpanded={true}
      />
    </div>
  );
}
