import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, ListChecks } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { ApplicationStatus, Drive, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../../lib/menteeFollowUpLib";
import { useAllApplications } from "../../../lib/applicantsLib";
import { applicationRoleLabel } from "../../../lib/driveRolesLib";
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

const STATUS_OPTIONS: ApplicationStatus[] = ["applied", "shortlisted", "in_round", "selected", "rejected", "withdrawn"];
const STATUS_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};
const ATTENDANCE_BADGE: Record<"present" | "absent", BadgeVariant> = {
  present: "success",
  absent: "danger",
};

/** Mentee-scoped equivalent of DriveStudentWiseReport (the coordinator-side
 * Student-wise Drive Summary) — same one-row-per-application shape, filtered
 * down to this mentor's own mentees so they can trace a single mentee
 * across every drive, or export their whole roster's application history. */
export default function MenteeDriveSummaryReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const applications = useAllApplications(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [driveFilter, setDriveFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const menteeUids = useMemo(() => new Set((mentees ?? []).map((m) => m.studentId)), [mentees]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees.map((m) => studentsByUid[m.studentId]).filter((s): s is Student => s !== undefined);
  }, [mentees, studentsByUid]);

  const batchYearOptions = useMemo(
    () => Array.from(new Set(menteeStudents.map((s) => s.batchYear))).sort((a, b) => a - b),
    [menteeStudents]
  );

  const allRows = useMemo(() => {
    if (!applications) return null;
    return applications
      .filter((a) => menteeUids.has(a.studentId))
      .map((a) => ({ application: a, student: studentsByUid[a.studentId], drive: drives[a.driveId] }))
      .filter((r) => r.student !== undefined);
  }, [applications, studentsByUid, drives, menteeUids]);

  const driveOptions = useMemo(() => {
    if (!allRows) return [];
    const ids = Array.from(new Set(allRows.map((r) => r.application.driveId)));
    return ids
      .map((id) => ({ id, name: drives[id]?.companyName ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows, drives]);

  const rows = useMemo(() => {
    if (!allRows) return null;
    const q = search.trim().toLowerCase();
    return allRows
      .filter((r) => !batchFilter || r.student!.batchYear === batchFilter)
      .filter((r) => !driveFilter || r.application.driveId === driveFilter)
      .filter((r) => !statusFilter || r.application.status === statusFilter)
      .filter(
        (r) =>
          !q ||
          r.student!.rollNo.toLowerCase().includes(q) ||
          r.student!.name.toLowerCase().includes(q) ||
          (r.drive?.companyName ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.student!.rollNo.localeCompare(b.student!.rollNo) || a.application.appliedAt - b.application.appliedAt);
  }, [allRows, search, batchFilter, driveFilter, statusFilter]);

  function roundName(drive: Drive | undefined, roundId: string | undefined): string {
    if (!drive || !roundId) return "—";
    return drive.rounds?.find((r) => r.roundId === roundId)?.name ?? "—";
  }

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "mentee-drive-summary-report.csv",
      ["Roll No", "Name", "Batch", "Company", "Role", "Applied Date", "Status", "Current Round", "Attendance", "Last Updated"],
      rows.map((r) => [
        r.student!.rollNo,
        r.student!.name,
        r.student!.batchYear,
        r.drive?.companyName ?? r.application.driveId,
        r.drive ? applicationRoleLabel(r.drive, r.application) : "—",
        new Date(r.application.appliedAt).toLocaleDateString(),
        r.application.status.replace("_", " "),
        roundName(r.drive, r.application.currentRoundId),
        r.application.attendance ?? "not marked",
        new Date(r.application.updatedAt).toLocaleDateString(),
      ])
    );
  }

  const loading = mentees === null || students === null || allRows === null;

  return (
    <div>
      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mentee-wise Drive Summary"
        subtitle="Every application, one row per mentee per drive."
        icon={ListChecks}
        gradient="from-violet-500 to-purple-600"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            placeholder="Search roll no, name, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")} className={inputClass}>
            <option value="">All batches</option>
            {batchYearOptions.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
          <select value={driveFilter} onChange={(e) => setDriveFilter(e.target.value)} className={inputClass}>
            <option value="">All drives</option>
            {driveOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "")} className={inputClass}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}
      {!loading && menteeStudents.length === 0 && <EmptyState icon={ListChecks} title="No mentees assigned to you yet" />}
      {!loading && menteeStudents.length > 0 && allRows!.length === 0 && <EmptyState icon={ListChecks} title="No mentee applications yet" />}
      {!loading && allRows!.length > 0 && rows!.length === 0 && (
        <EmptyState icon={ListChecks} title="No applications match your filters" />
      )}

      {!loading && rows!.length > 0 && (
        <Card>
          <p className="mb-3 text-xs text-slate-500">{rows!.length} of {allRows!.length} application(s)</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Applied</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Current round</th>
                  <th className="py-2 pr-4">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows!.map((r) => (
                  <tr key={r.application.applicationId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.student!.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student!.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student!.batchYear}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.drive?.companyName ?? r.application.driveId}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.drive ? applicationRoleLabel(r.drive, r.application) : "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{new Date(r.application.appliedAt).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={STATUS_BADGE[r.application.status]}>{r.application.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{roundName(r.drive, r.application.currentRoundId)}</td>
                    <td className="py-2 pr-4">
                      {r.application.attendance ? (
                        <Badge variant={ATTENDANCE_BADGE[r.application.attendance]}>{r.application.attendance}</Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
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
