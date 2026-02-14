/**
 * HexbinChart - Performance-optimized scatter plot using hexagonal binning
 *
 * Instead of rendering thousands of individual SVG circles, this component
 * aggregates properties into hexagonal bins and renders ~50-100 hexagons.
 * This dramatically improves performance while still showing distribution patterns.
 */

import { useMemo, useState } from "react";
import { hexbin as d3Hexbin, HexbinBin } from "d3-hexbin";
import { scaleLinear } from "d3-scale";
import type { PropertyData } from "@/hooks/useAnalytics";

// Color palette (matching MarketplaceDashboard)
const C = {
  bg: "#07090F",
  card: "#131922",
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

interface HexbinChartProps {
  properties: PropertyData[];
  width?: number;
  height?: number;
  hexRadius?: number;
}

interface HexBinData {
  x: number;
  y: number;
  property: PropertyData;
}

interface TooltipData {
  x: number;
  y: number;
  count: number;
  promoteCount: number;
  interventionCount: number;
  atRiskCount: number;
  avgViews: number;
  avgInitiationRate: number;
  avgRevenue: number;
  properties: PropertyData[];
}

export function HexbinChart({
  properties,
  width = 500,
  height = 420,
  hexRadius = 25,
}: HexbinChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const margin = { top: 20, right: 20, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Calculate scales and hexbin bins
  const { hexbins, xScale, yScale, maxCount } = useMemo(() => {
    if (properties.length === 0) {
      return { hexbins: [], xScale: null, yScale: null, maxCount: 0 };
    }

    // Calculate data extents
    const viewsExtent = [
      0,
      Math.max(...properties.map((p) => p.views)) * 1.1,
    ];
    const rateExtent = [
      0,
      Math.min(100, Math.max(...properties.map((p) => p.initiationRate)) * 1.2),
    ];

    // Create scales
    const xScale = scaleLinear().domain(viewsExtent).range([0, innerWidth]);
    const yScale = scaleLinear().domain(rateExtent).range([innerHeight, 0]);

    // Create hexbin generator
    const hexbinGenerator = d3Hexbin<HexBinData>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .radius(hexRadius)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ]);

    // Convert properties to points
    const points: HexBinData[] = properties.map((p) => ({
      x: p.views,
      y: p.initiationRate,
      property: p,
    }));

    // Generate hexbins
    const hexbins = hexbinGenerator(points);

    // Find max count for opacity scaling
    const maxCount = Math.max(...hexbins.map((bin) => bin.length), 1);

    return { hexbins, xScale, yScale, maxCount };
  }, [properties, innerWidth, innerHeight, hexRadius]);

  if (!xScale || !yScale || properties.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.muted,
        }}
      >
        No data available
      </div>
    );
  }

  // Determine dominant bucket color for a hexbin
  const getHexColor = (bin: HexbinBin<HexBinData>): string => {
    const counts = { promote: 0, intervention: 0, at_risk: 0 };
    bin.forEach((d) => {
      counts[d.property.bucket]++;
    });

    if (counts.promote >= counts.intervention && counts.promote >= counts.at_risk) {
      return C.green;
    } else if (counts.intervention >= counts.at_risk) {
      return C.yellow;
    }
    return C.red;
  };

  // Calculate tooltip data for a hexbin
  const getTooltipData = (
    bin: HexbinBin<HexBinData>,
    screenX: number,
    screenY: number
  ): TooltipData => {
    const props = bin.map((d) => d.property);
    const promoteCount = props.filter((p) => p.bucket === "promote").length;
    const interventionCount = props.filter((p) => p.bucket === "intervention").length;
    const atRiskCount = props.filter((p) => p.bucket === "at_risk").length;

    return {
      x: screenX,
      y: screenY,
      count: bin.length,
      promoteCount,
      interventionCount,
      atRiskCount,
      avgViews: Math.round(props.reduce((sum, p) => sum + p.views, 0) / props.length),
      avgInitiationRate:
        Math.round(
          (props.reduce((sum, p) => sum + p.initiationRate, 0) / props.length) * 10
        ) / 10,
      avgRevenue: Math.round(props.reduce((sum, p) => sum + p.revenue, 0) / props.length),
      properties: props.slice(0, 5), // Top 5 for display
    };
  };

  // Generate axis ticks
  const xTicks = xScale.ticks(5);
  const yTicks = yScale.ticks(5);

  return (
    <div style={{ position: "relative" }}>
      <svg width={width} height={height}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines */}
          {xTicks.map((tick) => (
            <line
              key={`x-grid-${tick}`}
              x1={xScale(tick)}
              x2={xScale(tick)}
              y1={0}
              y2={innerHeight}
              stroke={C.border}
              strokeDasharray="3,3"
            />
          ))}
          {yTicks.map((tick) => (
            <line
              key={`y-grid-${tick}`}
              x1={0}
              x2={innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={C.border}
              strokeDasharray="3,3"
            />
          ))}

          {/* Hexbins */}
          {hexbins.map((bin, i) => {
            const opacity = 0.4 + (bin.length / maxCount) * 0.5;
            const color = getHexColor(bin);

            return (
              <path
                key={i}
                d={d3Hexbin<HexBinData>().radius(hexRadius).hexagon()}
                transform={`translate(${bin.x},${bin.y})`}
                fill={color}
                fillOpacity={opacity}
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.8}
                style={{ cursor: "pointer", transition: "fill-opacity 0.15s" }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (rect) {
                    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    setTooltip(getTooltipData(bin, e.clientX - rect.left, e.clientY - rect.top));
                  }
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (rect) {
                    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}

          {/* X Axis */}
          <g transform={`translate(0,${innerHeight})`}>
            <line x1={0} x2={innerWidth} y1={0} y2={0} stroke={C.muted} />
            {xTicks.map((tick) => (
              <g key={`x-tick-${tick}`} transform={`translate(${xScale(tick)},0)`}>
                <line y2={6} stroke={C.muted} />
                <text
                  y={20}
                  textAnchor="middle"
                  fill={C.muted}
                  fontSize={10}
                >
                  {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
                </text>
              </g>
            ))}
            <text
              x={innerWidth / 2}
              y={40}
              textAnchor="middle"
              fill={C.muted}
              fontSize={11}
            >
              Total Property Views
            </text>
          </g>

          {/* Y Axis */}
          <g>
            <line x1={0} x2={0} y1={0} y2={innerHeight} stroke={C.muted} />
            {yTicks.map((tick) => (
              <g key={`y-tick-${tick}`} transform={`translate(0,${yScale(tick)})`}>
                <line x2={-6} stroke={C.muted} />
                <text
                  x={-10}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={C.muted}
                  fontSize={10}
                >
                  {tick}%
                </text>
              </g>
            ))}
            <text
              transform={`translate(-45,${innerHeight / 2}) rotate(-90)`}
              textAnchor="middle"
              fill={C.muted}
              fontSize={11}
            >
              Initiation Rate %
            </text>
          </g>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: mousePos.x + 15,
            top: mousePos.y - 10,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 12,
            fontSize: 11,
            color: C.text,
            pointerEvents: "none",
            zIndex: 100,
            minWidth: 180,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12 }}>
            {tooltip.count} {tooltip.count === 1 ? "Property" : "Properties"}
          </div>

          {/* Bucket breakdown */}
          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            {tooltip.promoteCount > 0 && (
              <span style={{ color: C.green }}>
                ● {tooltip.promoteCount} Promote
              </span>
            )}
            {tooltip.interventionCount > 0 && (
              <span style={{ color: C.yellow }}>
                ● {tooltip.interventionCount} Intervention
              </span>
            )}
            {tooltip.atRiskCount > 0 && (
              <span style={{ color: C.red }}>
                ● {tooltip.atRiskCount} At Risk
              </span>
            )}
          </div>

          {/* Averages */}
          <div style={{ color: C.textSoft, marginBottom: 8 }}>
            <div>Avg Views: {tooltip.avgViews.toLocaleString()}</div>
            <div>Avg Book Rate: {tooltip.avgInitiationRate}%</div>
            <div style={{ color: C.cyan }}>
              Avg Revenue: ${tooltip.avgRevenue.toLocaleString()}
            </div>
          </div>

          {/* Sample properties */}
          {tooltip.properties.length > 0 && (
            <div
              style={{
                borderTop: `1px solid ${C.border}`,
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <div style={{ color: C.muted, marginBottom: 4, fontSize: 10 }}>
                {tooltip.count > 5 ? "Sample properties:" : "Properties:"}
              </div>
              {tooltip.properties.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: C.textSoft,
                    fontSize: 10,
                  }}
                >
                  <span
                    style={{
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      color:
                        p.bucket === "promote"
                          ? C.green
                          : p.bucket === "intervention"
                          ? C.yellow
                          : C.red,
                    }}
                  >
                    {p.initiationRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
