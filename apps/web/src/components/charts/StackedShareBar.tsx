import { useState } from "react";
import { CHART_INK } from "./chartTokens";

export interface ShareSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Part-to-whole → a single horizontal stacked bar (per the dataviz skill's
 * choosing-a-form guide: "stacked bar, go horizontal for many/long-named
 * categories"), categorical color, legend always present for ≥2 series. A
 * 2px surface gap separates segments instead of a border (marks spec). */
export function StackedShareBar({ segments, height = 32 }: { segments: ShareSegment[]; height?: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>;
  }

  const gap = 2;
  let cursor = 0;

  return (
    <div>
      <svg width="100%" height={height} role="img" aria-label="Share of total">
        {segments.map((s) => {
          if (s.value === 0) return null;
          const widthPct = (s.value / total) * 100;
          const x = `${cursor}%`;
          const w = `calc(${widthPct}% - ${gap}px)`;
          cursor += widthPct;
          const isHovered = hovered === s.key;
          const pct = Math.round((s.value / total) * 100);
          const labelFits = widthPct >= 10;
          return (
            <g key={s.key}>
              <rect
                x={x}
                y={0}
                width={w}
                height={height}
                rx={4}
                fill={s.color}
                opacity={isHovered ? 1 : 0.9}
                tabIndex={0}
                role="img"
                aria-label={`${s.label}: ${s.value} (${pct}%)`}
                onMouseEnter={() => setHovered(s.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(s.key)}
                onBlur={() => setHovered(null)}
                style={{ cursor: "pointer", outline: "none" }}
              />
              {labelFits && (
                <text
                  x={`calc(${x} + ${w} / 2)`}
                  y={height / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="#ffffff"
                >
                  {pct}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`flex items-center gap-1.5 text-xs ${hovered === s.key ? "font-semibold" : ""}`}
            onMouseEnter={() => setHovered(s.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span style={{ color: CHART_INK.secondary }}>{s.label}</span>
            <span className="font-medium" style={{ color: CHART_INK.primary }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
