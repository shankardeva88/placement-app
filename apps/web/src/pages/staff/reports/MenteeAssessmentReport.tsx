import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, ArrowLeft, Download, Search } from "lucide-react";
import type { Student, TrainingAssessment } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../../lib/menteeFollowUpLib";
import { useAllTrainingBatches, useAllTrainingAssessments, useAllAssessmentScores } from "../../../lib/trainingManagementLib";
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
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function pctBadge(pct: number): BadgeVariant {
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}

/** Mentee-scoped equivalent of AssessmentReport — same shape as
 * MenteeTrainingReport is to TrainingReport. No department filter (a
 * mentor's mentees are their own roster, not a department-wide pool). */
export default function MenteeAssessmentReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const batches = useAllTrainingBatches();
  const assessments = useAllTrainingAssessments();
  const scores = useAllAssessmentScores(appUser);

  const [search, setSearch] = useState("");
  const [batchYearFilter, setBatchYearFilter] = useState<number | "">("");
  const [trainingBatchFilter, setTrainingBatchFilter] = useState("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees.map((m) => studentsByUid[m.studentId]).filter((s): s is Student => s !== undefined);
  }, [mentees, studentsByUid]);

  const batchesById = useMemo(() => Object.fromEntries((batches ?? []).map((b) => [b.batchId, b])), [batches]);

  const studentBatchIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const b of batches ?? []) {
      for (const uid of b.studentIds) {
        if (!map.has(uid)) map.set(uid, []);
        map.get(uid)!.push(b.batchId);
      }
    }
    return map;
  }, [batches]);

  const assessmentsByBatch = useMemo(() => {
    const map = new Map<string, TrainingAssessment[]>();
    for (const a of assessments ?? []) {
      if (!map.has(a.batchId)) map.set(a.batchId, []);
      map.get(a.batchId)!.push(a);
    }
    return map;
  }, [assessments]);

  const rows = useMemo(() => {
    if (!mentees || !students || !batches || !assessments) return null;
    return menteeStudents.map((s) => {
      const allBatchIds = studentBatchIds.get(s.uid) ?? [];
      const batchIds = trainingBatchFilter ? allBatchIds.filter((bid) => bid === trainingBatchFilter) : allBatchIds;
      const relevantAssessments = batchIds.flatMap((bid) => assessmentsByBatch.get(bid) ?? []);
      let attempted = 0;
      let absentCount = 0;
      let pctSum = 0;
      for (const a of relevantAssessments) {
        const rec = scores[a.assessmentId]?.[s.uid];
        if (!rec) continue;
        if (rec.absent) {
          absentCount++;
          continue;
        }
        attempted++;
        pctSum += (rec.score / a.maxScore) * 100;
      }
      const total = relevantAssessments.length;
      const notEntered = total - attempted - absentCount;
      const avgPct = attempted > 0 ? Math.round(pctSum / attempted) : null;
      const trainingBatchNames = batchIds.map((bid) => batchesById[bid]?.name ?? bid);
      return { student: s, allBatchIds, trainingBatchNames, total, attempted, absentCount, notEntered, avgPct };
    });
  }, [mentees, students, batches, assessments, menteeStudents, studentBatchIds, assessmentsByBatch, scores, batchesById, trainingBatchFilter]);

  const batchYears = useMemo(
    () => Array.from(new Set(menteeStudents.map((s) => s.batchYear))).sort((a, b) => b - a),
    [menteeStudents]
  );

  // Only training batches that actually have a mentee in them.
  const trainingBatchOptions = useMemo(() => {
    const menteeUids = new Set(menteeStudents.map((s) => s.uid));
    return (batches ?? []).filter((b) => b.studentIds.some((uid) => menteeUids.has(uid))).sort((a, b) => a.name.localeCompare(b.name));
  }, [batches, menteeStudents]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !batchYearFilter || r.student.batchYear === batchYearFilter)
      .filter((r) => !trainingBatchFilter || r.allBatchIds.includes(trainingBatchFilter))
      .filter((r) => !term || r.student.rollNo.toLowerCase().includes(term) || r.student.name.toLowerCase().includes(term))
      .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo));
  }, [rows, search, batchYearFilter, trainingBatchFilter]);

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "mentee-assessment-report.csv",
      ["Roll No", "Name", "Batch Year", "Training Batch(es)", "Attempted", "Absent", "Not Entered", "Total", "Average %"],
      filtered.map((r) => [
        r.student.rollNo,
        r.student.name,
        r.student.batchYear,
        r.trainingBatchNames.join("; "),
        r.attempted,
        r.absentCount,
        r.notEntered,
        r.total,
        r.avgPct ?? "",
      ])
    );
  }

  const matrixAssessments = useMemo(() => {
    if (!trainingBatchFilter) return [];
    return (assessmentsByBatch.get(trainingBatchFilter) ?? []).slice().sort((a, b) => a.date - b.date);
  }, [trainingBatchFilter, assessmentsByBatch]);

  function scoreCell(assessmentId: string, uid: string, maxScore: number): { label: string; variant: BadgeVariant } | null {
    const rec = scores[assessmentId]?.[uid];
    if (!rec) return null;
    if (rec.absent) return { label: "Absent", variant: "danger" };
    const pct = Math.round((rec.score / maxScore) * 100);
    return { label: `${pct}%`, variant: pctBadge(pct) };
  }

  function handleDownloadMatrix() {
    if (!filtered || matrixAssessments.length === 0) return;
    downloadCsv(
      `mentee-assessment-report-${batchesById[trainingBatchFilter]?.name ?? trainingBatchFilter}.csv`,
      ["Roll No", "Name", ...matrixAssessments.map((a) => `${a.name} (${formatShortDate(a.date)})`), "Average %"],
      filtered.map((r) => [
        r.student.rollNo,
        r.student.name,
        ...matrixAssessments.map((a) => scoreCell(a.assessmentId, r.student.uid, a.maxScore)?.label ?? "-"),
        r.avgPct ?? "",
      ])
    );
  }

  const loading = filtered === null;

  return (
    <div>
      <Link
        to="/staff/mentor-reports"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mentee Assessment Report"
        subtitle={loading ? undefined : `${filtered.length} of ${rows?.length ?? 0} mentee(s)`}
        icon={Award}
        gradient="from-violet-500 to-purple-600"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Roll no or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Batch</label>
            <select
              value={batchYearFilter}
              onChange={(e) => setBatchYearFilter(e.target.value ? Number(e.target.value) : "")}
              className={inputClass}
            >
              <option value="">All batches</option>
              {batchYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Training batch</label>
            <select value={trainingBatchFilter} onChange={(e) => setTrainingBatchFilter(e.target.value)} className={inputClass}>
              <option value="">All training batches</option>
              {trainingBatchOptions.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && menteeStudents.length === 0 && <EmptyState icon={Award} title="No mentees assigned to you yet" />}
      {!loading && menteeStudents.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Award} title="No mentees match these filters" />
      )}

      {!loading && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Training Batch(es)</th>
                  <th className="py-2 pr-4">Attempted</th>
                  <th className="py-2 pr-4">Absent</th>
                  <th className="py-2 pr-4">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.student.studentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.batchYear}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.trainingBatchNames.join(", ") || "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.total === 0 ? "—" : `${r.attempted}/${r.total}`}</td>
                    <td className="py-2 pr-4">
                      {r.absentCount > 0 ? <Badge variant="danger">{r.absentCount}</Badge> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 pr-4">
                      {r.avgPct == null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge variant={pctBadge(r.avgPct)}>{r.avgPct}%</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && filtered.length > 0 && trainingBatchFilter && (
        <Card className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Assessment-wise — {batchesById[trainingBatchFilter]?.name ?? trainingBatchFilter}
              </h3>
              <p className="text-xs text-slate-500">One column per assessment created for this batch.</p>
            </div>
            {matrixAssessments.length > 0 && (
              <Button variant="secondary" onClick={handleDownloadMatrix}>
                <Download className="h-4 w-4" />
                Download assessment-wise CSV
              </Button>
            )}
          </div>
          {matrixAssessments.length === 0 ? (
            <p className="text-sm text-slate-400">No assessments created yet for this batch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="sticky left-0 z-10 w-24 truncate bg-white py-2 pr-4">Roll No</th>
                    <th className="sticky left-24 z-10 w-36 truncate border-r border-slate-200 bg-white py-2 pr-4">Name</th>
                    {matrixAssessments.map((a) => (
                      <th key={a.assessmentId} className="whitespace-nowrap py-2 pr-3 text-center" title={a.name}>
                        {formatShortDate(a.date)}
                      </th>
                    ))}
                    <th className="whitespace-nowrap py-2 pl-3">Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <tr key={r.student.studentId}>
                      <td className="sticky left-0 z-10 w-24 truncate bg-white py-1.5 pr-4 font-medium text-slate-800">
                        {r.student.rollNo}
                      </td>
                      <td className="sticky left-24 z-10 w-36 truncate border-r border-slate-200 bg-white py-1.5 pr-4 text-slate-600">
                        {r.student.name}
                      </td>
                      {matrixAssessments.map((a) => {
                        const cell = scoreCell(a.assessmentId, r.student.uid, a.maxScore);
                        return (
                          <td key={a.assessmentId} className="py-1.5 pr-3 text-center">
                            {cell ? <Badge variant={cell.variant}>{cell.label}</Badge> : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap py-1.5 pl-3 font-medium text-slate-700">{r.avgPct ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
