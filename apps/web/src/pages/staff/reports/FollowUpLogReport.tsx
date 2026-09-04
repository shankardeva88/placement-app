import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileText, Phone, Search } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, FollowUpCategory, MenteeFollowUp } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMentorDirectory } from "../../../lib/drivePrepLib";
import { useDeptScopedCollection } from "../../../lib/useDeptScopedCollection";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

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
  parent_communication: "Parent communication",
};
const READINESS_LABEL: Record<string, string> = {
  ready: "Ready",
  needs_prep: "Needs prep",
  not_ready: "Not ready",
};
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  hackathon: "Hackathon",
  coding_club: "Coding club",
  sports: "Sports",
  cultural: "Cultural",
  ncc_nss: "NCC/NSS",
  other: "Other",
};

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// Same helper as the mentor-side Mentee Follow-up Log — reads back the
// category-specific structured fields (subject, drive, readiness,
// attendance %, activity) added to MenteeFollowUp.
function detailLabel(entry: MenteeFollowUp, drives: Record<string, Drive>): string {
  const parts: string[] = [];
  switch (entry.category) {
    case "academics":
      if (entry.subject) parts.push(entry.subject);
      if (entry.concernLevel) parts.push(`${entry.concernLevel} concern`);
      break;
    case "placement":
      if (entry.driveId) parts.push(drives[entry.driveId]?.companyName ?? entry.driveId);
      if (entry.readiness) parts.push(READINESS_LABEL[entry.readiness] ?? entry.readiness);
      break;
    case "attendance":
      if (entry.subject) parts.push(entry.subject);
      if (entry.attendancePercent != null) parts.push(`${entry.attendancePercent}%`);
      break;
    case "activities":
      if (entry.activityType) parts.push(ACTIVITY_TYPE_LABEL[entry.activityType] ?? entry.activityType);
      if (entry.activityName) parts.push(entry.activityName);
      break;
    case "parent_communication":
      if (entry.parentContactMode) parts.push(`via ${entry.parentContactMode}`);
      break;
  }
  return parts.join(" — ");
}

/** Coordinator/hod version of the mentor-side Mentee Follow-up Log —
 * department-wide instead of "my mentees", with a Mentor filter since more
 * than one mentor's entries show up here. Fetches the whole department's
 * follow-ups in one useDeptScopedCollection call rather than the mentor
 * side's per-student collector dance — that per-student approach exists
 * there only because a plain faculty_mentor's read rule is mentorId-scoped
 * per record; coordinator/hod are explicitly granted department-wide read
 * on menteeFollowUps, so the direct fan-out already works. */
export default function FollowUpLogReport() {
  const { appUser } = useAuth();
  const followUps = useDeptScopedCollection<MenteeFollowUp>(appUser, DB_NODES.menteeFollowUps, DB_NODES.menteeFollowUpsDeptIndex);
  const students = useStudentsDirectory(appUser);
  const mentors = useMentorDirectory(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [search, setSearch] = useState("");
  const [mentorFilter, setMentorFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [categoryFilter, setCategoryFilter] = useState<FollowUpCategory | "">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const mentorOptions = useMemo(
    () =>
      (mentors ?? [])
        .filter((m) => m.role === "faculty_mentor" || m.role === "coordinator" || m.role === "hod")
        .map((m) => ({ uid: m.uid, name: m.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [mentors]
  );
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  const rows = useMemo(() => {
    if (!followUps || !students) return null;
    return followUps
      .map((entry) => ({ entry, student: studentsByUid[entry.studentId] }))
      .filter((r): r is { entry: MenteeFollowUp; student: NonNullable<typeof r.student> } => r.student !== undefined)
      .sort((a, b) => b.entry.createdAt - a.entry.createdAt);
  }, [followUps, students, studentsByUid]);

  const batchYears = useMemo(() => {
    if (!rows) return [];
    return Array.from(new Set(rows.map((r) => r.student.batchYear))).sort((a, b) => a - b);
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    const fromMs = fromDate ? new Date(fromDate).getTime() : null;
    const toMs = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return rows
      .filter((r) => !mentorFilter || r.entry.mentorId === mentorFilter)
      .filter((r) => !batchFilter || r.student.batchYear === batchFilter)
      .filter((r) => !categoryFilter || r.entry.category === categoryFilter)
      .filter((r) => fromMs == null || r.entry.createdAt >= fromMs)
      .filter((r) => toMs == null || r.entry.createdAt <= toMs)
      .filter(
        (r) =>
          !term ||
          r.student.rollNo.toLowerCase().includes(term) ||
          r.student.name.toLowerCase().includes(term) ||
          r.entry.note.toLowerCase().includes(term)
      );
  }, [rows, mentorFilter, batchFilter, categoryFilter, fromDate, toDate, search]);

  const loading = followUps === null || students === null || mentors === null;

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "mentee-follow-up-log.csv",
      ["Date", "Roll No", "Name", "Department", "Batch", "Mentor", "Category", "Detail", "Note", "Next Meeting Date"],
      filtered.map((r) => [
        formatDay(r.entry.createdAt),
        r.student.rollNo,
        r.student.name,
        r.student.department,
        r.student.batchYear,
        mentorsByUid[r.entry.mentorId]?.name ?? r.entry.mentorId,
        CATEGORY_LABEL[r.entry.category],
        detailLabel(r.entry, drives),
        r.entry.note,
        r.entry.nextMeetingDate ? formatDay(r.entry.nextMeetingDate) : "",
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
        title="Mentee Follow-up Log"
        subtitle={filtered ? `${filtered.length} of ${rows?.length ?? 0} entr${rows?.length === 1 ? "y" : "ies"}` : undefined}
        icon={FileText}
        gradient="from-pink-500 to-rose-600"
        action={
          filtered && filtered.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search roll no, name, or note"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)} className={inputClass}>
            <option value="">All mentors</option>
            {mentorOptions.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
          >
            <option value="">All batches</option>
            {batchYears.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as FollowUpCategory | "")} className={inputClass}>
            <option value="">All categories</option>
            {FOLLOW_UP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} title="From date" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} title="To date" />
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && filtered && filtered.length === 0 && <EmptyState icon={Search} title="No follow-ups match your filters" />}

      {!loading && filtered && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4"></th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Detail</th>
                  <th className="py-2 pr-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const isExpanded = expandedId === r.entry.followUpId;
                  const detail = detailLabel(r.entry, drives);
                  return (
                    <Fragment key={r.entry.followUpId}>
                      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpandedId(isExpanded ? null : r.entry.followUpId)}>
                        <td className="py-2 pl-1">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{formatDay(r.entry.createdAt)}</td>
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {r.student.rollNo} — {r.student.name}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{mentorsByUid[r.entry.mentorId]?.name ?? r.entry.mentorId}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="neutral">
                            {r.entry.category === "parent_communication" && <Phone className="mr-1 h-3 w-3" />}
                            {CATEGORY_LABEL[r.entry.category]}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{detail || "—"}</td>
                        <td className="max-w-xs truncate py-2 pr-4 text-slate-600">{r.entry.note}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="pb-3">
                            <div className="ml-6 rounded-lg bg-slate-50 p-3 text-sm">
                              <p className="whitespace-pre-wrap text-slate-700">{r.entry.note}</p>
                              {r.entry.nextMeetingDate && (
                                <p className="mt-2 text-xs text-slate-500">Next meeting: {formatDay(r.entry.nextMeetingDate)}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
