import { useState } from "react";
import { CHART_INK } from "./chartTokens";

export interface StackedColumn {
  key: string;
  label: string;
  segments: { key: string; label: string; value: number; color: string }[];
}

export interface LegendEntry {
  key: string;
  label: string;
  color: string;
}

/** "Tell distinct series apart" across categories → grouped/stacked bar,
 * categorical color, legend always present for ≥2 series (choosing-a-form
 * guide). One column per category (e.g. batch year), stacked segments
 * within each column (e.g. placement outcome). */
export function StackedColumnChart({
  columns,
  legend,
  height = 220,
}: {
  columns: StackedColumn[];
  legend: LegendEntry[];
  height?: number;
}) {
  const [hovered, setHovered] = useState<{ colKey: string; segKey: string } | null>(null);

  const width = Math.max(320, columns.length * 90);
  const padding = { top: 12, right: 12, bottom: 28, left: 12 };
  const plotHeight = height - padding.top - padding.bottom;
  const plotWidth = width - padding.left - padding.right;

  const totals = columns.map((c) => c.segments.reduce((sum, s) => sum + s.value, 0));
  const maxTotal = Math.max(1, ...totals);
  const niceMax = Math.ceil(maxTotal / 5) * 5 || 5;

  const colSlot = plotWidth / Math.max(1, columns.length);
  const barWidth = Math.min(40, colSlot * 0.6);
  const gap = 2;

  if (columns.length === 0 || maxTotal === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Stacked column chart">
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke={CHART_INK.baseline}
            strokeWidth={1}
          />
          {columns.map((col, i) => {
            const x = padding.left + i * colSlot + (colSlot - barWidth) / 2;
            const total = col.segments.reduce((sum, s) => sum + s.value, 0);
            let cursorY = padding.top + plotHeight;
            return (
              <g key={col.key}>
                {col.segments.map((s, si) => {
                  if (s.value === 0) return null;
                  const segHeight = (s.value / niceMax) * plotHeight;
                  const y = cursorY - segHeight;
                  cursorY = y - gap;
                  const isTop = si === col.segments.filter((x2) => x2.value > 0).length - 1;
                  const isHovered = hovered?.colKey === col.key && hovered.segKey === s.key;
                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(segHeight, 1)}
                      rx={isTop ? 4 : 0}
                      fill={s.color}
                      opacity={isHovered ? 1 : 0.88}
                      tabIndex={0}
                      role="img"
                      aria-label={`${col.label} · ${s.label}: ${s.value}`}
                      onMouseEnter={() => setHovered({ colKey: col.key, segKey: s.key })}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered({ colKey: col.key, segKey: s.key })}
                      onBlur={() => setHovered(null)}
                      style={{ cursor: "pointer", outline: "none" }}
                    />
                  );
                })}
                <text
                  x={x + barWidth / 2}
                  y={padding.top + plotHeight - (total / niceMax) * plotHeight - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={CHART_INK.primary}
                >
                  {total}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={padding.top + plotHeight + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill={CHART_INK.muted}
                >
                  {col.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {hovered &&
        (() => {
          const col = columns.find((c) => c.key === hovered.colKey);
          const seg = col?.segments.find((s) => s.key === hovered.segKey);
          if (!col || !seg) return null;
          return (
            <p className="mt-1 text-xs" style={{ color: CHART_INK.secondary }}>
              <span className="font-semibold" style={{ color: CHART_INK.primary }}>
                {seg.value}
              </span>{" "}
              {seg.label} in {col.label}
            </p>
          );
        })()}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {legend.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: l.color }} />
            <span style={{ color: CHART_INK.secondary }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
