import { useMemo } from "react";
import { ClipboardCheck } from "lucide-react";
import type { MockEvaluation } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useIndexedList } from "../lib/mentorProgressLib";
import { DB_NODES } from "@placement-app/types";
import { useModulesByIds } from "../lib/mockEvaluationLib";
import { MockEvaluationModuleCard } from "../components/MockEvaluationModuleCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
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
          <MockEvaluationModuleCard
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
