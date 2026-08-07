import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Users, MessageSquare, FileCheck, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { MentorMapping, MockEvaluation, MockInterview, ResumeReview, SkillAssessment } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useIndexedList, sortedSgpaEntries } from "../lib/mentorProgressLib";
import { useMyTraining } from "../lib/trainingLib";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";
import { TrendLineChart } from "../components/charts/TrendLineChart";

function Section<T>({
  title,
  icon,
  items,
  emptyText,
  renderItem,
}: {
  title: string;
  icon: LucideIcon;
  items: T[] | null;
  emptyText: string;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {items === null && <Skeleton className="h-20" />}
      {items !== null && items.length === 0 && <EmptyState icon={icon} title={emptyText} />}
      <div className="space-y-3">{items?.map(renderItem)}</div>
    </div>
  );
}

const REVIEW_BADGE: Record<ResumeReview["status"], BadgeVariant> = {
  not_reviewed: "neutral",
  needs_revision: "warning",
  approved: "success",
};

/** mentorMapping only stores facultyId (a uid) — resolve it to a name via
 * /users, now that students can read staff records in their own department
 * (see the .read comment on users/$uid in database.rules.json). */
function MentorCard({ mapping }: { mapping: MentorMapping }) {
  const [mentorName, setMentorName] = useState<string | null>(null);

  useEffect(() => {
    return onValue(ref(db, `${DB_NODES.users}/${mapping.facultyId}`), (snap) => {
      setMentorName(snap.exists() ? (snap.val() as { name: string }).name : null);
    });
  }, [mapping.facultyId]);

  return (
    <Card>
      <p className="text-sm text-slate-500">Assigned mentor</p>
      <p className="mt-1 text-base font-medium text-slate-900">{mentorName ?? "Loading…"}</p>
    </Card>
  );
}

/** CGPA/backlogs/SGPA trend — read-only mirror of what a mentor already
 * sees for this student in Mentor Tools, using the same chart. The raw
 * numbers are still self-editable on Academic Record; this is just the
 * "how am I doing" view of the same data, not a separate source of truth. */
function AcademicOverviewCard() {
  const { student } = useAuth();
  const sgpaTrend = useMemo(() => (student ? sortedSgpaEntries(student.semesterWiseSgpa) : []), [student]);
  if (!student) return null;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-slate-500">
          CGPA <span className="font-semibold text-slate-900">{student.cgpa}</span>
        </span>
        <span className="text-slate-500">
          Active backlogs <span className="font-semibold text-slate-900">{student.activeBacklogs}</span>
        </span>
      </div>
      {sgpaTrend.length >= 2 ? (
        <TrendLineChart data={sgpaTrend} height={140} />
      ) : (
        <p className="text-sm text-slate-400">Add semester-wise SGPA on Academic Record to see a trend here.</p>
      )}
    </Card>
  );
}

/** Trainings (Infosys, SAP, etc.) uploaded via a coordinator's Import
 * Trainings sheet — same data shown to staff on Students/Student Detail,
 * surfaced here so a student can see it about themselves without asking. */
function TrainingsCard() {
  const { student } = useAuth();
  const trainings = student?.trainings ?? {};
  const names = Object.keys(trainings);

  return (
    <Card>
      {names.length === 0 ? (
        <p className="text-sm text-slate-400">No completed trainings recorded yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {names.map((name) => (
            <Badge key={name} variant="success" title={trainings[name]}>
              {name}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Full session-by-session detail already lives on the Training page — this
 * is just the "am I on track" percentage plus a link, not a duplicate of
 * that page. Only sessions with a marked status (present/absent/late) count
 * — a session with no attendance record yet (not held, or check-in not
 * done) doesn't count against the student either way. */
function AttendanceSummaryCard() {
  const { student } = useAuth();
  const batches = useMyTraining(student?.uid);

  const stats = useMemo(() => {
    if (!batches) return null;
    const allSessions = batches.flatMap((b) => b.sessions);
    const marked = allSessions.filter((s) => s.attendance !== null);
    const present = marked.filter((s) => s.attendance?.status === "present" || s.attendance?.status === "late");
    return { markedCount: marked.length, presentCount: present.length };
  }, [batches]);

  if (batches === null) return <Skeleton className="h-16" />;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      {stats && stats.markedCount > 0 ? (
        <p className="text-sm text-slate-600">
          <span className="text-lg font-semibold text-slate-900">
            {Math.round((stats.presentCount / stats.markedCount) * 100)}%
          </span>{" "}
          attendance ({stats.presentCount}/{stats.markedCount} sessions)
        </p>
      ) : (
        <p className="text-sm text-slate-400">No training sessions marked yet.</p>
      )}
      <Link to="/training" className="text-sm font-medium text-brand-700 hover:text-brand-800">
        View sessions →
      </Link>
    </Card>
  );
}

/** Mock Interview Modules (e.g. "Infosys Mock") is its own dedicated page
 * with its own trend chart and day-by-day breakdown — this is just a
 * pointer with a count, not a duplicate of that page. */
function MockPerformancePointerCard() {
  const { student } = useAuth();
  const evaluations = useIndexedList<MockEvaluation>(student?.uid, DB_NODES.mockEvaluations);
  const moduleCount = useMemo(() => new Set((evaluations ?? []).map((e) => e.moduleId)).size, [evaluations]);

  if (evaluations !== null && evaluations.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Mock interview modules (company drives)
      </h2>
      <Card className="flex flex-wrap items-center justify-between gap-3">
        {evaluations === null ? (
          <Skeleton className="h-6 w-48" />
        ) : (
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{evaluations.length}</span> evaluation
            {evaluations.length === 1 ? "" : "s"} across {moduleCount} module{moduleCount === 1 ? "" : "s"} — e.g.
            "Infosys Mock", daily evaluations over a set date range.
          </p>
        )}
        <Link to="/mock-performance" className="shrink-0 text-sm font-medium text-brand-700 hover:text-brand-800">
          View details →
        </Link>
      </Card>
    </div>
  );
}

export default function MentorProgress() {
  const { student } = useAuth();
  const mentorMappings = useIndexedList<MentorMapping>(student?.uid, DB_NODES.mentorMapping);
  const mockInterviews = useIndexedList<MockInterview>(student?.uid, DB_NODES.mockInterviews);
  const resumeReviews = useIndexedList<ResumeReview>(student?.uid, DB_NODES.resumeReviews);
  const skillAssessments = useIndexedList<SkillAssessment>(student?.uid, DB_NODES.skillAssessments);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mentor Progress"
        subtitle="Academics, trainings, attendance, mock interviews, resume reviews, and skill assessments — everything your mentor tracks about you, in one place."
        icon={Users}
        gradient="from-pink-500 to-rose-600"
      />

      <Section
        title="Mentor"
        icon={Users}
        items={mentorMappings}
        emptyText="No mentor assigned yet"
        renderItem={(mm) => <MentorCard key={mm.mappingId} mapping={mm} />}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Academic review</h2>
        <AcademicOverviewCard />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Training review</h2>
        <TrainingsCard />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Attendance</h2>
        <AttendanceSummaryCard />
      </div>

      <MockPerformancePointerCard />

      <Section
        title="One-on-one mock interviews (drive prep)"
        icon={MessageSquare}
        items={mockInterviews}
        emptyText="No one-on-one mock interviews recorded yet"
        renderItem={(mi) => (
          <Card key={mi.interviewId}>
            <div className="flex items-center justify-between">
              <p className="font-medium capitalize text-slate-900">{mi.type.replace("_", " ")}</p>
              <span className="text-xs text-slate-400">{new Date(mi.date).toLocaleDateString()}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>Communication: {mi.scores.communication}/10</span>
              <span>Technical: {mi.scores.technical}/10</span>
              <span>Confidence: {mi.scores.confidence}/10</span>
            </div>
            {mi.feedback && <p className="mt-2 text-sm text-slate-500">{mi.feedback}</p>}
          </Card>
        )}
      />

      <Section
        title="Resume reviews"
        icon={FileCheck}
        items={resumeReviews}
        emptyText="No resume reviews yet"
        renderItem={(rr) => (
          <Card key={rr.reviewId}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">Version {rr.version}</p>
              <Badge variant={REVIEW_BADGE[rr.status]}>{rr.status.replace("_", " ")}</Badge>
            </div>
            {rr.comments?.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-sm text-slate-500">
                {rr.comments.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </Card>
        )}
      />

      <Section
        title="Skill assessments"
        icon={Award}
        items={skillAssessments}
        emptyText="No skill assessments yet"
        renderItem={(sa) => (
          <Card key={sa.assessmentId}>
            <div className="flex items-center justify-between">
              <p className="font-medium capitalize text-slate-900">{sa.type.replace("_", " ")}</p>
              <span className="text-sm font-medium text-slate-900">{sa.score}/100</span>
            </div>
            <p className="mt-1 text-xs capitalize text-slate-400">via {sa.source}</p>
          </Card>
        )}
      />
    </div>
  );
}
