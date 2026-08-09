import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, ArrowLeft, Download, Search } from "lucide-react";
import type { Department, TrainingSession } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useAllTrainingBatches, useAllTrainingSessions, useAllAttendance } from "../../../lib/trainingManagementLib";
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

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

/** One row per student — internal training batch enrollment + session
 * attendance %, alongside external/corporate trainings (Student.trainings,
 * a completely separate system from batches/sessions — see the field's
 * doc comment in packages/types). Combining both gives one place to see a
 * student's whole training picture instead of two. */
export default function TrainingReport() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const batches = useAllTrainingBatches();
  const sessions = useAllTrainingSessions();
  const attendance = useAllAttendance(appUser);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [batchYearFilter, setBatchYearFilter] = useState<number | "">("");
  const [trainingBatchFilter, setTrainingBatchFilter] = useState("");

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

  const sessionsByBatch = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const s of sessions ?? []) {
      if (!map.has(s.batchId)) map.set(s.batchId, []);
      map.get(s.batchId)!.push(s);
    }
    return map;
  }, [sessions]);

  const rows = useMemo(() => {
    if (!students || !batches || !sessions) return null;
    return students.map((s) => {
      const batchIds = studentBatchIds.get(s.uid) ?? [];
      const relevantSessions = batchIds.flatMap((bid) => sessionsByBatch.get(bid) ?? []);
      const total = relevantSessions.length;
      const attended = relevantSessions.filter((sess) => {
        const status = attendance[sess.sessionId]?.[s.uid]?.status;
        return status === "present" || status === "late";
      }).length;
      const pct = total > 0 ? Math.round((attended / total) * 100) : null;
      const trainingBatchNames = batchIds.map((bid) => batchesById[bid]?.name ?? bid);
      const externalTrainings = Object.keys(s.trainings ?? {});
      return { student: s, batchIds, trainingBatchNames, attended, total, pct, externalTrainings };
    });
  }, [students, batches, sessions, studentBatchIds, sessionsByBatch, attendance, batchesById]);

  const batchYears = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set(students.map((s) => s.batchYear))).sort((a, b) => b - a);
  }, [students]);

  const trainingBatchOptions = useMemo(
    () => (batches ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [batches]
  );

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !deptFilter || r.student.department === deptFilter)
      .filter((r) => !batchYearFilter || r.student.batchYear === batchYearFilter)
      .filter((r) => !trainingBatchFilter || r.batchIds.includes(trainingBatchFilter))
      .filter((r) => !term || r.student.rollNo.toLowerCase().includes(term) || r.student.name.toLowerCase().includes(term))
      .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo));
  }, [rows, search, deptFilter, batchYearFilter, trainingBatchFilter]);

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "training-report.csv",
      ["Roll No", "Name", "Department", "Batch Year", "Training Batch(es)", "Sessions Attended", "Total Sessions", "Attendance %", "External Trainings"],
      filtered.map((r) => [
        r.student.rollNo,
        r.student.name,
        r.student.department,
        r.student.batchYear,
        r.trainingBatchNames.join("; "),
        r.attended,
        r.total,
        r.pct ?? "",
        r.externalTrainings.join("; "),
      ])
    );
  }

  const loading = filtered === null;

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Training Report"
        subtitle={loading ? undefined : `${filtered.length} of ${rows?.length ?? 0} student(s)`}
        icon={BookOpen}
        gradient="from-amber-500 to-orange-600"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <label className={labelClass}>Department</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | "")} className={inputClass}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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

      {!loading && filtered.length === 0 && <EmptyState icon={BookOpen} title="No students match these filters" />}

      {!loading && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Training Batch(es)</th>
                  <th className="py-2 pr-4">Attendance</th>
                  <th className="py-2 pr-4">External Trainings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.student.studentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.batchYear}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.trainingBatchNames.join(", ") || "—"}</td>
                    <td className="py-2 pr-4">
                      {r.total === 0 ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <Badge variant={pctBadge(r.pct ?? 0)}>
                          {r.attended}/{r.total} ({r.pct}%)
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{r.externalTrainings.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function pctBadge(pct: number): BadgeVariant {
  if (pct >= 75) return "success";
  if (pct >= 50) return "warning";
  return "danger";
}
