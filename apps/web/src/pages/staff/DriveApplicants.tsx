import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { ApplicationStatus, Drive } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useDriveApplicants, updateApplicationStatus } from "../../lib/applicantsLib";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { applyToDrive, checkEligibility } from "../../lib/driveActions";
import { applicationRoleLabel, driveRoleSummary, isMultiRole } from "../../lib/driveRolesLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { RoundProgress } from "../../components/RoundProgress";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "applied",
  "shortlisted",
  "in_round",
  "selected",
  "rejected",
  "withdrawn",
];

const STATUS_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

export default function DriveApplicants() {
  const { driveId } = useParams<{ driveId: string }>();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [drive, setDrive] = useState<Drive | null | undefined>(undefined);
  const students = useStudentsDirectory(appUser);
  const rows = useDriveApplicants(appUser, driveId, students);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);

  useEffect(() => {
    if (!driveId) return;
    return onValue(ref(db, `${DB_NODES.drives}/${driveId}`), (snap) => {
      setDrive(snap.exists() ? (snap.val() as Drive) : null);
    });
  }, [driveId]);

  async function handleUpdate(applicationId: string, status: ApplicationStatus, currentRoundId: string) {
    setUpdatingId(applicationId);
    try {
      await updateApplicationStatus(applicationId, status, currentRoundId || undefined);
      showToast("Status updated");
    } finally {
      setUpdatingId(null);
    }
  }

  // Eligible students the coordinator picked (hand-picked list, or criteria
  // match) who haven't clicked Apply themselves yet — e.g. when a company
  // hands the college an already-shortlisted roll number list and the
  // coordinator adds them via "Restrict to hand-picked students" rather than
  // waiting for each student to self-apply. Only covers students within this
  // coordinator/hod's own department scope (useStudentsDirectory) — DB rules
  // deny creating an application for a student outside it (see applications
  // .write in database.rules.json), so a drive open to multiple departments
  // needs each department's own coordinator to run this once.
  const notYetApplied = useMemo(() => {
    if (!drive || !students || !rows) return [];
    const appliedIds = new Set(rows.map((r) => r.application.studentId));
    return students.filter((s) => !s.isAlumni && !appliedIds.has(s.uid) && checkEligibility(s, drive).eligible);
  }, [drive, students, rows]);

  async function handleBulkApply() {
    if (!drive || notYetApplied.length === 0) return;
    if (!window.confirm(`Create "applied" records for ${notYetApplied.length} student(s) who haven't applied yet?`)) return;
    // Snapshot the list up front — notYetApplied itself shrinks as each write
    // lands (rows is a live listener, so it re-renders mid-batch), but that's
    // just the source recomputing; this closure keeps iterating the original
    // batch. Fired in parallel chunks rather than one at a time: sequential
    // awaits meant one slow/stuck write (or a run of permission-denied
    // rejections for students outside this coordinator's department) added up
    // to minutes of wall-clock time — and since this is plain client-side JS,
    // closing the tab killed whatever hadn't landed yet, which is why only
    // one showed up on reopen. Chunking bounds total time to roughly
    // (batch size / CONCURRENCY) round trips instead of the full batch size.
    const CONCURRENCY = 20;
    const batch = notYetApplied;
    setBulkApplying(true);
    setBulkProgress(0);
    setBulkTotal(batch.length);
    let failed = 0;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((student) =>
          Promise.race([
            applyToDrive(student, drive),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 10000)),
          ])
        )
      );
      failed += results.filter((r) => r.status === "rejected").length;
      setBulkProgress((p) => p + chunk.length);
    }
    setBulkApplying(false);
    // A "timed out" student here isn't necessarily lost — the underlying
    // Firebase write may still land after our client-side timeout gives up
    // on it. Either way it's safe: notYetApplied only ever lists students
    // without an application yet, so re-running the button never double-
    // applies, it just picks up whoever's still missing.
    const created = batch.length - failed;
    showToast(
      failed > 0
        ? `${created} applied, ${failed} didn't finish in time — click again to retry just those, it's safe to re-run`
        : `${created} student(s) marked applied`
    );
  }

  return (
    <div>
      <Link to="/staff/drives" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to drives
      </Link>

      <PageHeader
        title={drive ? `${drive.companyName} — Applicants` : "Applicants"}
        subtitle={drive ? `${driveRoleSummary(drive)} · ${rows?.length ?? 0} applicant(s)` : undefined}
        icon={Users}
        gradient="from-blue-500 to-indigo-600"
        action={
          notYetApplied.length > 0 ? (
            <Button onClick={handleBulkApply} loading={bulkApplying}>
              <UserPlus className="h-4 w-4" />
              {bulkApplying ? `Applying ${bulkProgress}/${bulkTotal}…` : `Mark ${notYetApplied.length} as applied`}
            </Button>
          ) : undefined
        }
      />

      {rows === null && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <EmptyState icon={Users} title="No applicants yet" />
      )}

      <div className="space-y-3">
        {rows?.map(({ application, student }) => (
          <Card key={application.applicationId} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              {student ? (
                <>
                  <p className="font-medium text-slate-900">
                    {student.rollNo} — {student.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {student.department} · CGPA {student.cgpa}
                    {drive && isMultiRole(drive) && ` · Applied for ${applicationRoleLabel(drive, application)}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Details restricted (different department)</p>
              )}
              {drive && (drive.rounds ?? []).length > 0 && (
                <div className="mt-2">
                  <RoundProgress rounds={drive.rounds} application={application} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Badge variant={STATUS_BADGE[application.status]}>{application.status.replace("_", " ")}</Badge>
              <select
                value={application.status}
                disabled={updatingId === application.applicationId}
                onChange={(e) =>
                  handleUpdate(application.applicationId, e.target.value as ApplicationStatus, application.currentRoundId ?? "")
                }
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              {drive && (drive.rounds ?? []).length > 0 && (
                <select
                  value={application.currentRoundId ?? ""}
                  disabled={updatingId === application.applicationId}
                  onChange={(e) => handleUpdate(application.applicationId, application.status, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">No round yet</option>
                  {drive.rounds.map((r) => (
                    <option key={r.roundId} value={r.roundId}>
                      {application.status === "rejected" ? "Rejected at" : "At"} {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
