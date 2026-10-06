import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, ChevronDown, ChevronUp, KeyRound } from "lucide-react";
import type { AttendanceStatus, TrainingBatch } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useMyTraining } from "../lib/trainingLib";
import type { SessionWithAttendance } from "../lib/trainingLib";
import { selfCheckIn } from "../lib/checkInLib";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";

const ATTENDANCE_BADGE: Record<AttendanceStatus, BadgeVariant> = {
  present: "success",
  absent: "danger",
  late: "warning",
};

function CheckInAction({ sessionId }: { sessionId: string }) {
  const { firebaseUser, student } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !student) return;
    setSubmitting(true);
    setError(false);
    try {
      await selfCheckIn(sessionId, code.trim().toUpperCase(), firebaseUser.uid, student.department);
      showToast("Checked in!");
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
      >
        <KeyRound className="h-3.5 w-3.5" />
        Enter code
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
      <input
        type="text"
        autoFocus
        placeholder="CODE"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs uppercase tracking-widest focus:border-brand-500 focus:outline-none"
      />
      <Button type="submit" loading={submitting} className="!px-2 !py-1 text-xs">
        Go
      </Button>
      {error && <span className="text-xs text-red-600">Invalid or expired</span>}
    </form>
  );
}

// One dot per session (not per day — a day can hold more than one, and
// each is its own attendance record) so this stays exactly as granular as
// the day-wise matrix coordinators/mentors already see, just condensed
// into something glanceable without expanding the card. Grey means the
// session hasn't happened yet; a lighter grey means it has but nothing
// was ever marked.
function dayStripColor(session: SessionWithAttendance["session"], attendance: SessionWithAttendance["attendance"]): string {
  if (session.date > Date.now()) return "bg-slate-200";
  if (!attendance) return "bg-slate-300";
  if (attendance.status === "present") return "bg-emerald-500";
  if (attendance.status === "late") return "bg-amber-500";
  return "bg-red-500";
}

function TrainingBatchCard({ batch, sessions }: { batch: TrainingBatch; sessions: SessionWithAttendance[] }) {
  // Collapsed by default — same fix as Offers/Drives/Internships: a
  // student in several training batches (or one batch with a long session
  // history) had every session list open at once. Session count stays
  // visible in the header even collapsed, and a pending check-in gets its
  // own badge so a student doesn't have to expand every batch just to see
  // whether they still need to check in somewhere.
  const [expanded, setExpanded] = useState(false);
  const pendingCheckIn = sessions.some((s) => !s.attendance);
  const sortedSessions = useMemo(() => sessions.slice().sort((a, b) => a.session.date - b.session.date), [sessions]);

  // Same calculation as the coordinator/mentor Training Reports: only
  // sessions that have already happened count toward the total (upcoming
  // ones would make the percentage look artificially low), and late counts
  // as attended.
  const { heldCount, attendedCount, attendancePct } = useMemo(() => {
    const now = Date.now();
    const held = sessions.filter((s) => s.session.date <= now);
    const attended = held.filter((s) => s.attendance?.status === "present" || s.attendance?.status === "late").length;
    return {
      heldCount: held.length,
      attendedCount: attended,
      attendancePct: held.length > 0 ? Math.round((attended / held.length) * 100) : null,
    };
  }, [sessions]);

  // Same date filter as the coordinator-side batch view — jump straight to
  // one day instead of scrolling a multi-day training's full session list.
  const [dateFilter, setDateFilter] = useState("");
  const dateKey = (ts: number) => new Date(ts).toDateString();
  // Most recent date first in the dropdown — sessions itself stays
  // ascending (the natural reading order once expanded below), so this
  // sorts its own copy rather than relying on insertion order.
  const dateOptions = useMemo(() => {
    const firstSeenAt = new Map<string, number>();
    for (const s of sessions) {
      const key = dateKey(s.session.date);
      if (!firstSeenAt.has(key)) firstSeenAt.set(key, s.session.date);
    }
    return Array.from(firstSeenAt.keys()).sort((a, b) => firstSeenAt.get(b)! - firstSeenAt.get(a)!);
  }, [sessions]);
  const visibleSessions = useMemo(
    () => (dateFilter ? sessions.filter((s) => dateKey(s.session.date) === dateFilter) : sessions),
    [sessions, dateFilter]
  );

  // Grouped by calendar day instead of one flat list — a multi-day training
  // (say 10 straight days of morning/evening sessions) repeated the same
  // date on every row and made it hard to tell at a glance which sessions
  // belonged to which day.
  const sessionsByDate = useMemo(() => {
    const sorted = visibleSessions.slice().sort((a, b) => a.session.date - b.session.date);
    const groups: { dateKey: string; date: number; sessions: SessionWithAttendance[] }[] = [];
    for (const s of sorted) {
      const key = dateKey(s.session.date);
      const last = groups[groups.length - 1];
      if (last && last.dateKey === key) last.sessions.push(s);
      else groups.push({ dateKey: key, date: s.session.date, sessions: [s] });
    }
    return groups;
  }, [visibleSessions]);

  return (
    <Card>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{batch.name}</h3>
          <p className="text-sm capitalize text-slate-500">{batch.skillTrack.replace("_", " ")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="neutral">
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </Badge>
          {attendancePct !== null && (
            <Badge variant={attendancePct >= 75 ? "warning" : "danger"}>
              {attendedCount}/{heldCount} ({attendancePct}%)
            </Badge>
          )}
          {pendingCheckIn && <Badge variant="warning">Check-in pending</Badge>}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {sortedSessions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-2">
          {sortedSessions.map(({ session, attendance }) => (
            <div
              key={session.sessionId}
              className="flex flex-col items-center gap-1"
              title={`${new Date(session.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} — ${
                session.date > Date.now() ? "upcoming" : attendance ? attendance.status : "not marked"
              }`}
            >
              <span className="text-[10px] leading-none text-slate-400">
                {new Date(session.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
              <span className={`h-2.5 w-2.5 rounded-full ${dayStripColor(session, attendance)}`} />
            </div>
          ))}
        </div>
      )}

      {expanded &&
        (sessions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No sessions scheduled yet.</p>
        ) : (
          <>
            {dateOptions.length > 1 && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All dates ({sessions.length} sessions)</option>
                {dateOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
            {sessionsByDate.map((group) => (
            <div key={group.dateKey} className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {new Date(group.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              </h4>
              <ul className="mt-1 divide-y divide-slate-100">
                {group.sessions.map(({ session, attendance }) => (
                  <li key={session.sessionId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-slate-800">{session.topic}</p>
                      <p className="text-xs text-slate-500">
                        {session.startTime}–{session.endTime} · {session.mode}
                      </p>
                    </div>
                    {attendance ? (
                      <Badge variant={ATTENDANCE_BADGE[attendance.status]}>{attendance.status}</Badge>
                    ) : (
                      <CheckInAction sessionId={session.sessionId} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
            ))}
          </>
        ))}
    </Card>
  );
}

export default function Training() {
  const { student } = useAuth();
  const batches = useMyTraining(student?.uid);

  return (
    <div>
      <PageHeader
        title="Training"
        subtitle="Your assigned batches, sessions, and attendance."
        icon={BookOpen}
        gradient="from-amber-500 to-orange-600"
      />

      {batches === null && <Skeleton className="h-40" />}

      {batches !== null && batches.length === 0 && (
        <EmptyState icon={BookOpen} title="No training batches assigned yet" />
      )}

      <div className="space-y-4">
        {batches?.map(({ batch, sessions }) => (
          <TrainingBatchCard key={batch.batchId} batch={batch} sessions={sessions} />
        ))}
      </div>
    </div>
  );
}
