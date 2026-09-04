import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, Download, FileText, Phone, Search } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, FollowUpCategory, MenteeFollowUp, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees, useMenteeFollowUps } from "../../../lib/menteeFollowUpLib";
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

// The category-specific structured fields (subject, drive, readiness,
// attendance %, activity type/name) added to MenteeFollowUp — this is
// where they actually get read back, not just entered.
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

/** Per-mentee follow-up fetch, reporting up instead of rendering — same
 * pattern as MenteeFollowUpReport.tsx's collector, since useMenteeFollowUps
 * is a per-student hook (Rules of Hooks won't allow calling it in a loop).
 * That report only ever shows counts per category; this is the actual
 * detailed log a mentor can print/export as their maintained record — every
 * entry, every field, not just how many. */
function FollowUpCollector({ studentId, onReport }: { studentId: string; onReport: (uid: string, entries: MenteeFollowUp[]) => void }) {
  const followUps = useMenteeFollowUps(studentId);
  useEffect(() => {
    if (followUps === null) return;
    onReport(studentId, followUps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUps, studentId]);
  return null;
}

export default function MenteeFollowUpLogReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [entriesByUid, setEntriesByUid] = useState<Record<string, MenteeFollowUp[]>>({});
  const [search, setSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
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

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  const handleReport = useCallback((uid: string, entries: MenteeFollowUp[]) => {
    setEntriesByUid((prev) => ({ ...prev, [uid]: entries }));
  }, []);

  const loading = mentees === null || students === null;
  const entriesLoaded = menteeStudents.length > 0 && menteeStudents.every((s) => entriesByUid[s.uid] !== undefined);

  const rows = useMemo(() => {
    if (!entriesLoaded) return null;
    const out: { entry: MenteeFollowUp; student: Student }[] = [];
    for (const s of menteeStudents) {
      for (const entry of entriesByUid[s.uid] ?? []) out.push({ entry, student: s });
    }
    return out.sort((a, b) => b.entry.createdAt - a.entry.createdAt);
  }, [entriesLoaded, menteeStudents, entriesByUid]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    const fromMs = fromDate ? new Date(fromDate).getTime() : null;
    const toMs = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return rows
      .filter((r) => !studentFilter || r.student.uid === studentFilter)
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
  }, [rows, studentFilter, categoryFilter, fromDate, toDate, search]);

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "mentee-follow-up-log.csv",
      ["Date", "Roll No", "Name", "Category", "Detail", "Note", "Next Meeting Date"],
      filtered.map((r) => [
        formatDay(r.entry.createdAt),
        r.student.rollNo,
        r.student.name,
        CATEGORY_LABEL[r.entry.category],
        detailLabel(r.entry, drives),
        r.entry.note,
        r.entry.nextMeetingDate ? formatDay(r.entry.nextMeetingDate) : "",
      ])
    );
  }

  return (
    <div>
      {menteeStudents.map((s) => (
        <FollowUpCollector key={s.uid} studentId={s.uid} onReport={handleReport} />
      ))}

      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className={inputClass}>
            <option value="">All mentees</option>
            {menteeStudents.map((s) => (
              <option key={s.uid} value={s.uid}>
                {s.rollNo} — {s.name}
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

      {(loading || !entriesLoaded) && <Skeleton className="h-40" />}

      {entriesLoaded && filtered && filtered.length === 0 && <EmptyState icon={Search} title="No follow-ups match your filters" />}

      {entriesLoaded && filtered && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4"></th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Student</th>
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
                          <td colSpan={6} className="pb-3">
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
