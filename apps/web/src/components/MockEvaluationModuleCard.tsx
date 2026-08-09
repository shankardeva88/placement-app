import { useMemo } from "react";
import type { MockEvalRating, MockEvaluation } from "@placement-app/types";
import { RATING_LABEL, RATING_SCORE, EVAL_CATEGORIES } from "../lib/mockEvaluationLib";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import type { BadgeVariant } from "./ui/Badge";
import { TrendLineChart } from "./charts/TrendLineChart";

const RATING_BADGE: Record<MockEvalRating, BadgeVariant> = {
  excellent: "success",
  very_good: "success",
  good: "brand",
  average: "warning",
  need_to_improve: "warning",
  poor: "danger",
  absent: "neutral",
};

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** One module's full history for one student — trend line (when there's
 * enough data to show a trend) plus the day-by-day category breakdown.
 * Shared between the student's own Mock Interview Performance page and a
 * coordinator/mentor viewing a specific student's detail page, so both see
 * identical data laid out identically. */
export function MockEvaluationModuleCard({
  moduleName,
  dateRange,
  evaluations,
}: {
  moduleName: string;
  dateRange: string;
  evaluations: MockEvaluation[];
}) {
  const sorted = useMemo(() => evaluations.slice().sort((a, b) => a.date - b.date), [evaluations]);

  const trendData = useMemo(
    () =>
      sorted
        .map((e) => ({ key: String(e.date), label: formatDay(e.date), value: RATING_SCORE[e.overallPerformance] }))
        .filter((p): p is { key: string; label: string; value: number } => p.value !== null),
    [sorted]
  );

  return (
    <Card>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-slate-900">{moduleName}</h3>
        <p className="text-sm text-slate-500">{dateRange}</p>
      </div>

      {trendData.length >= 2 && (
        <div className="mb-4 rounded-lg bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Overall performance trend</p>
          <TrendLineChart data={trendData} height={140} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-3">Date</th>
              {EVAL_CATEGORIES.map((c) => (
                <th key={c.key} className="py-1.5 pr-3">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((e) => (
              <tr key={e.evaluationId}>
                <td className="py-1.5 pr-3 font-medium text-slate-700">{formatDay(e.date)}</td>
                {EVAL_CATEGORIES.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3">
                    <Badge variant={RATING_BADGE[e[c.key]]}>{RATING_LABEL[e[c.key]]}</Badge>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
