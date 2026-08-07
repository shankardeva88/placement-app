import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Award, Download } from "lucide-react";
import type { SkillAssessment } from "@placement-app/types";
import { DB_NODES } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useDeptScopedCollection } from "../../../lib/useDeptScopedCollection";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export default function SkillAssessmentReport() {
  const { appUser } = useAuth();
  const assessments = useDeptScopedCollection<SkillAssessment>(appUser, DB_NODES.skillAssessments, DB_NODES.skillAssessmentsDeptIndex);
  const students = useStudentsDirectory(appUser);

  // Every department student, not just ones with an assessment on file —
  // same reasoning as the Resume Review Report: "who hasn't been assessed
  // at all" matters as much as everyone's scores.
  const rows = useMemo(() => {
    if (!students || !assessments) return null;
    const byStudent = new Map<string, SkillAssessment[]>();
    for (const a of assessments) {
      if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, []);
      byStudent.get(a.studentId)!.push(a);
    }
    return students
      .map((s) => {
        const mine = byStudent.get(s.uid) ?? [];
        return {
          student: s,
          count: mine.length,
          avgScore: average(mine.map((a) => a.score)),
          types: Array.from(new Set(mine.map((a) => a.type))),
        };
      })
      .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo));
  }, [students, assessments]);

  const loading = rows === null;

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "skill-assessment-report.csv",
      ["Roll No", "Name", "Assessment Count", "Avg Score", "Types Covered"],
      rows.map((r) => [r.student.rollNo, r.student.name, r.count, r.avgScore ?? "", r.types.join("; ")])
    );
  }

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Skill Assessment Report"
        subtitle={loading ? undefined : `${rows.length} student(s)`}
        icon={Award}
        gradient="from-violet-500 to-purple-600"
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
                  <th className="py-2 pr-4">Assessments</th>
                  <th className="py-2 pr-4">Avg Score</th>
                  <th className="py-2 pr-4">Types</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.student.studentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student.name}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {r.count === 0 ? <Badge variant="neutral">None yet</Badge> : r.count}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{r.avgScore ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600 capitalize">{r.types.join(", ").replace(/_/g, " ") || "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
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
