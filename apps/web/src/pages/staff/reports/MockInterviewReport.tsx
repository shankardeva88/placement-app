import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardCheck, Download, Search } from "lucide-react";
import type { MockEvalRating } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMentorDirectory } from "../../../lib/drivePrepLib";
import { useMockModules, useMockEvaluations, RATING_LABEL, EVAL_CATEGORIES } from "../../../lib/mockEvaluationLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

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
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Cross-module version of MockEvaluations.tsx's ConsolidationSection —
 * that page only ever shows one module at a time (picked from a dropdown)
 * and has no batch filter. This report combines every module's
 * evaluations into one filterable table: module, mentor, batch, and date
 * all at once, not one module at a time. */
export default function MockInterviewReport() {
  const { appUser } = useAuth();
  const modules = useMockModules(appUser);
  const evaluations = useMockEvaluations(appUser);
  const mentors = useMentorDirectory(appUser);
  const students = useStudentsDirectory(appUser);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [dateFilter, setDateFilter] = useState<number | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const modulesById = useMemo(() => Object.fromEntries((modules ?? []).map((m) => [m.moduleId, m])), [modules]);
  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  const rows = useMemo(() => {
    if (!evaluations || !students) return null;
    return evaluations
      .map((e) => ({ evaluation: e, student: studentsByUid[e.studentId] }))
      .filter((r): r is { evaluation: typeof r.evaluation; student: NonNullable<typeof r.student> } => r.student !== undefined);
  }, [evaluations, students, studentsByUid]);

  // Every mentor and every module, not just ones that show up in current
  // data — same reasoning as Mentee Roster Report's mentor filter.
  const mentorOptions = useMemo(
    () =>
      (mentors ?? [])
        .filter((m) => m.role === "faculty_mentor")
        .map((m) => ({ uid: m.uid, name: m.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [mentors]
  );
  const moduleOptions = useMemo(() => (modules ?? []).slice().sort((a, b) => b.startDate - a.startDate), [modules]);

  const batchYears = useMemo(() => {
    if (!rows) return [];
    return Array.from(new Set(rows.map((r) => r.student.batchYear))).sort((a, b) => a - b);
  }, [rows]);

  const dateOptions = useMemo(() => {
    if (!rows) return [];
    return Array.from(new Set(rows.map((r) => r.evaluation.date))).sort((a, b) => b - a);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !moduleFilter || r.evaluation.moduleId === moduleFilter)
      .filter((r) => !mentorFilter || r.evaluation.mentorId === mentorFilter)
      .filter((r) => !batchFilter || r.student.batchYear === batchFilter)
      .filter((r) => !dateFilter || r.evaluation.date === dateFilter)
      .filter((r) => !term || r.student.rollNo.toLowerCase().includes(term) || r.student.name.toLowerCase().includes(term))
      .sort((a, b) => b.evaluation.date - a.evaluation.date || a.student.rollNo.localeCompare(b.student.rollNo));
  }, [rows, moduleFilter, mentorFilter, batchFilter, dateFilter, search]);

  const loading = filtered === null;

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "mock-interview-report.csv",
      ["Roll No", "Name", "Department", "Batch", "Module", "Mentor", "Date", ...EVAL_CATEGORIES.map((c) => c.label), "Notes"],
      filtered.map((r) => [
        r.student.rollNo,
        r.student.name,
        r.student.department,
        r.student.batchYear,
        modulesById[r.evaluation.moduleId]?.name ?? r.evaluation.moduleId,
        mentorsByUid[r.evaluation.mentorId]?.name ?? r.evaluation.mentorId,
        formatDay(r.evaluation.date),
        ...EVAL_CATEGORIES.map((c) => RATING_LABEL[r.evaluation[c.key]]),
        r.evaluation.notes ?? "",
      ])
    );
  }

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mock Interview Report"
        subtitle={loading ? undefined : `${filtered.length} of ${rows?.length ?? 0} evaluation(s)`}
        icon={ClipboardCheck}
        gradient="from-indigo-500 to-purple-600"
        action={
          filtered && filtered.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search roll no or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={inputClass}>
            <option value="">All modules</option>
            {moduleOptions.map((m) => (
              <option key={m.moduleId} value={m.moduleId}>
                {m.name}
              </option>
            ))}
          </select>
          <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)} className={inputClass}>
            <option value="">All mentors</option>
            {mentorOptions.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
          >
            <option value="">All batches</option>
            {batchYears.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
          >
            <option value="">All dates</option>
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && filtered.length === 0 && (
        <EmptyState icon={ClipboardCheck} title="No evaluations match" />
      )}

      {!loading && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4"></th>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Module</th>
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Overall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const isExpanded = expandedId === r.evaluation.evaluationId;
                  return (
                    <Fragment key={r.evaluation.evaluationId}>
                      <tr
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setExpandedId(isExpanded ? null : r.evaluation.evaluationId)}
                      >
                        <td className="py-2 pl-1">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                        </td>
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {r.student.rollNo} — {r.student.name}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{r.student.batchYear}</td>
                        <td className="py-2 pr-4 text-slate-600">{modulesById[r.evaluation.moduleId]?.name ?? r.evaluation.moduleId}</td>
                        <td className="py-2 pr-4 text-slate-600">{mentorsByUid[r.evaluation.mentorId]?.name ?? r.evaluation.mentorId}</td>
                        <td className="py-2 pr-4 text-slate-600">{formatDay(r.evaluation.date)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={RATING_BADGE[r.evaluation.overallPerformance]}>{RATING_LABEL[r.evaluation.overallPerformance]}</Badge>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="pb-3">
                            <div className="ml-6 overflow-x-auto rounded-lg bg-slate-50 p-3">
                              <div className="flex flex-wrap gap-2">
                                {EVAL_CATEGORIES.map((c) => (
                                  <Badge key={c.key} variant={RATING_BADGE[r.evaluation[c.key]]}>
                                    {c.label}: {RATING_LABEL[r.evaluation[c.key]]}
                                  </Badge>
                                ))}
                              </div>
                              {r.evaluation.notes && <p className="mt-2 text-xs text-slate-500">Notes: {r.evaluation.notes}</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
