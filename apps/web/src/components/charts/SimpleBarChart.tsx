import { useId, useState } from "react";
import { CHART_INK, SEQUENTIAL_BLUE } from "./chartTokens";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

/** Magnitude-by-category bars — one hue (sequential is the safe default per
 * the dataviz skill's choosing-a-form guide), axis labels already carry
 * category identity so no legend is needed. */
export function SimpleBarChart({
  data,
  height = 200,
  hue = SEQUENTIAL_BLUE,
  valueSuffix = "",
}: {
  data: BarDatum[];
  height?: number;
  hue?: string;
  valueSuffix?: string;
}) {
  const uid = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  const width = Math.max(320, data.length * 64);
  const padding = { top: 24, right: 12, bottom: 28, left: 12 };
  const plotHeight = height - padding.top - padding.bottom;
  const plotWidth = width - padding.left - padding.right;

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;
  const barSlot = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(24, barSlot * 0.55);

  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Bar chart">
        {/* baseline */}
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={padding.left + plotWidth}
          y2={padding.top + plotHeight}
          stroke={CHART_INK.baseline}
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const x = padding.left + i * barSlot + (barSlot - barWidth) / 2;
          const barHeight = (d.value / niceMax) * plotHeight;
          const y = padding.top + plotHeight - barHeight;
          const isHovered = hovered === d.key;
          return (
            <g key={d.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx={4}
                fill={hue}
                opacity={isHovered ? 1 : 0.85}
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${d.value}${valueSuffix}`}
                onMouseEnter={() => setHovered(d.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(d.key)}
                onBlur={() => setHovered(null)}
                style={{ cursor: "pointer", outline: "none" }}
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize={11}
                fill={isHovered ? CHART_INK.primary : CHART_INK.secondary}
                fontWeight={isHovered ? 600 : 400}
              >
                {d.value}
              </text>
              <text
                x={x + barWidth / 2}
                y={padding.top + plotHeight + 16}
                textAnchor="middle"
                fontSize={11}
                fill={CHART_INK.muted}
              >
                {d.label}
              </text>
              {isHovered && (
                <foreignObject x={Math.max(0, x - 40)} y={Math.max(0, y - 40)} width={120} height={32}>
                  <div
                    className="pointer-events-none rounded-md px-2 py-1 text-xs shadow-md ring-1 ring-slate-200"
                    style={{ background: CHART_INK.surface, color: CHART_INK.primary }}
                  >
                    <span className="font-semibold">{d.value}{valueSuffix}</span>{" "}
                    <span style={{ color: CHART_INK.secondary }}>{d.label}</span>
                  </div>
                </foreignObject>
              )}
            </g>
          );
        })}
      </svg>
      <span id={uid} className="sr-only">
        Bar chart showing {data.map((d) => `${d.label}: ${d.value}`).join(", ")}
      </span>
    </div>
  );
}
