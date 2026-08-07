import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllTrainingBatches, useAllTrainingSessions, useAllAttendance } from "../../lib/trainingManagementLib";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

function toDateInputValue(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

interface Row {
  studentId: string;
  name: string;
  rollNo: string;
  attended: number;
  total: number;
  pct: number;
}

function toCsv(rows: Row[]) {
  const header = ["Roll No", "Name", "Attended", "Total", "Percentage"];
  const lines = rows.map((r) => [r.rollNo, r.name, r.attended, r.total, `${r.pct}%`].map((v) => `"${v}"`).join(","));
  return [header.join(","), ...lines].join("\n");
}

export default function AttendanceReport() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const batches = useAllTrainingBatches();
  const sessions = useAllTrainingSessions();
  const attendance = useAllAttendance(appUser);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const [batchId, setBatchId] = useState("");
  const [startDate, setStartDate] = useState(toDateInputValue(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(toDateInputValue(Date.now()));
  const [threshold, setThreshold] = useState(75);

  const rows = useMemo<Row[] | null>(() => {
    if (!batches || !sessions || !students) return null;

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1;

    const scopedBatches = batchId ? batches.filter((b) => b.batchId === batchId) : batches;
    const scopedBatchIds = new Set(scopedBatches.map((b) => b.batchId));
    const scopedSessions = sessions.filter((s) => scopedBatchIds.has(s.batchId) && s.date >= startMs && s.date <= endMs);

    const studentBatchMap = new Map<string, Set<string>>(); // studentId -> batchIds they're in (within scope)
    for (const b of scopedBatches) {
      for (const uid of b.studentIds) {
        if (!studentBatchMap.has(uid)) studentBatchMap.set(uid, new Set());
        studentBatchMap.get(uid)!.add(b.batchId);
      }
    }

    const result: Row[] = [];
    for (const [studentId, batchIds] of studentBatchMap) {
      const relevantSessions = scopedSessions.filter((s) => batchIds.has(s.batchId));
      const total = relevantSessions.length;
      if (total === 0) continue;
      const attended = relevantSessions.filter((s) => {
        const status = attendance[s.sessionId]?.[studentId]?.status;
        return status === "present" || status === "late";
      }).length;
      const student = students.find((s) => s.uid === studentId);
      result.push({
        studentId,
        name: student?.name ?? studentId,
        rollNo: student?.rollNo ?? "—",
        attended,
        total,
        pct: Math.round((attended / total) * 100),
      });
    }

    return result.sort((a, b) => a.pct - b.pct);
  }, [batches, sessions, students, attendance, batchId, startDate, endDate]);

  function handleDownload() {
    if (!rows) return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link to="/staff/training" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to training
      </Link>

      <PageHeader
        title="Attendance Report"
        subtitle="Sorted by attendance % — lowest first."
        icon={BarChart3}
        gradient="from-amber-500 to-orange-600"
        action={
          rows && rows.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Batch</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputClass}>
              <option value="">All batches</option>
              {batches?.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Flag below %</label>
            <input type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={inputClass} />
          </div>
        </div>
      </Card>

      {rows === null && <Skeleton className="h-40" />}

      {rows !== null && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Attended</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.studentId} className={r.pct < threshold ? "bg-red-50" : undefined}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.attended}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.total}</td>
                    <td className={`py-2 pr-4 font-semibold ${r.pct < threshold ? "text-red-600" : "text-slate-800"}`}>{r.pct}%</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                      No sessions in this range for the selected batch(es).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
