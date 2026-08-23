import { useEffect, useMemo, useState } from "react";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Application, ApplicationStatus, Drive, DriveStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useMyMentees } from "../../lib/menteeFollowUpLib";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllApplications } from "../../lib/applicantsLib";
import { driveCtcSummary, driveRoleSummary } from "../../lib/driveRolesLib";
import { RoundProgress } from "../../components/RoundProgress";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const DRIVE_BADGE: Record<DriveStatus, BadgeVariant> = {
  upcoming: "brand",
  ongoing: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const APPLICATION_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

const DRIVE_TYPE_LABEL: Record<Drive["type"], string> = {
  full_time: "Full-time",
  internship: "Internship",
  internship_plus_full_time: "Internship + Full-time",
};

const STATUS_FILTERS: { value: DriveStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Read-only — every field a coordinator enters when creating/editing a
 * drive (see DriveForm.tsx), but no create/edit/status-change/applicants
 * actions here. Drive operations stay coordinator/hod-tier; this page is
 * just visibility so a mentor can see what's coming up (or already ran)
 * without needing the full Drives management screen. */
function DriveDetailCard({
  drive,
  menteeApplications,
  studentsByUid,
}: {
  drive: Drive;
  menteeApplications: Application[];
  studentsByUid: Record<string, Student>;
}) {
  // Eligibility/rounds/mentee-applications collapsed by default — a mentor
  // scanning the full drive history (every drive ever run, per the page
  // subtitle) doesn't need all three expanded for every single card at
  // once; click a drive to see its details.
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{drive.companyName}</h3>
          <p className="text-sm text-slate-500">
            {driveRoleSummary(drive)} · {DRIVE_TYPE_LABEL[drive.type]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {menteeApplications.length > 0 && (
            <Badge variant="brand">
              {menteeApplications.length} mentee{menteeApplications.length === 1 ? "" : "s"}
            </Badge>
          )}
          <Badge variant={DRIVE_BADGE[drive.status]}>{drive.status}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">CTC</dt>
          <dd className="font-medium text-slate-900">{driveCtcSummary(drive)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Drive date</dt>
          <dd className="font-medium text-slate-900">{new Date(drive.driveDate).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Job description</dt>
          <dd className="font-medium text-slate-900">
            {drive.jdUrl ? (
              <a href={drive.jdUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                View
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {expanded && (
        <>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Eligibility</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="neutral">CGPA ≥ {drive.eligibility.minCgpa}</Badge>
              <Badge variant="neutral">Backlogs ≤ {drive.eligibility.maxBacklogsAllowed}</Badge>
              <Badge variant="neutral">{(drive.eligibility.departments ?? []).join(", ") || "Any department"}</Badge>
              <Badge variant="neutral">Batch {(drive.eligibility.batchYears ?? []).join(", ")}</Badge>
              {drive.eligibility.requiredSkills && drive.eligibility.requiredSkills.length > 0 && (
                <Badge variant="neutral">Skills: {drive.eligibility.requiredSkills.join(", ")}</Badge>
              )}
              {drive.eligibility.requiredTrainings && drive.eligibility.requiredTrainings.length > 0 && (
                <Badge variant="neutral">Trainings: {drive.eligibility.requiredTrainings.join(", ")}</Badge>
              )}
              {drive.eligibility.gender && drive.eligibility.gender !== "any" && (
                <Badge variant="neutral">{drive.eligibility.gender} only</Badge>
              )}
            </div>
          </div>

          {(drive.rounds ?? []).length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rounds</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {drive.rounds.map((r) => {
                  // Once the whole drive is marked completed, every round is
                  // done too — shown regardless of each round's own stored
                  // status, which stays whatever it was last saved as (a drive
                  // created before per-round status editing existed just has
                  // every round stuck at the initial "pending" default).
                  const status = drive.status === "completed" ? "completed" : r.status;
                  return (
                    <Badge key={r.roundId} variant={status === "completed" ? "success" : status === "in_progress" ? "warning" : "neutral"}>
                      {r.name} — {status.replace("_", " ")}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {menteeApplications.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">My mentees in this drive</p>
              <ul className="space-y-3">
                {menteeApplications.map((a) => {
                  const student = studentsByUid[a.studentId];
                  return (
                    <li key={a.applicationId} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-slate-800">
                          {student ? `${student.rollNo} — ${student.name}` : a.studentId}
                        </span>
                        <Badge variant={APPLICATION_BADGE[a.status]}>{a.status.replace("_", " ")}</Badge>
                      </div>
                      <RoundProgress rounds={drive.rounds} application={a} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function FacultyMentorDrives() {
  const { appUser, firebaseUser } = useAuth();
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<DriveStatus | "">("");

  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const applications = useAllApplications(appUser);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const menteeUids = useMemo(() => new Set((mentees ?? []).map((m) => m.studentId)), [mentees]);

  // Every drive that at least one of this mentor's mentees applied to,
  // keyed by driveId — lets each DriveDetailCard show only its own slice
  // instead of filtering the whole applications list per card render.
  const menteeApplicationsByDrive = useMemo(() => {
    const map = new Map<string, Application[]>();
    for (const a of applications ?? []) {
      if (!menteeUids.has(a.studentId)) continue;
      if (!map.has(a.driveId)) map.set(a.driveId, []);
      map.get(a.driveId)!.push(a);
    }
    return map;
  }, [applications, menteeUids]);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      const list = val ? Object.values(val) : [];
      list.sort((a, b) => b.driveDate - a.driveDate);
      setDrives(list);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!drives) return null;
    return statusFilter ? drives.filter((d) => d.status === statusFilter) : drives;
  }, [drives, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Drives"
        subtitle="Every placement drive — completed and upcoming — with the full details your coordinator entered."
        icon={Briefcase}
        gradient="from-blue-500 to-indigo-600"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DriveStatus | "")} className={inputClass}>
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {filtered === null && (
        <div className="space-y-4">
          <Skeleton className="h-40" />
        </div>
      )}

      {filtered !== null && filtered.length === 0 && (
        <EmptyState icon={Briefcase} title="No drives match this filter" />
      )}

      <div className="space-y-4">
        {filtered?.map((drive) => (
          <DriveDetailCard
            key={drive.driveId}
            drive={drive}
            menteeApplications={menteeApplicationsByDrive.get(drive.driveId) ?? []}
            studentsByUid={studentsByUid}
          />
        ))}
      </div>
    </div>
  );
}
