import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Users2 } from "lucide-react";
import type { MenteeFollowUp, MentorMapping } from "@placement-app/types";
import { DB_NODES } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useDeptScopedCollection } from "../../../lib/useDeptScopedCollection";
import { useMentorDirectory } from "../../../lib/drivePrepLib";
import { computeAtRiskReasons } from "../../../lib/menteeFollowUpLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

export default function MentorWiseReport() {
  const { appUser } = useAuth();
  const mappings = useDeptScopedCollection<MentorMapping>(appUser, DB_NODES.mentorMapping, DB_NODES.mentorMappingDeptIndex);
  const followUps = useDeptScopedCollection<MenteeFollowUp>(appUser, DB_NODES.menteeFollowUps, DB_NODES.menteeFollowUpsDeptIndex);
  const mentors = useMentorDirectory(appUser);
  const students = useStudentsDirectory(appUser);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  // Last follow-up per student, computed once from the whole department's
  // follow-ups rather than a per-student hook — this report needs every
  // mentee's at-risk status at once for aggregation, not one at a time.
  const lastFollowUpByStudent = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of followUps ?? []) {
      if (!map[f.studentId] || f.createdAt > map[f.studentId]) map[f.studentId] = f.createdAt;
    }
    return map;
  }, [followUps]);

  const rows = useMemo(() => {
    if (!mappings || !followUps) return null;
    const byMentor = new Map<string, MentorMapping[]>();
    for (const m of mappings) {
      if (!byMentor.has(m.facultyId)) byMentor.set(m.facultyId, []);
      byMentor.get(m.facultyId)!.push(m);
    }

    return Array.from(byMentor.entries())
      .map(([facultyId, myMappings]) => {
        const menteeStudents = myMappings.map((m) => studentsByUid[m.studentId]).filter((s) => s !== undefined);
        const total = menteeStudents.length;
        const avgCgpa = total > 0 ? Math.round((menteeStudents.reduce((a, s) => a + s.cgpa, 0) / total) * 100) / 100 : 0;
        const avgBacklogs = total > 0 ? Math.round((menteeStudents.reduce((a, s) => a + s.activeBacklogs, 0) / total) * 10) / 10 : 0;
        const atRiskCount = menteeStudents.filter(
          (s) => computeAtRiskReasons(s, lastFollowUpByStudent[s.uid] ?? null).length > 0
        ).length;
        const mentorFollowUps = (followUps ?? []).filter((f) => f.mentorId === facultyId);
        const lastActivityAt = mentorFollowUps.length > 0 ? Math.max(...mentorFollowUps.map((f) => f.createdAt)) : null;
        return {
          facultyId,
          mentorName: mentorsByUid[facultyId]?.name ?? facultyId,
          menteeCount: total,
          avgCgpa,
          avgBacklogs,
          atRiskCount,
          followUpCount: mentorFollowUps.length,
          lastActivityAt,
        };
      })
      .sort((a, b) => a.mentorName.localeCompare(b.mentorName));
  }, [mappings, followUps, studentsByUid, mentorsByUid, lastFollowUpByStudent]);

  const loading = rows === null;

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "mentor-wise-report.csv",
      ["Mentor", "Mentees", "Avg CGPA", "Avg Backlogs", "At-risk", "Follow-ups Logged", "Last Activity"],
      rows.map((r) => [
        r.mentorName,
        r.menteeCount,
        r.avgCgpa,
        r.avgBacklogs,
        r.atRiskCount,
        r.followUpCount,
        r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString() : "",
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
        title="Mentor-wise Report"
        subtitle={loading ? undefined : `${rows.length} mentor(s) with assigned mentees`}
        icon={Users2}
        gradient="from-slate-500 to-slate-700"
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
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Mentees</th>
                  <th className="py-2 pr-4">Avg CGPA</th>
                  <th className="py-2 pr-4">Avg Backlogs</th>
                  <th className="py-2 pr-4">At-risk</th>
                  <th className="py-2 pr-4">Follow-ups</th>
                  <th className="py-2 pr-4">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.facultyId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.mentorName}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.menteeCount}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.avgCgpa}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.avgBacklogs}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.atRiskCount}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.followUpCount}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                      No mentor assignments yet.
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
