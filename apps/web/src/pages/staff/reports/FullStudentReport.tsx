import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, Search } from "lucide-react";
import type { Department, PlacementStatus, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
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

const PLACEMENT_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};

function formatDate(ts?: number): string {
  return ts ? new Date(ts).toLocaleDateString() : "";
}

function formatSgpa(sgpa?: Record<string, number>): string {
  if (!sgpa) return "";
  return Object.entries(sgpa)
    .map(([sem, v]) => `${sem}:${v}`)
    .join("; ");
}

function formatCertifications(certs?: Student["certifications"]): string {
  if (!certs || certs.length === 0) return "";
  return certs.map((c) => (c.url ? `${c.name} (${c.url})` : c.name)).join("; ");
}

function formatTrainings(trainings?: Record<string, string>): string {
  if (!trainings) return "";
  return Object.keys(trainings).join(", ");
}

// Every field on Student, in one place — both the CSV export and the
// on-screen table (which scrolls horizontally) read from this, so they can
// never drift out of sync with each other.
const COLUMNS: { header: string; get: (s: Student) => string | number }[] = [
  { header: "Roll No", get: (s) => s.rollNo },
  { header: "Name", get: (s) => s.name },
  { header: "College Email", get: (s) => s.email ?? "" },
  { header: "Department", get: (s) => s.department },
  { header: "Batch Year", get: (s) => s.batchYear },
  { header: "Current Semester", get: (s) => s.currentSemester },
  { header: "CGPA", get: (s) => s.cgpa },
  { header: "Semester-wise SGPA", get: (s) => formatSgpa(s.semesterWiseSgpa) },
  { header: "Active Backlogs", get: (s) => s.activeBacklogs },
  { header: "10th %", get: (s) => s.tenthPercentage ?? "" },
  { header: "10th School", get: (s) => s.tenthSchool ?? "" },
  { header: "10th Board", get: (s) => s.tenthBoard ?? "" },
  { header: "10th Year", get: (s) => s.tenthYearOfPassing ?? "" },
  { header: "12th %", get: (s) => s.twelfthPercentage ?? "" },
  { header: "12th School", get: (s) => s.twelfthSchool ?? "" },
  { header: "12th Board", get: (s) => s.twelfthBoard ?? "" },
  { header: "12th Year", get: (s) => s.twelfthYearOfPassing ?? "" },
  { header: "Diploma %", get: (s) => s.diplomaPercentage ?? "" },
  { header: "Diploma School", get: (s) => s.diplomaSchool ?? "" },
  { header: "Diploma Board", get: (s) => s.diplomaBoard ?? "" },
  { header: "Diploma Year", get: (s) => s.diplomaYearOfPassing ?? "" },
  { header: "Student Phone", get: (s) => s.studentPhone ?? "" },
  { header: "Personal Email", get: (s) => s.personalEmail ?? "" },
  { header: "Parent Name", get: (s) => s.parentName ?? "" },
  { header: "Parent Phone", get: (s) => s.parentPhone ?? "" },
  { header: "Alternate Phone", get: (s) => s.alternatePhone ?? "" },
  { header: "Address", get: (s) => s.address ?? "" },
  { header: "City", get: (s) => s.city ?? "" },
  { header: "State", get: (s) => s.state ?? "" },
  { header: "Pincode", get: (s) => s.pincode ?? "" },
  { header: "Date of Birth", get: (s) => formatDate(s.dateOfBirth) },
  { header: "Gender", get: (s) => s.gender ?? "" },
  { header: "Blood Group", get: (s) => s.bloodGroup ?? "" },
  { header: "LinkedIn", get: (s) => s.linkedinUrl ?? "" },
  { header: "GitHub", get: (s) => s.githubUrl ?? "" },
  { header: "Portfolio", get: (s) => s.portfolioUrl ?? "" },
  { header: "Resume", get: (s) => s.resumeUrl ?? "" },
  { header: "Skills", get: (s) => (s.skills ?? []).join(", ") },
  { header: "Certifications", get: (s) => formatCertifications(s.certifications) },
  { header: "Trainings", get: (s) => formatTrainings(s.trainings) },
  { header: "Profile Complete", get: (s) => (s.profileComplete ? "Yes" : "No") },
  { header: "Placement Status", get: (s) => s.placementStatus },
  { header: "Alumni", get: (s) => (s.isAlumni ? "Yes" : "No") },
  { header: "Verified", get: (s) => (s.verifiedByFaculty ? "Yes" : "No") },
  { header: "Created At", get: (s) => formatDate(s.createdAt) },
  { header: "Updated At", get: (s) => formatDate(s.updatedAt) },
  { header: "Last Significant Update", get: (s) => formatDate(s.lastSignificantUpdateAt) },
];

export default function FullStudentReport() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [statusFilter, setStatusFilter] = useState<PlacementStatus | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "yes" | "no">("");

  const batchYears = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set(students.map((s) => s.batchYear))).sort((a, b) => b - a);
  }, [students]);

  const filtered = useMemo(() => {
    if (!students) return null;
    const term = search.trim().toLowerCase();
    return students
      .filter((s) => !deptFilter || s.department === deptFilter)
      .filter((s) => !statusFilter || s.placementStatus === statusFilter)
      .filter((s) => !batchFilter || s.batchYear === batchFilter)
      .filter((s) => !verifiedFilter || (verifiedFilter === "yes" ? s.verifiedByFaculty : !s.verifiedByFaculty))
      .filter(
        (s) =>
          !term ||
          s.rollNo.toLowerCase().includes(term) ||
          s.name.toLowerCase().includes(term) ||
          (s.email ?? "").toLowerCase().includes(term)
      )
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [students, search, deptFilter, statusFilter, batchFilter, verifiedFilter]);

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "full-student-report.csv",
      COLUMNS.map((c) => c.header),
      filtered.map((s) => COLUMNS.map((c) => c.get(s)))
    );
  }

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Full Student Report"
        subtitle={filtered ? `${filtered.length} of ${students?.length ?? 0} student(s) — every field on the profile.` : undefined}
        icon={FileSpreadsheet}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <label className={labelClass}>Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Roll no, name, or email"
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
          <div>
            <label className={labelClass}>Verified</label>
            <select value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value as "" | "yes" | "no")} className={inputClass}>
              <option value="">All</option>
              <option value="yes">Verified</option>
              <option value="no">Not verified</option>
            </select>
          </div>
        </div>
      </Card>

      {filtered === null && <Skeleton className="h-40" />}

      {filtered !== null && filtered.length === 0 && (
        <EmptyState icon={FileSpreadsheet} title="No students match these filters" />
      )}

      {filtered !== null && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  {COLUMNS.map((c) => (
                    <th key={c.header} className="whitespace-nowrap py-2 pr-4">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.studentId}>
                    {COLUMNS.map((c) => {
                      const value = c.get(s);
                      if (c.header === "Placement Status") {
                        return (
                          <td key={c.header} className="whitespace-nowrap py-2 pr-4">
                            <Badge variant={PLACEMENT_BADGE[s.placementStatus]}>{s.placementStatus.replace("_", " ")}</Badge>
                          </td>
                        );
                      }
                      return (
                        <td key={c.header} className="whitespace-nowrap py-2 pr-4 text-slate-600">
                          {value === "" ? "—" : value}
                        </td>
                      );
                    })}
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
