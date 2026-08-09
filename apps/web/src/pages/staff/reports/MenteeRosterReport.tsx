import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Search, UserCheck } from "lucide-react";
import type { Department, MentorMapping } from "@placement-app/types";
import { DB_NODES } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useDeptScopedCollection } from "../../../lib/useDeptScopedCollection";
import { useMentorDirectory } from "../../../lib/drivePrepLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Flat mentor→mentee listing — every assignment as its own row, unlike
 * MentorWiseReport (one row per mentor, aggregate counts only). This is
 * "who exactly is assigned to whom", filterable by mentor/department/batch
 * and searchable by roll no or name. */
export default function MenteeRosterReport() {
  const { appUser } = useAuth();
  const mappings = useDeptScopedCollection<MentorMapping>(appUser, DB_NODES.mentorMapping, DB_NODES.mentorMappingDeptIndex);
  const mentors = useMentorDirectory(appUser);
  const students = useStudentsDirectory(appUser);

  const [search, setSearch] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  const rows = useMemo(() => {
    if (!mappings || !students) return null;
    return mappings
      .map((m) => ({ mapping: m, student: studentsByUid[m.studentId] }))
      .filter((r): r is { mapping: MentorMapping; student: NonNullable<typeof r.student> } => r.student !== undefined)
      .map((r) => ({ ...r, mentorName: mentorsByUid[r.mapping.facultyId]?.name ?? r.mapping.facultyId }));
  }, [mappings, students, studentsByUid, mentorsByUid]);

  const mentorOptions = useMemo(() => {
    if (!rows) return [];
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.mapping.facultyId, r.mentorName);
    return Array.from(seen.entries())
      .map(([uid, name]) => ({ uid, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const batchYears = useMemo(() => {
    if (!rows) return [];
    return Array.from(new Set(rows.map((r) => r.student.batchYear))).sort((a, b) => a - b);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !mentorFilter || r.mapping.facultyId === mentorFilter)
      .filter((r) => !deptFilter || r.student.department === deptFilter)
      .filter((r) => !batchFilter || r.student.batchYear === batchFilter)
      .filter((r) => !term || r.student.rollNo.toLowerCase().includes(term) || r.student.name.toLowerCase().includes(term))
      .sort((a, b) => a.mentorName.localeCompare(b.mentorName) || a.student.rollNo.localeCompare(b.student.rollNo));
  }, [rows, search, mentorFilter, deptFilter, batchFilter]);

  const loading = filtered === null;

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "mentee-roster-report.csv",
      ["Mentor", "Roll No", "Name", "Department", "Batch", "CGPA", "Backlogs", "Verified"],
      filtered.map((r) => [
        r.mentorName,
        r.student.rollNo,
        r.student.name,
        r.student.department,
        r.student.batchYear,
        r.student.cgpa,
        r.student.activeBacklogs,
        r.student.verifiedByFaculty ? "Yes" : "No",
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
        title="Mentee Roster Report"
        subtitle={loading ? undefined : `${filtered.length} of ${rows?.length ?? 0} assignment(s)`}
        icon={UserCheck}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
          <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)} className={inputClass}>
            <option value="">All mentors</option>
            {mentorOptions.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
          </select>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | "")} className={inputClass}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
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
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && filtered.length === 0 && (
        <EmptyState icon={UserCheck} title="No mentor assignments match" />
      )}

      {!loading && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">CGPA</th>
                  <th className="py-2 pr-4">Backlogs</th>
                  <th className="py-2 pr-4">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.mapping.mappingId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.mentorName}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.batchYear}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.cgpa}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.activeBacklogs}</td>
                    <td className="py-2 pr-4">
                      {r.student.verifiedByFaculty ? <Badge variant="success">Yes</Badge> : <Badge variant="neutral">No</Badge>}
                    </td>
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
