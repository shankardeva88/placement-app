import { useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, KeyRound } from "lucide-react";
import type { AttendanceStatus } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useMyTraining } from "../lib/trainingLib";
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
          <Card key={batch.batchId}>
            <h3 className="text-base font-semibold text-slate-900">{batch.name}</h3>
            <p className="text-sm capitalize text-slate-500">{batch.skillTrack.replace("_", " ")}</p>

            {sessions.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No sessions scheduled yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {sessions
                  .slice()
                  .sort((a, b) => a.session.date - b.session.date)
                  .map(({ session, attendance }) => (
                    <li
                      key={session.sessionId}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-800">{session.topic}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(session.date).toLocaleDateString()} · {session.startTime}–
                          {session.endTime} · {session.mode}
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
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
