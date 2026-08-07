import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { CHART_INK, SEQUENTIAL_BLUE } from "./chartTokens";

export interface LinePoint {
  key: string;
  label: string;
  value: number;
}

/** Trend over time → line, one hue (sequential is the safe default). A
 * vertical crosshair tracks the pointer and snaps to the nearest point —
 * "the crosshair finds the X" (dataviz skill, interaction.md) — rather than
 * requiring the reader to aim at a 2px line. */
export function TrendLineChart({
  data,
  height = 200,
  hue = SEQUENTIAL_BLUE,
}: {
  data: LinePoint[];
  height?: number;
  hue?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = Math.max(320, data.length * 56);
  const padding = { top: 20, right: 16, bottom: 28, left: 12 };
  const plotHeight = height - padding.top - padding.bottom;
  const plotWidth = width - padding.left - padding.right;

  const maxValue = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;

  const xFor = (i: number) => padding.left + (data.length <= 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth);
  const yFor = (v: number) => padding.top + plotHeight - (v / niceMax) * plotHeight;

  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.value)}`).join(" ");

  function handleMove(e: MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || data.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pointerX = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let nearestDist = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - pointerX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>;
  }

  const hoveredPoint = hoverIndex != null ? data[hoverIndex] : null;
  const lastPoint = data[data.length - 1];

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="Trend line chart"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padding.left}
            y1={padding.top + plotHeight * (1 - f)}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight * (1 - f)}
            stroke={CHART_INK.gridline}
            strokeWidth={1}
          />
        ))}

        {hoverIndex != null && (
          <line
            x1={xFor(hoverIndex)}
            y1={padding.top}
            x2={xFor(hoverIndex)}
            y2={padding.top + plotHeight}
            stroke={CHART_INK.baseline}
            strokeWidth={1}
          />
        )}

        <path d={pathD} fill="none" stroke={hue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => {
          const isHovered = hoverIndex === i;
          const isLast = i === data.length - 1;
          return (
            <g key={d.key}>
              <circle
                cx={xFor(i)}
                cy={yFor(d.value)}
                r={isHovered ? 5 : 4}
                fill={hue}
                stroke={CHART_INK.surface}
                strokeWidth={2}
              />
              {isLast && (
                <text x={xFor(i) + 8} y={yFor(d.value) - 8} fontSize={11} fontWeight={600} fill={CHART_INK.primary}>
                  {lastPoint.value}
                </text>
              )}
            </g>
          );
        })}

        {data.map((d, i) => (
          <text
            key={d.key}
            x={xFor(i)}
            y={padding.top + plotHeight + 16}
            textAnchor="middle"
            fontSize={11}
            fill={CHART_INK.muted}
          >
            {d.label}
          </text>
        ))}
      </svg>

      {hoveredPoint && (
        <p className="mt-1 text-xs" style={{ color: CHART_INK.secondary }}>
          <span className="font-semibold" style={{ color: CHART_INK.primary }}>
            {hoveredPoint.value}
          </span>{" "}
          on {hoveredPoint.label}
        </p>
      )}
    </div>
  );
}
