import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import type { AttendanceStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../lib/menteeFollowUpLib";
import { useMyTraining } from "../../lib/trainingLib";
import { useAllTrainingBatches, useAllTrainingSessions } from "../../lib/trainingManagementLib";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const ATTENDANCE_BADGE: Record<AttendanceStatus, BadgeVariant> = {
  present: "success",
  absent: "danger",
  late: "warning",
};

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Read-only — a mentor doesn't run these sessions (that's a coordinator/hod
 * or the dedicated faculty_mentor-as-trainer flow on /staff/training, which
 * has its own attendance-marking UI this deliberately doesn't duplicate).
 * This is purely "what's going on, and how are my specific mentees doing" —
 * useMyTraining is the exact same per-student hook the student's own
 * Training page uses, reused per mentee here. */
function MenteeTrainingRow({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);
  const batches = useMyTraining(student.uid);

  const allSessions = useMemo(() => {
    if (!batches) return [];
    return batches
      .flatMap((b) => b.sessions.map((s) => ({ ...s, batchName: b.batch.name })))
      .sort((a, b) => b.session.date - a.session.date);
  }, [batches]);

  const marked = allSessions.filter((s) => s.attendance !== null);
  const present = marked.filter((s) => s.attendance?.status === "present" || s.attendance?.status === "late");
  const pct = marked.length > 0 ? Math.round((present.length / marked.length) * 100) : null;

  return (
    <Card>
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
          <span className="font-medium text-slate-900">
            {student.rollNo} — {student.name}
          </span>
        </span>
        {batches === null ? (
          <span className="text-xs text-slate-400">Loading…</span>
        ) : pct === null ? (
          <span className="text-xs text-slate-400">No sessions yet</span>
        ) : (
          <span className="text-xs font-medium text-slate-600">
            {pct}% attendance ({present.length}/{marked.length})
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          {allSessions.length === 0 ? (
            <p className="text-sm text-slate-400">Not part of any training batch yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {allSessions.map(({ session, attendance, batchName }) => (
                <li key={session.sessionId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{session.topic}</p>
                    <p className="truncate text-xs text-slate-500">
                      {batchName} · {new Date(session.date).toLocaleDateString()} · {session.startTime}–{session.endTime}
                    </p>
                  </div>
                  {attendance ? (
                    <Badge variant={ATTENDANCE_BADGE[attendance.status]}>{attendance.status}</Badge>
                  ) : (
                    <Badge variant="neutral">Not marked</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

export default function FacultyMentorTraining() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const allBatches = useAllTrainingBatches();
  const allSessions = useAllTrainingSessions();

  const myDept = appUser && "department" in appUser ? appUser.department : undefined;

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  // "What's going on" — sessions in the last day through the next 7 days,
  // same window the coordinator dashboard widget uses, scoped to this
  // mentor's department.
  const currentSessions = useMemo(() => {
    if (!allBatches || !allSessions) return null;
    const deptBatchIds = new Set(allBatches.filter((b) => !myDept || b.department === myDept).map((b) => b.batchId));
    const batchById = new Map(allBatches.map((b) => [b.batchId, b]));
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const weekAhead = Date.now() + UPCOMING_WINDOW_MS;
    return allSessions
      .filter((s) => deptBatchIds.has(s.batchId) && s.date >= dayAgo && s.date <= weekAhead)
      .sort((a, b) => a.date - b.date)
      .map((s) => ({ session: s, batch: batchById.get(s.batchId) }));
  }, [allBatches, allSessions, myDept]);

  const loading = mentees === null || students === null;

  return (
    <div>
      <PageHeader
        title="Training"
        subtitle="What's currently running, and how your mentees are doing — you're not marking attendance here, see /staff/training if you also run sessions."
        icon={BookOpen}
        gradient="from-amber-500 to-orange-600"
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ongoing this week</h2>
      {currentSessions === null ? (
        <Skeleton className="mb-6 h-24" />
      ) : currentSessions.length === 0 ? (
        <Card className="mb-6 text-sm text-slate-400">No training sessions in the last day or next 7 days.</Card>
      ) : (
        <Card className="mb-6">
          <ul className="divide-y divide-slate-100">
            {currentSessions.map(({ session, batch }) => (
              <li key={session.sessionId} className="py-2.5 text-sm">
                <p className="font-medium text-slate-800">{session.topic}</p>
                <p className="text-xs text-slate-500">
                  {batch?.name ?? session.batchId} · {new Date(session.date).toLocaleDateString()} · {session.startTime}–{session.endTime} ·{" "}
                  {session.mode}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">My mentees' attendance</h2>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : menteeStudents.length === 0 ? (
        <EmptyState icon={BookOpen} title="No mentees assigned to you yet" />
      ) : (
        <div className="space-y-3">
          {menteeStudents.map((s) => (
            <MenteeTrainingRow key={s.studentId} student={s} />
          ))}
        </div>
      )}
    </div>
  );
}
