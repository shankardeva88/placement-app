import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileCheck } from "lucide-react";
import type { ResumeReview, ResumeReviewStatus } from "@placement-app/types";
import { DB_NODES } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useDeptScopedCollection } from "../../../lib/useDeptScopedCollection";
import { useMentorDirectory } from "../../../lib/drivePrepLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const STATUS_BADGE: Record<ResumeReviewStatus, BadgeVariant> = {
  not_reviewed: "neutral",
  needs_revision: "warning",
  approved: "success",
};
const STATUS_LABEL: Record<ResumeReviewStatus, string> = {
  not_reviewed: "Not reviewed",
  needs_revision: "Needs revision",
  approved: "Approved",
};

export default function ResumeReviewReport() {
  const { appUser } = useAuth();
  const reviews = useDeptScopedCollection<ResumeReview>(appUser, DB_NODES.resumeReviews, DB_NODES.resumeReviewsDeptIndex);
  const students = useStudentsDirectory(appUser);
  const mentors = useMentorDirectory(appUser);

  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  // Every department student, not just ones with a review on file — "who
  // hasn't been reviewed at all" is exactly what a coordinator needs to see,
  // same reasoning as the Mentee Master Report showing every mentee
  // regardless of whether they have data yet.
  const rows = useMemo(() => {
    if (!students || !reviews) return null;
    const latestByStudent = new Map<string, ResumeReview>();
    for (const r of reviews) {
      const existing = latestByStudent.get(r.studentId);
      if (!existing || (r.reviewedAt ?? 0) > (existing.reviewedAt ?? 0)) latestByStudent.set(r.studentId, r);
    }
    return students
      .map((s) => ({ student: s, latest: latestByStudent.get(s.uid) ?? null }))
      .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo));
  }, [students, reviews]);

  const loading = rows === null;

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "resume-review-report.csv",
      ["Roll No", "Name", "Status", "Version", "Reviewed By", "Reviewed At", "Comments"],
      rows.map(({ student, latest }) => [
        student.rollNo,
        student.name,
        latest ? STATUS_LABEL[latest.status] : "No review yet",
        latest?.version ?? "",
        latest ? (mentorsByUid[latest.mentorId]?.name ?? latest.mentorId) : "",
        latest?.reviewedAt ? new Date(latest.reviewedAt).toLocaleDateString() : "",
        latest?.comments?.join("; ") ?? "",
      ])
    );
  }

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Resume Review Report"
        subtitle={loading ? undefined : `${rows.length} student(s)`}
        icon={FileCheck}
        gradient="from-blue-500 to-indigo-600"
        action={
          rows && rows.length > 0 ? (
            <Button onClick={handleDownload}>
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
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Version</th>
                  <th className="py-2 pr-4">Reviewed by</th>
                  <th className="py-2 pr-4">Reviewed at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ student, latest }) => (
                  <tr key={student.studentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{student.name}</td>
                    <td className="py-2 pr-4">
                      {latest ? (
                        <Badge variant={STATUS_BADGE[latest.status]}>{STATUS_LABEL[latest.status]}</Badge>
                      ) : (
                        <Badge variant="neutral">No review yet</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{latest?.version ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{latest ? mentorsByUid[latest.mentorId]?.name ?? latest.mentorId : "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {latest?.reviewedAt ? new Date(latest.reviewedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                      No students in scope.
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
