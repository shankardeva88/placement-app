import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, MessageCircleMore } from "lucide-react";
import type { FollowUpCategory, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees, useMenteeFollowUps, getNextMeetingDate } from "../../../lib/menteeFollowUpLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const FOLLOW_UP_CATEGORIES: FollowUpCategory[] = [
  "academics",
  "placement",
  "attendance",
  "activities",
  "parent_communication",
  "personal",
];
const CATEGORY_LABEL: Record<FollowUpCategory, string> = {
  academics: "Academics",
  placement: "Placement",
  attendance: "Attendance",
  activities: "Activities",
  personal: "Personal",
  parent_communication: "Parent comm.",
};

interface FollowUpStats {
  total: number;
  byCategory: Partial<Record<FollowUpCategory, number>>;
  lastContactAt: number | null;
  nextMeetingAt: number | null;
}

/** Reports its mentee's follow-up stats up to the parent instead of
 * rendering anything itself — useMenteeFollowUps is a per-student hook, so
 * this has to be its own component instance (Rules of Hooks), one per
 * mentee. The parent needs every mentee's stats at once for the table +
 * CSV export, not just whichever row is currently visible. */
function FollowUpStatsCollector({ studentId, onReport }: { studentId: string; onReport: (uid: string, stats: FollowUpStats) => void }) {
  const followUps = useMenteeFollowUps(studentId);

  useEffect(() => {
    if (followUps === null) return;
    const byCategory: Partial<Record<FollowUpCategory, number>> = {};
    for (const f of followUps) byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    const lastContactAt = followUps.length > 0 ? Math.max(...followUps.map((f) => f.createdAt)) : null;
    onReport(studentId, { total: followUps.length, byCategory, lastContactAt, nextMeetingAt: getNextMeetingDate(followUps) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps, studentId]);

  return null;
}

export default function MenteeFollowUpReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const [statsByUid, setStatsByUid] = useState<Record<string, FollowUpStats>>({});

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  const handleReport = useCallback((uid: string, stats: FollowUpStats) => {
    setStatsByUid((prev) => ({ ...prev, [uid]: stats }));
  }, []);

  const loading = mentees === null || students === null;
  const statsLoaded = menteeStudents.length > 0 && menteeStudents.every((s) => statsByUid[s.uid]);

  function handleDownload() {
    downloadCsv(
      "mentee-follow-up-report.csv",
      ["Roll No", "Name", "Total Follow-ups", ...FOLLOW_UP_CATEGORIES.map((c) => CATEGORY_LABEL[c]), "Last Contact", "Next Meeting"],
      menteeStudents.map((s) => {
        const stats = statsByUid[s.uid];
        return [
          s.rollNo,
          s.name,
          stats?.total ?? 0,
          ...FOLLOW_UP_CATEGORIES.map((c) => stats?.byCategory[c] ?? 0),
          stats?.lastContactAt ? new Date(stats.lastContactAt).toLocaleDateString() : "",
          stats?.nextMeetingAt ? new Date(stats.nextMeetingAt).toLocaleDateString() : "",
        ];
      })
    );
  }

  return (
    <div>
      {menteeStudents.map((s) => (
        <FollowUpStatsCollector key={s.uid} studentId={s.uid} onReport={handleReport} />
      ))}

      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Follow-up Activity Report"
        subtitle={loading ? undefined : `${menteeStudents.length} mentee(s)`}
        icon={MessageCircleMore}
        gradient="from-pink-500 to-rose-600"
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Total</th>
                  {FOLLOW_UP_CATEGORIES.map((c) => (
                    <th key={c} className="py-2 pr-4">
                      {CATEGORY_LABEL[c]}
                    </th>
                  ))}
                  <th className="py-2 pr-4">Last contact</th>
                  <th className="py-2 pr-4">Next meeting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menteeStudents.map((s) => {
                  const stats = statsByUid[s.uid];
                  const overdue = !!stats?.nextMeetingAt && stats.nextMeetingAt < Date.now();
                  return (
                    <tr key={s.studentId}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{s.rollNo}</td>
                      <td className="py-2 pr-4 text-slate-600">{s.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{stats ? stats.total : "…"}</td>
                      {FOLLOW_UP_CATEGORIES.map((c) => (
                        <td key={c} className="py-2 pr-4 text-slate-600">
                          {stats ? (stats.byCategory[c] ?? 0) : "…"}
                        </td>
                      ))}
                      <td className="py-2 pr-4 text-slate-600">
                        {stats?.lastContactAt ? new Date(stats.lastContactAt).toLocaleDateString() : stats ? "—" : "…"}
                      </td>
                      <td className="py-2 pr-4">
                        {!stats ? (
                          "…"
                        ) : stats.nextMeetingAt ? (
                          <Badge variant={overdue ? "danger" : "brand"}>{new Date(stats.nextMeetingAt).toLocaleDateString()}</Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
                {menteeStudents.length === 0 && (
                  <tr>
                    <td colSpan={FOLLOW_UP_CATEGORIES.length + 5} className="py-6 text-center text-sm text-slate-400">
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
