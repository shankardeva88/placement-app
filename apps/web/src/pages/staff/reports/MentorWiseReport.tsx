import { useMemo, useState } from "react";
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

  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  const batchYears = useMemo(
    () => Array.from(new Set((students ?? []).map((s) => s.batchYear))).sort((a, b) => a - b),
    [students]
  );

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
        const menteeStudents = myMappings
          .map((m) => studentsByUid[m.studentId])
          .filter((s) => s !== undefined)
          .filter((s) => !batchFilter || s.batchYear === batchFilter);
        const total = menteeStudents.length;
        const maxCgpa = total > 0 ? Math.max(...menteeStudents.map((s) => s.cgpa)) : 0;
        const backlogCount = menteeStudents.filter((s) => s.activeBacklogs > 0).length;
        const placedCount = menteeStudents.filter(
          (s) => s.placementStatus === "placed" || s.placementStatus === "multiple_offers"
        ).length;
        const atRiskCount = menteeStudents.filter(
          (s) => computeAtRiskReasons(s, lastFollowUpByStudent[s.uid] ?? null).length > 0
        ).length;
        const menteeUids = new Set(menteeStudents.map((s) => s.uid));
        const mentorFollowUps = (followUps ?? []).filter((f) => f.mentorId === facultyId && menteeUids.has(f.studentId));
        const lastActivityAt = mentorFollowUps.length > 0 ? Math.max(...mentorFollowUps.map((f) => f.createdAt)) : null;
        return {
          facultyId,
          mentorName: mentorsByUid[facultyId]?.name ?? facultyId,
          menteeCount: total,
          maxCgpa,
          backlogCount,
          placedCount,
          atRiskCount,
          followUpCount: mentorFollowUps.length,
          lastActivityAt,
        };
      })
      .sort((a, b) => a.mentorName.localeCompare(b.mentorName));
  }, [mappings, followUps, studentsByUid, mentorsByUid, lastFollowUpByStudent, batchFilter]);

  const loading = rows === null;

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "mentor-wise-report.csv",
      ["Mentor", "Mentees", "Max CGPA", "No. with Backlogs", "Placed", "At-risk", "Follow-ups Logged", "Last Activity"],
      rows.map((r) => [
        r.mentorName,
        r.menteeCount,
        r.maxCgpa,
        r.backlogCount,
        r.placedCount,
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

      <Card className="mb-4">
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-auto"
        >
          <option value="">All batches</option>
          {batchYears.map((y) => (
            <option key={y} value={y}>
              Batch {y}
            </option>
          ))}
        </select>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Mentees</th>
                  <th className="py-2 pr-4">Max CGPA</th>
                  <th className="py-2 pr-4">No. with Backlogs</th>
                  <th className="py-2 pr-4">Placed</th>
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
                    <td className="py-2 pr-4 text-slate-600">{r.maxCgpa}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.backlogCount}</td>
                    <td className="py-2 pr-4 font-medium text-emerald-700">{r.placedCount}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.atRiskCount}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.followUpCount}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {r.lastActivityAt ? new Date(r.lastActivityAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-sm text-slate-400">
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
