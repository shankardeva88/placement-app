import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Award, Download, ExternalLink, Search } from "lucide-react";
import type { Department, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

type CertRow = { student: Student; cert: NonNullable<Student["certifications"]>[number] };

function formatDate(ts?: number): string {
  return ts ? new Date(ts).toLocaleDateString() : "";
}

/** One row per certification, not per student — a student with 3
 * certifications gets 3 rows, so the report is sortable/searchable by
 * certification name directly instead of a flattened comma-joined cell. */
export default function CertificationReport() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const rows = useMemo<CertRow[] | null>(() => {
    if (!students) return null;
    const out: CertRow[] = [];
    for (const s of students) {
      for (const cert of s.certifications ?? []) out.push({ student: s, cert });
    }
    return out;
  }, [students]);

  const batchYears = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set(students.map((s) => s.batchYear))).sort((a, b) => b - a);
  }, [students]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !deptFilter || r.student.department === deptFilter)
      .filter((r) => !batchFilter || r.student.batchYear === batchFilter)
      .filter(
        (r) =>
          !term ||
          r.student.rollNo.toLowerCase().includes(term) ||
          r.student.name.toLowerCase().includes(term) ||
          r.cert.name.toLowerCase().includes(term)
      )
      .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo) || a.cert.name.localeCompare(b.cert.name));
  }, [rows, search, deptFilter, batchFilter]);

  const studentsWithCerts = useMemo(() => {
    if (!filtered) return 0;
    return new Set(filtered.map((r) => r.student.uid)).size;
  }, [filtered]);

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "certification-report.csv",
      ["Roll No", "Name", "Department", "Batch", "Certification", "Issued Date", "URL"],
      filtered.map((r) => [
        r.student.rollNo,
        r.student.name,
        r.student.department,
        r.student.batchYear,
        r.cert.name,
        formatDate(r.cert.issuedAt),
        r.cert.url ?? "",
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
        title="Certification Report"
        subtitle={loading ? undefined : `${filtered.length} certification(s) across ${studentsWithCerts} student(s)`}
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
                placeholder="Roll no, name, or certification"
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
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && filtered.length === 0 && <EmptyState icon={Award} title="No certifications match these filters" />}

      {!loading && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Certification</th>
                  <th className="py-2 pr-4">Issued</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => (
                  <tr key={`${r.student.studentId}-${i}`}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.batchYear}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.cert.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{formatDate(r.cert.issuedAt) || "—"}</td>
                    <td className="py-2 pr-4">
                      {r.cert.url && (
                        <a
                          href={r.cert.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
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
