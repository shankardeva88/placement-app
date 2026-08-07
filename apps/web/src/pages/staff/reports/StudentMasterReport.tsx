import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Users } from "lucide-react";
import type { Department, PlacementStatus } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

const PLACEMENT_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};

export default function StudentMasterReport() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [statusFilter, setStatusFilter] = useState<PlacementStatus | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const batchYears = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set(students.map((s) => s.batchYear))).sort((a, b) => b - a);
  }, [students]);

  const filtered = useMemo(() => {
    if (!students) return null;
    return students
      .filter((s) => !deptFilter || s.department === deptFilter)
      .filter((s) => !statusFilter || s.placementStatus === statusFilter)
      .filter((s) => !batchFilter || s.batchYear === batchFilter)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [students, deptFilter, statusFilter, batchFilter]);

  const stats = useMemo(() => {
    if (!filtered) return null;
    const verified = filtered.filter((s) => s.verifiedByFaculty).length;
    const placed = filtered.filter((s) => s.placementStatus === "placed" || s.placementStatus === "multiple_offers").length;
    return { total: filtered.length, verified, placed };
  }, [filtered]);

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "student-master-report.csv",
      ["Roll No", "Name", "Department", "Batch", "CGPA", "Backlogs", "Placement Status", "Verified", "Phone", "College Email", "Personal Email", "Trainings"],
      filtered.map((s) => [
        s.rollNo,
        s.name,
        s.department,
        s.batchYear,
        s.cgpa,
        s.activeBacklogs,
        s.placementStatus,
        s.verifiedByFaculty ? "Yes" : "No",
        s.studentPhone ?? "",
        s.email ?? "",
        s.personalEmail ?? "",
        Object.keys(s.trainings ?? {}).join("; "),
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
        title="Student Master Report"
        subtitle={stats ? `${stats.total} students · ${stats.verified} verified · ${stats.placed} placed` : undefined}
        icon={Users}
        gradient="from-emerald-500 to-teal-600"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
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
            <label className={labelClass}>Placement status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PlacementStatus | "")} className={inputClass}>
              <option value="">All statuses</option>
              <option value="not_placed">Not placed</option>
              <option value="placed">Placed</option>
              <option value="multiple_offers">Multiple offers</option>
              <option value="opted_higher_studies">Opted higher studies</option>
              <option value="opted_out">Opted out</option>
            </select>
          </div>
        </div>
      </Card>

      {filtered === null && <Skeleton className="h-40" />}

      {filtered !== null && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">College Email</th>
                  <th className="py-2 pr-4">CGPA</th>
                  <th className="py-2 pr-4">Backlogs</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Verified</th>
                  <th className="py-2 pr-4">Trainings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.studentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{s.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.email ?? ""}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.cgpa}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.activeBacklogs}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={PLACEMENT_BADGE[s.placementStatus]}>{s.placementStatus.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{s.verifiedByFaculty ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4 text-slate-600">{Object.keys(s.trainings ?? {}).join(", ") || "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-sm text-slate-400">
                      No students match these filters.
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
