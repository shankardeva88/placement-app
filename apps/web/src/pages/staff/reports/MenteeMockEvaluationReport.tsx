import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Download } from "lucide-react";
import { DB_NODES } from "@placement-app/types";
import type { MockEvalRating, MockEvaluation, MockInterview, ResumeReview, ResumeReviewStatus, SkillAssessment, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../../lib/menteeFollowUpLib";
import { useIndexedList } from "../../../lib/mentorProgressLib";
import { useMockEvaluations, RATING_LABEL } from "../../../lib/mockEvaluationLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const RESUME_BADGE: Record<ResumeReviewStatus, BadgeVariant> = {
  not_reviewed: "neutral",
  needs_revision: "warning",
  approved: "success",
};

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

interface EvalStats {
  mockInterviewCount: number;
  avgCommunication: number | null;
  avgTechnical: number | null;
  avgConfidence: number | null;
  moduleEvalCount: number;
  latestOverall: MockEvalRating | null;
  resumeStatus: ResumeReviewStatus | null;
  skillAssessmentCount: number;
  avgSkillScore: number | null;
}

/** One-off MockInterview, ResumeReview, and SkillAssessment are all
 * per-student hooks (studentIndex-based, see mentorProgressLib.ts) — this
 * has to be its own component instance per mentee (Rules of Hooks), which
 * then reports its combined stats up to the parent for the table + CSV.
 * MockEvaluation (Modules) is passed in already-fetched from the parent,
 * since that one's dept-scoped, not per-student. */
function EvalStatsCollector({
  studentId,
  moduleEvals,
  onReport,
}: {
  studentId: string;
  moduleEvals: MockEvaluation[];
  onReport: (uid: string, stats: EvalStats) => void;
}) {
  const mockInterviews = useIndexedList<MockInterview>(studentId, DB_NODES.mockInterviews);
  const resumeReviews = useIndexedList<ResumeReview>(studentId, DB_NODES.resumeReviews);
  const skillAssessments = useIndexedList<SkillAssessment>(studentId, DB_NODES.skillAssessments);

  useEffect(() => {
    if (mockInterviews === null || resumeReviews === null || skillAssessments === null) return;
    const myModuleEvals = moduleEvals.filter((e) => e.studentId === studentId).sort((a, b) => b.date - a.date);
    const latestResume = resumeReviews.slice().sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))[0];
    onReport(studentId, {
      mockInterviewCount: mockInterviews.length,
      avgCommunication: average(mockInterviews.map((m) => m.scores.communication)),
      avgTechnical: average(mockInterviews.map((m) => m.scores.technical)),
      avgConfidence: average(mockInterviews.map((m) => m.scores.confidence)),
      moduleEvalCount: myModuleEvals.length,
      latestOverall: myModuleEvals[0]?.overallPerformance ?? null,
      resumeStatus: latestResume?.status ?? null,
      skillAssessmentCount: skillAssessments.length,
      avgSkillScore: average(skillAssessments.map((s) => s.score)),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockInterviews, resumeReviews, skillAssessments, moduleEvals, studentId]);

  return null;
}

const OVERALL_BADGE: Record<MockEvalRating, BadgeVariant> = {
  excellent: "success",
  very_good: "success",
  good: "brand",
  average: "warning",
  need_to_improve: "warning",
  poor: "danger",
  absent: "neutral",
};

export default function MenteeMockEvaluationReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const allModuleEvals = useMockEvaluations(appUser);
  const [statsByUid, setStatsByUid] = useState<Record<string, EvalStats>>({});

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  const handleReport = useCallback((uid: string, stats: EvalStats) => {
    setStatsByUid((prev) => ({ ...prev, [uid]: stats }));
  }, []);

  const loading = mentees === null || students === null || allModuleEvals === null;
  const statsLoaded = menteeStudents.length > 0 && menteeStudents.every((s) => statsByUid[s.uid]);

  function handleDownload() {
    downloadCsv(
      "mentee-mock-evaluation-report.csv",
      [
        "Roll No",
        "Name",
        "1:1 Mock Interviews",
        "Avg Communication",
        "Avg Technical",
        "Avg Confidence",
        "Module Evaluations",
        "Latest Overall Rating",
        "Resume Status",
        "Skill Assessments",
        "Avg Skill Score",
      ],
      menteeStudents.map((s) => {
        const stats = statsByUid[s.uid];
        return [
          s.rollNo,
          s.name,
          stats?.mockInterviewCount ?? 0,
          stats?.avgCommunication ?? "",
          stats?.avgTechnical ?? "",
          stats?.avgConfidence ?? "",
          stats?.moduleEvalCount ?? 0,
          stats?.latestOverall ? RATING_LABEL[stats.latestOverall] : "",
          stats?.resumeStatus ?? "",
          stats?.skillAssessmentCount ?? 0,
          stats?.avgSkillScore ?? "",
        ];
      })
    );
  }

  return (
    <div>
      {menteeStudents.map((s) => (
        <EvalStatsCollector key={s.uid} studentId={s.uid} moduleEvals={allModuleEvals ?? []} onReport={handleReport} />
      ))}

      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mock Interview & Evaluation Summary"
        subtitle={loading ? undefined : `${menteeStudents.length} mentee(s)`}
        icon={ClipboardCheck}
        gradient="from-indigo-500 to-purple-600"
        action={
          menteeStudents.length > 0 ? (
            <Button onClick={handleDownload} disabled={!statsLoaded}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      {loading && <Skeleton className="h-40" />}

      {!loading && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">1:1 Mocks</th>
                  <th className="py-2 pr-4">Avg Comm/Tech/Conf</th>
                  <th className="py-2 pr-4">Module Evals</th>
                  <th className="py-2 pr-4">Latest Rating</th>
                  <th className="py-2 pr-4">Resume</th>
                  <th className="py-2 pr-4">Skill Assessments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menteeStudents.map((s) => {
                  const stats = statsByUid[s.uid];
                  return (
                    <tr key={s.studentId}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{s.rollNo}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{stats ? stats.mockInterviewCount : "…"}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {!stats
                          ? "…"
                          : stats.mockInterviewCount === 0
                            ? "—"
                            : `${stats.avgCommunication}/${stats.avgTechnical}/${stats.avgConfidence}`}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{stats ? stats.moduleEvalCount : "…"}</td>
                      <td className="py-2 pr-4">
                        {!stats ? "…" : stats.latestOverall ? (
                          <Badge variant={OVERALL_BADGE[stats.latestOverall]}>{RATING_LABEL[stats.latestOverall]}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {!stats ? "…" : stats.resumeStatus ? (
                          <Badge variant={RESUME_BADGE[stats.resumeStatus]}>{stats.resumeStatus.replace("_", " ")}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {!stats
                          ? "…"
                          : stats.skillAssessmentCount === 0
                            ? "—"
                            : `${stats.skillAssessmentCount} (avg ${stats.avgSkillScore}/100)`}
                      </td>
                    </tr>
                  );
                })}
                {menteeStudents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-slate-400">
                      No mentees assigned to you yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
