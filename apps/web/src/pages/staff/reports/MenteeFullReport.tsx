import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileSpreadsheet, Search } from "lucide-react";
import type { PlacementStatus, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../../lib/menteeFollowUpLib";
import { downloadCsv } from "../../../lib/csv";
import { COLUMNS, PLACEMENT_BADGE } from "./FullStudentReport";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

/** Mentee-scoped equivalent of FullStudentReport — same COLUMNS (imported,
 * not duplicated, so the two can never drift apart on which fields are
 * covered), just filtered down to this mentor's own mentees first. No
 * department filter here (unlike the coordinator version): a mentor's
 * mentees are their own roster, not a department-wide pool to slice by
 * department. */
export default function MenteeFullReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlacementStatus | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "yes" | "no">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees.map((m) => studentsByUid[m.studentId]).filter((s): s is Student => s !== undefined);
  }, [mentees, studentsByUid]);

  const batchYears = useMemo(
    () => Array.from(new Set(menteeStudents.map((s) => s.batchYear))).sort((a, b) => b - a),
    [menteeStudents]
  );

  const loading = mentees === null || students === null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menteeStudents
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
  }, [menteeStudents, search, statusFilter, batchFilter, verifiedFilter]);

  function handleDownload() {
    downloadCsv(
      "mentee-full-report.csv",
      COLUMNS.map((c) => c.header),
      filtered.map((s) => COLUMNS.map((c) => c.get(s)))
    );
  }

  return (
    <div>
      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mentee Full Report"
        subtitle={loading ? undefined : `${filtered.length} of ${menteeStudents.length} mentee(s) — every field on the profile.`}
        icon={FileSpreadsheet}
        gradient="from-emerald-500 to-teal-600"
        action={
          filtered.length > 0 ? (
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
                placeholder="Roll no, name, or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
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

      {loading && <Skeleton className="h-40" />}

      {!loading && menteeStudents.length === 0 && <EmptyState icon={FileSpreadsheet} title="No mentees assigned to you yet" />}

      {!loading && menteeStudents.length > 0 && filtered.length === 0 && (
        <EmptyState icon={FileSpreadsheet} title="No mentees match these filters" />
      )}

      {!loading && filtered.length > 0 && (
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
