import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import type { MockEvaluation } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useIndexedList } from "../lib/mentorProgressLib";
import { DB_NODES } from "@placement-app/types";
import { useModulesByIds, RATING_LABEL, RATING_SCORE, EVAL_CATEGORIES } from "../lib/mockEvaluationLib";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";
import { TrendLineChart } from "../components/charts/TrendLineChart";
import type { MockEvalRating } from "@placement-app/types";

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

function ModuleCard({ moduleName, dateRange, evaluations }: { moduleName: string; dateRange: string; evaluations: MockEvaluation[] }) {
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

export default function MockPerformance() {
  const { student } = useAuth();
  const evaluations = useIndexedList<MockEvaluation>(student?.uid, DB_NODES.mockEvaluations);

  const moduleIds = useMemo(() => Array.from(new Set((evaluations ?? []).map((e) => e.moduleId))), [evaluations]);
  const modules = useModulesByIds(moduleIds);

  const evalsByModule = useMemo(() => {
    const map: Record<string, MockEvaluation[]> = {};
    for (const e of evaluations ?? []) {
      map[e.moduleId] ??= [];
      map[e.moduleId].push(e);
    }
    return map;
  }, [evaluations]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mock Interview Performance"
        subtitle="Your day-by-day mock interview evaluations, module by module."
        icon={ClipboardCheck}
        gradient="from-indigo-500 to-purple-600"
      />

      {evaluations === null && <Skeleton className="h-40" />}

      {evaluations !== null && moduleIds.length === 0 && (
        <EmptyState icon={ClipboardCheck} title="No mock interview evaluations yet" />
      )}

      {moduleIds.map((moduleId) => {
        const module = modules[moduleId];
        return (
          <ModuleCard
            key={moduleId}
            moduleName={module?.name ?? "Mock interview module"}
            dateRange={module ? `${formatDay(module.startDate)} – ${formatDay(module.endDate)}` : ""}
            evaluations={evalsByModule[moduleId]}
          />
        );
      })}
    </div>
  );
}
