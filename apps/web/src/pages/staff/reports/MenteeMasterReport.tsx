import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Users } from "lucide-react";
import type { PlacementStatus, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees, useMenteeFollowUps, computeAtRiskReasons } from "../../../lib/menteeFollowUpLib";
import { sortedSgpaEntries } from "../../../lib/mentorProgressLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const PLACEMENT_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};

/** At-risk needs each mentee's follow-up history, which is a per-student
 * hook (useMenteeFollowUps) — this row is its own component instance so
 * that hook call is unconditional per Rules of Hooks, same pattern as
 * MenteeRow in MenteeInfo.tsx. */
function MenteeMasterRow({ student }: { student: Student }) {
  const followUps = useMenteeFollowUps(student.uid);
  const lastFollowUpAt = followUps && followUps.length > 0 ? Math.max(...followUps.map((f) => f.createdAt)) : null;
  const atRiskReasons = computeAtRiskReasons(student, lastFollowUpAt);
  const sgpaTrend = sortedSgpaEntries(student.semesterWiseSgpa);
  const latestSgpa = sgpaTrend.length > 0 ? sgpaTrend[sgpaTrend.length - 1].value : null;

  return (
    <tr>
      <td className="py-2 pr-4 font-medium text-slate-800">{student.rollNo}</td>
      <td className="py-2 pr-4 text-slate-600">{student.name}</td>
      <td className="py-2 pr-4 text-slate-600">{student.batchYear}</td>
      <td className="py-2 pr-4 text-slate-600">{student.cgpa}</td>
      <td className="py-2 pr-4 text-slate-600">{student.activeBacklogs}</td>
      <td className="py-2 pr-4 text-slate-600">{latestSgpa ?? "—"}</td>
      <td className="py-2 pr-4">
        <Badge variant={PLACEMENT_BADGE[student.placementStatus]}>{student.placementStatus.replace("_", " ")}</Badge>
      </td>
      <td className="py-2 pr-4 text-slate-600">{Object.keys(student.trainings ?? {}).join(", ") || "—"}</td>
      <td className="py-2 pr-4">
        {atRiskReasons.length > 0 ? <Badge variant="warning">{atRiskReasons.join("; ")}</Badge> : "—"}
      </td>
      <td className="py-2 pr-4 text-slate-600">{student.verifiedByFaculty ? "Yes" : "No"}</td>
    </tr>
  );
}

export default function MenteeMasterReport() {
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

  const batchYears = useMemo(
    () => Array.from(new Set(allMenteeStudents.map((s) => s.batchYear))).sort((a, b) => a - b),
    [allMenteeStudents]
  );

  const filtered = useMemo(
    () => (batchFilter ? allMenteeStudents.filter((s) => s.batchYear === batchFilter) : allMenteeStudents),
    [allMenteeStudents, batchFilter]
  );

  const loading = mentees === null || students === null;

  function handleDownload() {
    downloadCsv(
      "mentee-master-report.csv",
      ["Roll No", "Name", "Batch", "CGPA", "Backlogs", "Latest SGPA", "Placement Status", "Trainings", "Verified"],
      filtered.map((s) => {
        const sgpaTrend = sortedSgpaEntries(s.semesterWiseSgpa);
        const latestSgpa = sgpaTrend.length > 0 ? sgpaTrend[sgpaTrend.length - 1].value : "";
        return [
          s.rollNo,
          s.name,
          s.batchYear,
          s.cgpa,
          s.activeBacklogs,
          latestSgpa,
          s.placementStatus,
          Object.keys(s.trainings ?? {}).join("; "),
          s.verifiedByFaculty ? "Yes" : "No",
        ];
      })
    );
  }

  return (
    <div>
      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mentee Master Report"
        subtitle={loading ? undefined : `${filtered.length} mentee(s)`}
        icon={Users}
        gradient="from-emerald-500 to-teal-600"
        action={
          filtered.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      {batchYears.length > 1 && (
        <Card className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Batch</label>
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
        </Card>
      )}

      {loading && <Skeleton className="h-40" />}

      {!loading && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">CGPA</th>
                  <th className="py-2 pr-4">Backlogs</th>
                  <th className="py-2 pr-4">Latest SGPA</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Trainings</th>
                  <th className="py-2 pr-4">At-risk</th>
                  <th className="py-2 pr-4">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <MenteeMasterRow key={s.studentId} student={s} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-sm text-slate-400">
                      No mentees match this filter.
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
