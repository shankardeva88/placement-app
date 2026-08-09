import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Check, Info, X } from "lucide-react";
import type { MentorMapping } from "@placement-app/types";
import { DB_NODES } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useDeptScopedCollection } from "../../../lib/useDeptScopedCollection";
import { useMentorDirectory } from "../../../lib/drivePrepLib";
import { useMockModules, useMockEvaluations, startOfDay, RATING_SCORE } from "../../../lib/mockEvaluationLib";
import { Card } from "../../../components/ui/Card";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";
import { TrendLineChart } from "../../../components/charts/TrendLineChart";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Day-by-day view for one module — cross-module comparison doesn't make
 * sense here (different modules run on different calendars), unlike the
 * flat Mock Interview Report. There's no explicit participant roster per
 * module (mentors just log whoever they evaluate, ad hoc), so the
 * "expected" pool for attendance/compliance is INFERRED: every mentee of
 * every mentor who has logged at least one entry in this module. That
 * undercounts a mentor who was expected to participate but never logged
 * anything at all — a known limitation, called out on the page itself. */
export default function MockInterviewAnalytics() {
  const { appUser } = useAuth();
  const modules = useMockModules(appUser);
  const evaluations = useMockEvaluations(appUser);
  const mappings = useDeptScopedCollection<MentorMapping>(appUser, DB_NODES.mentorMapping, DB_NODES.mentorMappingDeptIndex);
  const mentors = useMentorDirectory(appUser);

  const [selectedModuleId, setSelectedModuleId] = useState("");

  const sortedModules = useMemo(() => (modules ?? []).slice().sort((a, b) => b.startDate - a.startDate), [modules]);
  const selectedModule = sortedModules.find((m) => m.moduleId === selectedModuleId) ?? sortedModules[0];

  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  const moduleEvals = useMemo(
    () => (selectedModule ? (evaluations ?? []).filter((e) => e.moduleId === selectedModule.moduleId) : []),
    [evaluations, selectedModule]
  );

  const days = useMemo(() => {
    if (!selectedModule) return [];
    const out: number[] = [];
    const end = startOfDay(selectedModule.endDate);
    for (let d = startOfDay(selectedModule.startDate); d <= end; d += DAY_MS) out.push(d);
    return out;
  }, [selectedModule]);

  const evalsByDay = useMemo(() => {
    const map = new Map<number, typeof moduleEvals>();
    for (const e of moduleEvals) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [moduleEvals]);

  const participatingMentorIds = useMemo(
    () => Array.from(new Set(moduleEvals.map((e) => e.mentorId))),
    [moduleEvals]
  );

  const mentorMentees = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of mappings ?? []) {
      if (!map.has(m.facultyId)) map.set(m.facultyId, new Set());
      map.get(m.facultyId)!.add(m.studentId);
    }
    return map;
  }, [mappings]);

  const expectedPoolSize = useMemo(() => {
    const set = new Set<string>();
    for (const mentorId of participatingMentorIds) {
      for (const sid of mentorMentees.get(mentorId) ?? []) set.add(sid);
    }
    return set.size;
  }, [participatingMentorIds, mentorMentees]);

  const trendData = useMemo(
    () =>
      days
        .map((d) => {
          const scored = (evalsByDay.get(d) ?? []).filter((e) => e.overallPerformance !== "absent");
          if (scored.length === 0) return null;
          const avg = scored.reduce((sum, e) => sum + (RATING_SCORE[e.overallPerformance] ?? 0), 0) / scored.length;
          return { key: String(d), label: formatDay(d), value: Math.round(avg * 100) / 100 };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [days, evalsByDay]
  );

  const attendanceRows = useMemo(
    () =>
      days.map((d) => {
        const dayEvals = evalsByDay.get(d) ?? [];
        const presentCount = dayEvals.filter((e) => e.overallPerformance !== "absent").length;
        const absentCount = dayEvals.filter((e) => e.overallPerformance === "absent").length;
        const loggedStudentIds = new Set(dayEvals.map((e) => e.studentId));
        const notLogged = Math.max(0, expectedPoolSize - loggedStudentIds.size);
        return { day: d, presentCount, absentCount, notLogged };
      }),
    [days, evalsByDay, expectedPoolSize]
  );

  const complianceRows = useMemo(
    () =>
      participatingMentorIds
        .map((mentorId) => ({
          mentorId,
          name: mentorsByUid[mentorId]?.name ?? mentorId,
          perDay: days.map((d) => (evalsByDay.get(d) ?? []).some((e) => e.mentorId === mentorId)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [participatingMentorIds, mentorsByUid, days, evalsByDay]
  );

  const loading = modules === null || evaluations === null || mappings === null || mentors === null;

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mock Interview Analytics"
        subtitle="Day-by-day performance trend, attendance, and faculty compliance for one module."
        icon={BarChart3}
        gradient="from-indigo-500 to-purple-600"
      />

      {loading ? (
        <Skeleton className="h-40" />
      ) : sortedModules.length === 0 ? (
        <Card className="text-sm text-slate-500">No modules yet.</Card>
      ) : (
        <>
          <Card className="mb-4">
            <label className={labelClass}>Module</label>
            <select
              value={selectedModule?.moduleId ?? ""}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className={`${inputClass} sm:w-96`}
            >
              {sortedModules.map((m) => (
                <option key={m.moduleId} value={m.moduleId}>
                  {m.name} ({formatDay(m.startDate)} – {formatDay(m.endDate)})
                </option>
              ))}
            </select>
          </Card>

          {selectedModule && (
            <>
              <p className="mb-4 flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                "Expected" students/mentors below are inferred from mentors who logged at least one evaluation in
                this module and their full mentee lists — a mentor who was expected but never logged anything won't
                show up here at all.
              </p>

              <Card className="mb-4">
                <h3 className="mb-1 text-base font-semibold text-slate-900">Overall performance trend</h3>
                <p className="mb-3 text-sm text-slate-500">Daily average across every student evaluated (excludes absences).</p>
                <TrendLineChart data={trendData} />
              </Card>

              <Card className="mb-4">
                <h3 className="mb-1 text-base font-semibold text-slate-900">Attendance by day</h3>
                <p className="mb-3 text-sm text-slate-500">Out of {expectedPoolSize} expected student(s).</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-4">Day</th>
                        <th className="py-2 pr-4">Evaluated</th>
                        <th className="py-2 pr-4">Absent</th>
                        <th className="py-2 pr-4">Not logged</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attendanceRows.map((r) => (
                        <tr key={r.day}>
                          <td className="py-2 pr-4 font-medium text-slate-800">{formatDay(r.day)}</td>
                          <td className="py-2 pr-4 text-slate-600">{r.presentCount}</td>
                          <td className="py-2 pr-4 text-slate-600">{r.absentCount}</td>
                          <td className="py-2 pr-4 text-slate-600">{r.notLogged}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <h3 className="mb-1 text-base font-semibold text-slate-900">Faculty compliance by day</h3>
                <p className="mb-3 text-sm text-slate-500">
                  Which mentors logged at least one evaluation on each day of the module.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-4">Mentor</th>
                        {days.map((d) => (
                          <th key={d} className="px-1.5 py-2 text-center">
                            {formatDay(d)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {complianceRows.map((r) => (
                        <tr key={r.mentorId}>
                          <td className="py-2 pr-4 font-medium text-slate-800">{r.name}</td>
                          {r.perDay.map((conducted, i) => (
                            <td key={days[i]} className="px-1.5 py-2 text-center">
                              {conducted ? (
                                <Check className="mx-auto h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <X className="mx-auto h-3.5 w-3.5 text-red-400" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {complianceRows.length === 0 && (
                        <tr>
                          <td colSpan={days.length + 1} className="py-6 text-center text-sm text-slate-400">
                            No evaluations logged for this module yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
