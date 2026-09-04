import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, ChevronRight, Users } from "lucide-react";
import type { PlacementStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useMyMentees, useMenteeFollowUps, computeAtRiskReasons, STALE_FOLLOW_UP_DAYS } from "../../lib/menteeFollowUpLib";
import { sortedSgpaEntries } from "../../lib/mentorProgressLib";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { TrendLineChart } from "../../components/charts/TrendLineChart";

const PLACEMENT_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};

/** The full read-only profile (contact, links, trainings, applications/
 * offers, 10th/12th) already exists at /staff/students/:uid — same page
 * coordinators use, already read-permitted for any dept-scoped staff role,
 * linked from the expanded panel instead of rebuilt here. What IS rebuilt
 * inline is the academic record (CGPA/backlogs/SGPA trend) — StudentDetail
 * only lists semester SGPA as plain numbers, no trend chart, and reaching
 * it meant leaving this page entirely just to check how a mentee's doing
 * academically. Click a row to expand it in place instead. */
export function MenteeRow({ student }: { student: Student }) {
  const [expanded, setExpanded] = useState(false);
  const followUps = useMenteeFollowUps(student.uid);
  const lastFollowUpAt = followUps && followUps.length > 0 ? Math.max(...followUps.map((f) => f.createdAt)) : null;
  const atRiskReasons = computeAtRiskReasons(student, lastFollowUpAt);
  const sgpaTrend = sortedSgpaEntries(student.semesterWiseSgpa);

  return (
    <Card>
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-4 text-left">
        <div className="flex min-w-0 items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-slate-900">
              {atRiskReasons.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
              {student.rollNo} — {student.name}
            </p>
            <p className="text-sm text-slate-500">
              {student.department} · Batch {student.batchYear} · CGPA {student.cgpa} · Backlogs {student.activeBacklogs}
              {student.entranceRank && ` · ${student.entranceType ? `${student.entranceType}: ` : ""}${student.entranceRank}`}
            </p>
            {(student.skills ?? []).length > 0 && (
              <p className="mt-0.5 truncate text-xs text-slate-400">{(student.skills ?? []).join(", ")}</p>
            )}
            {Object.keys(student.trainings ?? {}).length > 0 && (
              <p className="mt-0.5 truncate text-xs text-slate-400">Training: {Object.keys(student.trainings ?? {}).join(", ")}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {atRiskReasons.length > 0 && <Badge variant="warning">{atRiskReasons.length} flag(s)</Badge>}
          <Badge variant={PLACEMENT_BADGE[student.placementStatus]}>{student.placementStatus.replace("_", " ")}</Badge>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Academic record</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>
              CGPA <span className="font-semibold text-slate-900">{student.cgpa}</span>
            </span>
            <span>
              Active backlogs <span className="font-semibold text-slate-900">{student.activeBacklogs}</span>
            </span>
          </div>
          {sgpaTrend.length >= 2 ? (
            <TrendLineChart data={sgpaTrend} height={140} />
          ) : sgpaTrend.length === 1 ? (
            <p className="text-sm text-slate-500">
              Sem {sgpaTrend[0].label.replace("Sem ", "")}: {sgpaTrend[0].value} — needs a second semester to show a trend.
            </p>
          ) : (
            <p className="text-sm text-slate-400">No semester-wise SGPA recorded yet.</p>
          )}
          <Link to={`/staff/students/${student.studentId}`} className="inline-block text-sm font-medium text-brand-700 hover:underline">
            View full profile →
          </Link>
        </div>
      )}
    </Card>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function MenteeInfo() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const allMenteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  // A mentor's mentees aren't necessarily all one batch — e.g. 2027 finals
  // and 2028 3rd-years both assigned to the same mentor — so this needs its
  // own filter, same idea as the Students page batch filter.
  const batchYears = useMemo(
    () => Array.from(new Set(allMenteeStudents.map((s) => s.batchYear))).sort((a, b) => a - b),
    [allMenteeStudents]
  );

  const menteeStudents = useMemo(
    () => (batchFilter ? allMenteeStudents.filter((s) => s.batchYear === batchFilter) : allMenteeStudents),
    [allMenteeStudents, batchFilter]
  );

  const loading = mentees === null || students === null;

  return (
    <div>
      <PageHeader
        title="Mentee Info"
        subtitle={`Full profile for each of your assigned mentees — the warning flag means backlogs, low/declining CGPA, or no follow-up in ${STALE_FOLLOW_UP_DAYS}+ days.`}
        icon={Users}
        gradient="from-emerald-500 to-teal-600"
      />

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!loading && allMenteeStudents.length === 0 && (
        <EmptyState icon={Users} title="No mentees assigned to you yet" />
      )}

      {!loading && allMenteeStudents.length > 0 && batchYears.length > 1 && (
        <div className="mb-4">
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
            className={`${inputClass} sm:w-48`}
          >
            <option value="">All batches</option>
            {batchYears.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {menteeStudents.map((s) => (
          <MenteeRow key={s.studentId} student={s} />
        ))}
      </div>
    </div>
  );
}
