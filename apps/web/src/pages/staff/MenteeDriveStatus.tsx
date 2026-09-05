import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ListChecks, Search } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Application, ApplicationStatus, Drive, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useMyMentees } from "../../lib/menteeFollowUpLib";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllApplications } from "../../lib/applicantsLib";
import { applicationRoleLabel, driveRoleSummary, isMultiRole } from "../../lib/driveRolesLib";
import { RoundProgress } from "../../components/RoundProgress";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const STATUS_OPTIONS: ApplicationStatus[] = ["applied", "shortlisted", "in_round", "selected", "rejected", "withdrawn"];

const APPLICATION_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

function MenteeDriveRow({ application, drive }: { application: Application; drive: Drive | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">{drive?.companyName ?? application.driveId}</p>
          {drive && (
            <p className="text-sm text-slate-500">{isMultiRole(drive) ? applicationRoleLabel(drive, application) : driveRoleSummary(drive)}</p>
          )}
        </div>
        <Badge variant={APPLICATION_BADGE[application.status]}>{application.status.replace("_", " ")}</Badge>
      </div>
      {drive && (drive.rounds ?? []).length > 0 && (
        <div className="mt-2">
          <RoundProgress rounds={drive.rounds} application={application} />
        </div>
      )}
    </div>
  );
}

function MenteeCard({
  student,
  applications,
  drivesById,
}: {
  student: Student;
  applications: Application[];
  drivesById: Record<string, Drive>;
}) {
  // Collapsed by default — a mentee applying to 10-15 drives dumped that
  // many detail rows into every single card at once, which is a lot to
  // scroll past just to see the next mentee. Click a card to see its drives.
  const [expanded, setExpanded] = useState(false);
  const selectedCount = applications.filter((a) => a.status === "selected").length;

  if (applications.length === 0) {
    return (
      <Card>
        <p className="font-medium text-slate-900">
          {student.rollNo} — {student.name}
        </p>
        <p className="text-sm text-slate-500">
          {student.department} · Batch {student.batchYear}
          {student.studentPhone && ` · ${student.studentPhone}`}
        </p>
        <p className="mt-3 text-sm text-slate-400">Not applied to any drive yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <p className="font-medium text-slate-900">
            {student.rollNo} — {student.name}
          </p>
          <p className="text-sm text-slate-500">
            {student.department} · Batch {student.batchYear}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="brand">
            {applications.length} drive{applications.length === 1 ? "" : "s"}
          </Badge>
          {selectedCount > 0 && <Badge variant="success">{selectedCount} selected</Badge>}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {applications.map((a) => (
            <MenteeDriveRow key={a.applicationId} application={a} drive={drivesById[a.driveId]} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Flips the axis FacultyMentorDrives.tsx uses (one card per drive, "my
 * mentees in this drive" inside) — here it's one card per mentee, every
 * drive they've applied to and which round they're at, all on one screen.
 * Built from the same Application/Drive data, no new records needed —
 * scanning ~10-12 mentees drive-by-drive across 20+ open drives was the
 * actual pain point, not missing data. */
export default function MenteeDriveStatus() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const applications = useAllApplications(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const menteeUids = useMemo(() => new Set((mentees ?? []).map((m) => m.studentId)), [mentees]);

  const menteeStudents = useMemo(() => {
    return Array.from(menteeUids)
      .map((uid) => studentsByUid[uid])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [menteeUids, studentsByUid]);

  // A mentor with mentees across more than one batch year (see the same
  // gap fixed on Mock Interview Modules) — every batch showed mixed
  // together with no way to narrow to just one.
  const batchYearOptions = useMemo(
    () => Array.from(new Set(menteeStudents.map((s) => s.batchYear))).sort((a, b) => a - b),
    [menteeStudents]
  );

  const applicationsByStudent = useMemo(() => {
    const map = new Map<string, Application[]>();
    for (const a of applications ?? []) {
      if (!menteeUids.has(a.studentId)) continue;
      if (!map.has(a.studentId)) map.set(a.studentId, []);
      map.get(a.studentId)!.push(a);
    }
    for (const list of map.values()) list.sort((a, b) => b.appliedAt - a.appliedAt);
    return map;
  }, [applications, menteeUids]);

  // The status filter narrows which mentees show (must have at least one
  // matching application) AND which of that mentee's drive rows actually
  // render — picking "selected", for instance, means "just show me who's
  // selected somewhere," not every drive they've ever applied to.
  const filteredMentees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menteeStudents
      .filter((s) => !batchFilter || s.batchYear === batchFilter)
      .filter((s) => !term || s.rollNo.toLowerCase().includes(term) || s.name.toLowerCase().includes(term))
      .filter((s) => !statusFilter || (applicationsByStudent.get(s.uid) ?? []).some((a) => a.status === statusFilter));
  }, [menteeStudents, search, batchFilter, statusFilter, applicationsByStudent]);

  const loading = mentees === null || students === null || applications === null;

  return (
    <div>
      <PageHeader
        title="Mentee Drive Status"
        subtitle="Every mentee, every drive they've applied to, and which round they're at — one screen, no need to open each drive."
        icon={ListChecks}
        gradient="from-pink-500 to-rose-600"
      />

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {!loading && menteeStudents.length === 0 && <EmptyState icon={ListChecks} title="No mentees assigned yet" />}

      {!loading && menteeStudents.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by roll number or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
            {batchYearOptions.length > 1 && (
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
                className={`${inputClass} sm:w-44`}
              >
                <option value="">All batches</option>
                {batchYearOptions.map((y) => (
                  <option key={y} value={y}>
                    Batch {y}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "")}
              className={`${inputClass} sm:w-44`}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          {filteredMentees.length === 0 ? (
            <EmptyState icon={Search} title="No mentees match your filters" />
          ) : (
            <div className="space-y-4">
              {filteredMentees.map((s) => {
                const allApps = applicationsByStudent.get(s.uid) ?? [];
                const shownApps = statusFilter ? allApps.filter((a) => a.status === statusFilter) : allApps;
                return <MenteeCard key={s.uid} student={s} applications={shownApps} drivesById={drives} />;
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
