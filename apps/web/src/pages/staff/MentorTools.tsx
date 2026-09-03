import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CalendarClock, GraduationCap, MessageCircleMore, Pencil, Phone, Upload, UserPlus, Users } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type {
  Department,
  Drive,
  FacultyDesignation,
  FollowUpCategory,
  MentorMapping,
  MockInterview,
  MockInterviewType,
  ParentContactMode,
  PlacementStatus,
  ResumeReview,
  SkillAssessment,
  Student,
} from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useDeptScopedCollection } from "../../lib/useDeptScopedCollection";
import {
  assignMentorBulk,
  recordMockInterview,
  updateMockInterview,
  recordResumeReview,
  updateResumeReview,
  recordSkillAssessment,
  updateSkillAssessment,
  useAllMockInterviews,
} from "../../lib/mentorToolsLib";
import { createStaffAccount, parseMentorRows } from "../../lib/staffAuthActions";
import type { ParsedMentorRow } from "../../lib/staffAuthActions";
import { parseDelimited } from "../../lib/csv";
import { useMentorDirectory, useMyDrivePrepAssignments } from "../../lib/drivePrepLib";
import {
  useMyMentees,
  useMenteeFollowUps,
  recordFollowUp,
  getNextMeetingFollowUp,
  clearNextMeetingDate,
  computeAtRiskReasons,
  STALE_FOLLOW_UP_DAYS,
} from "../../lib/menteeFollowUpLib";
import { sortedSgpaEntries, useIndexedList } from "../../lib/mentorProgressLib";
import { useMockEvaluations } from "../../lib/mockEvaluationLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { TrendLineChart } from "../../components/charts/TrendLineChart";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const MOCK_TYPES: MockInterviewType[] = ["technical", "hr", "group_discussion"];

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];
const DESIGNATIONS: FacultyDesignation[] = ["professor", "associate_professor", "assistant_professor"];
const DESIGNATION_LABEL: Record<FacultyDesignation, string> = {
  professor: "Professor",
  associate_professor: "Associate Professor",
  assistant_professor: "Assistant Professor",
};

const PLACEMENT_STATUS_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};
const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  not_placed: "Not placed",
  placed: "Placed",
  multiple_offers: "Multiple offers",
  opted_higher_studies: "Higher studies",
  opted_out: "Opted out",
};

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
const PARENT_CONTACT_MODES: ParentContactMode[] = ["call", "meeting", "message"];


function useDrivesById(): Record<string, Drive> | null {
  const [drives, setDrives] = useState<Record<string, Drive> | null>(null);
  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);
  return drives;
}

/** General mentees ∪ drive-prep-assigned students, not the whole department
 * roster — mock interviews/resume reviews/skill assessments are mentor-
 * student actions (each record carries mentorId), so recording one for a
 * student with no relationship to you doesn't fit the model. But that
 * relationship isn't only mentorMapping: a coordinator can assign any
 * eligible student to any mentor for drive-specific prep (Drive Eligibility)
 * independent of general mentorship, and My Drive Prep's "Log mock
 * interview" button relies on that student being selectable here — mentees-
 * only used to silently fail to preselect a drive-prep-only student.
 * AssignMentorSection has its own full-roster picker since assigning is
 * what establishes the mentee relationship in the first place. */
function useRecordableStudents(): { students: Student[]; loading: boolean } {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const drivePrep = useMyDrivePrepAssignments(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const sorted = useMemo(() => {
    if (!mentees || !drivePrep) return [];
    const uids = new Set([...mentees.map((m) => m.studentId), ...drivePrep.map((a) => a.studentId)]);
    return Array.from(uids)
      .map((uid) => studentsByUid[uid])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, drivePrep, studentsByUid]);

  const loading = mentees === null || drivePrep === null || students === null;
  return { students: sorted, loading };
}

function StudentPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (uid: string) => void;
  disabled?: boolean;
}) {
  const { students: sorted, loading } = useRecordableStudents();

  return (
    <select required disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{loading ? "Loading…" : sorted.length === 0 ? "No mentees or drive-prep students yet" : "Select a student"}</option>
      {sorted.map((s) => (
        <option key={s.studentId} value={s.uid}>
          {s.rollNo} — {s.name}
        </option>
      ))}
    </select>
  );
}

function FollowUpForm({
  studentId,
  department,
  mentorId,
  onDone,
}: {
  studentId: string;
  department: Department;
  mentorId: string;
  onDone: () => void;
}) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<FollowUpCategory>("academics");
  const [parentContactMode, setParentContactMode] = useState<ParentContactMode>("call");
  const [note, setNote] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await recordFollowUp({
        studentId,
        department,
        mentorId,
        category,
        note: note.trim(),
        parentContactMode: category === "parent_communication" ? parentContactMode : undefined,
        nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate).getTime() : undefined,
      });
      showToast("Follow-up logged");
      setNote("");
      setNextMeetingDate("");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select value={category} onChange={(e) => setCategory(e.target.value as FollowUpCategory)} className={inputClass}>
          {FOLLOW_UP_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        {category === "parent_communication" && (
          <select
            value={parentContactMode}
            onChange={(e) => setParentContactMode(e.target.value as ParentContactMode)}
            className={inputClass}
          >
            {PARENT_CONTACT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>
      <textarea
        required
        placeholder={category === "parent_communication" ? "What was discussed with the parent?" : "Note"}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={inputClass}
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Next meeting date (optional)</label>
        <input
          type="date"
          value={nextMeetingDate}
          onChange={(e) => setNextMeetingDate(e.target.value)}
          className={`${inputClass} sm:w-48`}
        />
      </div>
      <Button type="submit" loading={submitting} className="!px-3 !py-1.5 text-xs">
        Log follow-up
      </Button>
    </form>
  );
}

function MenteeDetailPanel({
  studentId,
  department,
  mentorId,
  student,
}: {
  studentId: string;
  department: Department;
  mentorId: string;
  student: Student | undefined;
}) {
  const followUps = useMenteeFollowUps(studentId);
  const { showToast } = useToast();
  const nextMeetingFollowUp = getNextMeetingFollowUp(followUps);
  const nextMeeting = nextMeetingFollowUp?.nextMeetingDate ?? null;
  const sgpaTrend = student ? sortedSgpaEntries(student.semesterWiseSgpa) : [];

  async function handleClearNextMeeting() {
    if (!nextMeetingFollowUp) return;
    await clearNextMeetingDate(nextMeetingFollowUp.followUpId);
    showToast("Next meeting date cleared");
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
      {nextMeeting && (
        <div
          className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
            nextMeeting < Date.now() ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0" />
            {nextMeeting < Date.now() ? "Meeting overdue — was set for " : "Next meeting: "}
            {new Date(nextMeeting).toLocaleDateString()}
          </span>
          <button type="button" onClick={handleClearNextMeeting} className="shrink-0 text-xs font-medium underline">
            Clear
          </button>
        </div>
      )}

      {sgpaTrend.length >= 2 && (
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">SGPA trend</p>
          <TrendLineChart data={sgpaTrend} height={140} />
        </div>
      )}

      <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Trainings completed</p>
        {student && Object.keys(student.trainings ?? {}).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(student.trainings ?? {}).map(([name, label]) => (
              <Badge key={name} variant="success" title={label}>
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">None recorded yet.</p>
        )}
      </div>

      <FollowUpForm studentId={studentId} department={department} mentorId={mentorId} onDone={() => {}} />

      {followUps === null ? (
        <Skeleton className="h-16" />
      ) : followUps.length === 0 ? (
        <p className="text-sm text-slate-400">No follow-ups logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {followUps.map((f) => (
            <li key={f.followUpId} className="rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  {f.category === "parent_communication" && <Phone className="h-3.5 w-3.5 text-brand-600" />}
                  {CATEGORY_LABEL[f.category]}
                  {f.parentContactMode && <span className="text-xs font-normal text-slate-400">via {f.parentContactMode}</span>}
                </span>
                <span className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-600">{f.note}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MenteeRow({
  student,
  department,
  mappingId,
  mentorId,
  isOpen,
  onToggle,
}: {
  student: Student | undefined;
  department: Department;
  mappingId: string;
  mentorId: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const studentId = student?.uid ?? "";
  const followUps = useMenteeFollowUps(student ? studentId : undefined);
  const lastFollowUpAt = followUps && followUps.length > 0 ? Math.max(...followUps.map((f) => f.createdAt)) : null;
  const atRiskReasons = student ? computeAtRiskReasons(student, lastFollowUpAt) : [];

  return (
    <li key={mappingId} className="py-2.5">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {atRiskReasons.length > 0 && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          <span className="font-medium text-slate-800">{student ? `${student.rollNo} — ${student.name}` : studentId}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {student && (
            <>
              <span className="text-xs text-slate-500">CGPA {student.cgpa}</span>
              {atRiskReasons.map((reason) => (
                <Badge key={reason} variant="warning">
                  {reason}
                </Badge>
              ))}
              <Badge variant={PLACEMENT_STATUS_BADGE[student.placementStatus]}>
                {PLACEMENT_STATUS_LABEL[student.placementStatus]}
              </Badge>
            </>
          )}
          <span className="flex items-center gap-1 text-xs font-medium text-brand-700">
            <MessageCircleMore className="h-3.5 w-3.5" />
            {isOpen ? "Hide" : "Follow up"}
          </span>
        </span>
      </button>
      {isOpen && <MenteeDetailPanel studentId={studentId} department={department} mentorId={mentorId} student={student} />}
    </li>
  );
}

function MyMenteesSection() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  // A mentor with mentees across more than one batch year (same gap fixed
  // on Mock Interview Modules and Mentee Drive Status) — shown mixed
  // together with no way to narrow to just one.
  const batchYearOptions = useMemo(() => {
    if (!mentees) return [];
    return Array.from(new Set(mentees.map((m) => studentsByUid[m.studentId]?.batchYear).filter((y): y is number => y != null))).sort(
      (a, b) => a - b
    );
  }, [mentees, studentsByUid]);

  // Flat, sorted by roll number — used to group by "year of study" here,
  // but that label next to a batch filter just confused things (a batch
  // number and a year-of-study label look related but aren't the same
  // axis, especially for lateral-entry mentees).
  const filteredMentees = useMemo(() => {
    if (!mentees) return null;
    const filtered = batchFilter ? mentees.filter((m) => studentsByUid[m.studentId]?.batchYear === batchFilter) : mentees;
    return filtered
      .slice()
      .sort((a, b) => (studentsByUid[a.studentId]?.rollNo ?? "").localeCompare(studentsByUid[b.studentId]?.rollNo ?? ""));
  }, [mentees, studentsByUid, batchFilter]);

  // Coordinator/hod/dean/cpo/admin can see this section too (they're
  // eligible mentors via mentorMapping, same as faculty_mentor — small
  // colleges often have the coordinator double as one), but most of them
  // have zero mentees of their own, and an empty "My mentees" card is just
  // clutter on a page they're mainly using for other things. Same fix as
  // Mock Interview Modules' "Log today's evaluations": render nothing once
  // loaded if there's nothing to show, instead of an empty-state message.
  // Checked against the unfiltered list — a batch filter matching nothing
  // should show an empty state with the filter still visible, not hide the
  // whole card as if there were never any mentees at all.
  if (mentees !== null && mentees.length === 0) return null;

  return (
    <Card>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Users className="h-5 w-5 text-brand-600" />
          My mentees
        </h3>
        {batchYearOptions.length > 1 && (
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
            className={`${inputClass} sm:w-40`}
          >
            <option value="">All batches</option>
            {batchYearOptions.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Your assigned mentees — follow up on academics, placement, attendance, activities, and parent communication.
        The <AlertTriangle className="mb-0.5 inline h-3.5 w-3.5 text-amber-500" /> flag means backlogs, low/declining
        CGPA, or no follow-up in {STALE_FOLLOW_UP_DAYS}+ days.
      </p>

      {filteredMentees === null ? (
        <Skeleton className="h-24" />
      ) : filteredMentees.length === 0 ? (
        <p className="text-sm text-slate-400">No mentees in Batch {batchFilter}.</p>
      ) : firebaseUser ? (
        <ul className="divide-y divide-slate-100">
          {filteredMentees.map((m) => (
            <MenteeRow
              key={m.mappingId}
              mappingId={m.mappingId}
              student={studentsByUid[m.studentId]}
              department={m.department}
              mentorId={firebaseUser.uid}
              isOpen={expandedId === m.studentId}
              onToggle={() => setExpandedId((prev) => (prev === m.studentId ? null : m.studentId))}
            />
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function MentorPicker({ value, onChange }: { value: string; onChange: (uid: string) => void }) {
  const { appUser } = useAuth();
  const mentors = useMentorDirectory(appUser);
  const sorted = useMemo(
    () =>
      (mentors ?? [])
        .filter((m) => m.role === "faculty_mentor")
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [mentors]
  );
  return (
    <select required value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value="">{mentors === null ? "Loading…" : "Select a mentor"}</option>
      {sorted.map((m) => (
        <option key={m.uid} value={m.uid}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

function AssignMentorSection() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const mappings = useDeptScopedCollection<MentorMapping>(appUser, DB_NODES.mentorMapping, DB_NODES.mentorMappingDeptIndex);
  const mentors = useMentorDirectory(appUser);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [facultyId, setFacultyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rosterMentorFilter, setRosterMentorFilter] = useState("");
  const [assignBatchFilter, setAssignBatchFilter] = useState<number | "">("");
  const [rosterBatchFilter, setRosterBatchFilter] = useState<number | "">("");

  const batchYears = useMemo(
    () => Array.from(new Set((students ?? []).map((s) => s.batchYear))).sort((a, b) => a - b),
    [students]
  );

  const sortedStudents = useMemo(
    () =>
      (students ?? [])
        .filter((s) => !s.isAlumni)
        .filter((s) => !assignBatchFilter || s.batchYear === assignBatchFilter)
        .slice()
        .sort((a, b) => a.rollNo.localeCompare(b.rollNo)),
    [students, assignBatchFilter]
  );
  const allSelected = sortedStudents.length > 0 && selectedIds.size === sortedStudents.length;

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  // Who's currently assigned to whom, for both the pre-check below and the
  // roster table under the form.
  const menteesByMentor = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of mappings ?? []) {
      if (!map.has(m.facultyId)) map.set(m.facultyId, new Set());
      map.get(m.facultyId)!.add(m.studentId);
    }
    return map;
  }, [mappings]);

  const mentorsWithMentees = useMemo(
    () =>
      Array.from(menteesByMentor.keys())
        .map((uid) => ({ uid, name: mentorsByUid[uid]?.name ?? uid }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [menteesByMentor, mentorsByUid]
  );

  // Flat, one row per mentee — easier to scan and filter than the grouped
  // "mentor: comma-separated names" text it used to be.
  const rosterRows = useMemo(() => {
    const rows: { mentorUid: string; mentorName: string; student: Student }[] = [];
    for (const [mentorUid, menteeUids] of menteesByMentor.entries()) {
      if (rosterMentorFilter && mentorUid !== rosterMentorFilter) continue;
      const mentorName = mentorsByUid[mentorUid]?.name ?? mentorUid;
      for (const uid of menteeUids) {
        const student = studentsByUid[uid];
        if (!student) continue;
        if (rosterBatchFilter && student.batchYear !== rosterBatchFilter) continue;
        rows.push({ mentorUid, mentorName, student });
      }
    }
    return rows.sort((a, b) => a.mentorName.localeCompare(b.mentorName) || a.student.rollNo.localeCompare(b.student.rollNo));
  }, [menteesByMentor, mentorsByUid, studentsByUid, rosterMentorFilter, rosterBatchFilter]);

  function handleMentorChange(uid: string) {
    setFacultyId(uid);
    // Pre-check whoever's already assigned to this mentor, so the
    // coordinator can see their current roster at a glance and just add
    // more — handleSubmit filters these back out before writing, so
    // re-submitting an already-assigned student can't create a duplicate
    // mentorMapping record.
    setSelectedIds(new Set(menteesByMentor.get(uid) ?? []));
  }

  function toggleOne(uid: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(sortedStudents.map((s) => s.uid)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !facultyId) return;
    if (selectedIds.size === 0) return;
    const alreadyAssigned = menteesByMentor.get(facultyId) ?? new Set();
    const newStudentIds = Array.from(selectedIds).filter((uid) => !alreadyAssigned.has(uid));
    if (newStudentIds.length === 0) {
      showToast("Everyone selected is already assigned to this mentor");
      return;
    }
    // Each student's own department, not the actor's — a dept-scoped
    // coordinator/hod only ever sees their own department's students
    // anyway, but institution roles (admin/dean/cpo) have no department of
    // their own and can select students spanning several departments.
    const students = newStudentIds
      .map((uid) => ({ studentId: uid, department: studentsByUid[uid]?.department }))
      .filter((s): s is { studentId: string; department: Department } => !!s.department);
    setSubmitting(true);
    try {
      await assignMentorBulk({ facultyId, students });
      showToast(`Mentor assigned to ${students.length} student${students.length === 1 ? "" : "s"}`);
      setSelectedIds(new Set());
      setFacultyId("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">Assign mentor</h3>
      <p className="mb-4 text-sm text-slate-500">
        Select one or more students and assign them all to the same mentor in one go. Picking a mentor pre-checks
        their current mentees — check more to add them, nothing happens to anyone you leave checked.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <select
          value={assignBatchFilter}
          onChange={(e) => setAssignBatchFilter(e.target.value ? Number(e.target.value) : "")}
          className={`${inputClass} sm:w-48`}
        >
          <option value="">All batches</option>
          {batchYears.map((y) => (
            <option key={y} value={y}>
              Batch {y}
            </option>
          ))}
        </select>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          <label className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all ({sortedStudents.length})
          </label>
          {students === null ? (
            <div className="p-3">
              <Skeleton className="h-16" />
            </div>
          ) : sortedStudents.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">No students found.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {sortedStudents.map((s) => (
                <li key={s.studentId}>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={selectedIds.has(s.uid)} onChange={() => toggleOne(s.uid)} />
                    {s.rollNo} — {s.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <MentorPicker value={facultyId} onChange={handleMentorChange} />
          </div>
          <Button type="submit" loading={submitting} disabled={selectedIds.size === 0}>
            Assign to {selectedIds.size || ""} student{selectedIds.size === 1 ? "" : "s"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t border-slate-100 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current mentor assignments</h4>
          <div className="flex flex-wrap gap-2">
            <select
              value={rosterBatchFilter}
              onChange={(e) => setRosterBatchFilter(e.target.value ? Number(e.target.value) : "")}
              className={`${inputClass} sm:w-40`}
            >
              <option value="">All batches</option>
              {batchYears.map((y) => (
                <option key={y} value={y}>
                  Batch {y}
                </option>
              ))}
            </select>
            {mentorsWithMentees.length > 0 && (
              <select
                value={rosterMentorFilter}
                onChange={(e) => setRosterMentorFilter(e.target.value)}
                className={`${inputClass} sm:w-56`}
              >
                <option value="">All mentors</option>
                {mentorsWithMentees.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {mappings === null || mentors === null || students === null ? (
          <Skeleton className="h-16" />
        ) : menteesByMentor.size === 0 ? (
          <p className="text-sm text-slate-400">No mentor assignments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">CGPA</th>
                  <th className="py-2 pr-4">Backlogs</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rosterRows.map(({ mentorUid, mentorName, student }) => (
                  <tr key={`${mentorUid}_${student.studentId}`}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{mentorName}</td>
                    <td className="py-2 pr-4 text-slate-600">{student.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{student.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{student.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{student.cgpa}</td>
                    <td className="py-2 pr-4 text-slate-600">{student.activeBacklogs}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={PLACEMENT_STATUS_BADGE[student.placementStatus]}>
                        {PLACEMENT_STATUS_LABEL[student.placementStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {rosterRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                      No assignments match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

export interface MockInterviewPrefill {
  studentId: string;
  driveId: string;
  companyName: string;
}

function MockInterviewSection({
  prefill,
  onConsumedPrefill,
}: {
  prefill: MockInterviewPrefill | null;
  onConsumedPrefill: () => void;
}) {
  const { appUser, firebaseUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const { students: recordable, loading: recordableLoading } = useRecordableStudents();
  const { showToast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [driveId, setDriveId] = useState<string | undefined>(undefined);
  const [driveLabel, setDriveLabel] = useState<string | undefined>(undefined);
  const [type, setType] = useState<MockInterviewType>("technical");
  const [communication, setCommunication] = useState(5);
  const [technical, setTechnical] = useState(5);
  const [confidence, setConfidence] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pastRecords = useIndexedList<MockInterview>(studentId || undefined, DB_NODES.mockInterviews);

  useEffect(() => {
    if (!prefill) return;
    setStudentId(prefill.studentId);
    setDriveId(prefill.driveId);
    setDriveLabel(prefill.companyName);
  }, [prefill]);

  // Same "hide when empty" treatment as My Mentees/My Drive Prep — nothing
  // to record for means this form can't actually be used. Safe alongside
  // the drive-prep prefill flow: that only ever fires from My Drive Prep,
  // which is itself hidden whenever this would also be empty.
  if (!recordableLoading && recordable.length === 0 && !prefill) return null;

  function clearDrivePrep() {
    setDriveId(undefined);
    setDriveLabel(undefined);
    onConsumedPrefill();
  }

  function startEdit(record: MockInterview) {
    setEditingId(record.interviewId);
    setType(record.type);
    setCommunication(record.scores.communication);
    setTechnical(record.scores.technical);
    setConfidence(record.scores.confidence);
    setFeedback(record.feedback);
  }

  function cancelEdit() {
    setEditingId(null);
    setType("technical");
    setCommunication(5);
    setTechnical(5);
    setConfidence(5);
    setFeedback("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const department = students?.find((s) => s.uid === studentId)?.department;
    if (!firebaseUser || !department) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateMockInterview(editingId, { type, communication, technical, confidence, feedback });
        showToast("Mock interview updated");
        cancelEdit();
      } else {
        await recordMockInterview({ studentId, department, mentorId: firebaseUser.uid, type, communication, technical, confidence, feedback, driveId });
        showToast("Mock interview recorded");
        setStudentId("");
        setFeedback("");
        clearDrivePrep();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card id="mock-interview-section">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Record mock interview</h3>
      {driveId && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
          <span>Logging drive prep for {driveLabel ?? "this drive"}</span>
          <button type="button" onClick={clearDrivePrep} className="text-xs font-medium underline">
            Clear
          </button>
        </div>
      )}
      {editingId && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Editing a previously logged interview</span>
          <button type="button" onClick={cancelEdit} className="text-xs font-medium underline">
            Cancel
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StudentPicker value={studentId} onChange={setStudentId} disabled={!!editingId} />
          <select value={type} onChange={(e) => setType(e.target.value as MockInterviewType)} className={inputClass}>
            {MOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Communication /10</label>
            <input type="number" min={0} max={10} value={communication} onChange={(e) => setCommunication(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Technical /10</label>
            <input type="number" min={0} max={10} value={technical} onChange={(e) => setTechnical(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Confidence /10</label>
            <input type="number" min={0} max={10} value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} className={inputClass} />
          </div>
        </div>
        <textarea placeholder="Feedback" rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <Button type="submit" loading={submitting}>
            {editingId ? "Update" : "Save"}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {studentId && pastRecords && pastRecords.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Past interviews for this student
          </p>
          <ul className="space-y-1.5">
            {pastRecords
              .slice()
              .sort((a, b) => b.date - a.date)
              .map((r) => (
                <li key={r.interviewId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="capitalize text-slate-700">
                    {r.type.replace("_", " ")} — {new Date(r.date).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ResumeReviewSection() {
  const { appUser, firebaseUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const { students: recordable, loading: recordableLoading } = useRecordableStudents();
  const { showToast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [version, setVersion] = useState(1);
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState<"not_reviewed" | "needs_revision" | "approved">("needs_revision");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pastRecords = useIndexedList<ResumeReview>(studentId || undefined, DB_NODES.resumeReviews);

  if (!recordableLoading && recordable.length === 0) return null;

  function startEdit(record: ResumeReview) {
    setEditingId(record.reviewId);
    setVersion(record.version);
    setFileUrl(record.fileUrl);
    setStatus(record.status);
    setComment(record.comments[record.comments.length - 1] ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setVersion(1);
    setFileUrl("");
    setStatus("needs_revision");
    setComment("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const department = students?.find((s) => s.uid === studentId)?.department;
    if (!firebaseUser || !department) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateResumeReview(editingId, { version, fileUrl, status, comment });
        showToast("Resume review updated");
        cancelEdit();
      } else {
        await recordResumeReview({ studentId, department, mentorId: firebaseUser.uid, version, fileUrl, status, comment });
        showToast("Resume review recorded");
        setStudentId("");
        setFileUrl("");
        setComment("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 text-base font-semibold text-slate-900">Record resume review</h3>
      {editingId && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Editing a previously logged review</span>
          <button type="button" onClick={cancelEdit} className="text-xs font-medium underline">
            Cancel
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StudentPicker value={studentId} onChange={setStudentId} disabled={!!editingId} />
          <input type="number" min={1} placeholder="Version" value={version} onChange={(e) => setVersion(Number(e.target.value))} className={inputClass} />
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
            <option value="not_reviewed">Not reviewed</option>
            <option value="needs_revision">Needs revision</option>
            <option value="approved">Approved</option>
          </select>
        </div>
        <input type="url" placeholder="Resume file link" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={inputClass} />
        <textarea placeholder="Comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <Button type="submit" loading={submitting}>
            {editingId ? "Update" : "Save"}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {studentId && pastRecords && pastRecords.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Past reviews for this student</p>
          <ul className="space-y-1.5">
            {pastRecords
              .slice()
              .sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0))
              .map((r) => (
                <li key={r.reviewId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="text-slate-700">
                    v{r.version} — {r.status.replace("_", " ")}
                    {r.reviewedAt ? ` — ${new Date(r.reviewedAt).toLocaleDateString()}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SkillAssessmentSection() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const { students: recordable, loading: recordableLoading } = useRecordableStudents();
  const { showToast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<"technical" | "soft_skill" | "certification">("technical");
  const [source, setSource] = useState<"manual" | "hackerrank" | "codechef" | "other">("manual");
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pastRecords = useIndexedList<SkillAssessment>(studentId || undefined, DB_NODES.skillAssessments);

  if (!recordableLoading && recordable.length === 0) return null;

  function startEdit(record: SkillAssessment) {
    setEditingId(record.assessmentId);
    setType(record.type);
    setSource(record.source);
    setScore(record.score);
    setNotes(record.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setType("technical");
    setSource("manual");
    setScore(0);
    setNotes("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const department = students?.find((s) => s.uid === studentId)?.department;
    if (!department) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await updateSkillAssessment(editingId, { type, source, score, notes });
        showToast("Skill assessment updated");
        cancelEdit();
      } else {
        await recordSkillAssessment({ studentId, department, type, source, score, notes });
        showToast("Skill assessment recorded");
        setStudentId("");
        setNotes("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-4 text-base font-semibold text-slate-900">Record skill assessment</h3>
      {editingId && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Editing a previously logged assessment</span>
          <button type="button" onClick={cancelEdit} className="text-xs font-medium underline">
            Cancel
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StudentPicker value={studentId} onChange={setStudentId} disabled={!!editingId} />
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
            <option value="technical">Technical</option>
            <option value="soft_skill">Soft skill</option>
            <option value="certification">Certification</option>
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={inputClass}>
            <option value="manual">Manual</option>
            <option value="hackerrank">HackerRank</option>
            <option value="codechef">CodeChef</option>
            <option value="other">Other</option>
          </select>
          <input type="number" min={0} max={100} placeholder="Score /100" value={score} onChange={(e) => setScore(Number(e.target.value))} className={inputClass} />
        </div>
        <input type="text" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        <div className="flex gap-2">
          <Button type="submit" loading={submitting}>
            {editingId ? "Update" : "Save"}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </form>

      {studentId && pastRecords && pastRecords.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Past assessments for this student</p>
          <ul className="space-y-1.5">
            {pastRecords
              .slice()
              .sort((a, b) => b.date - a.date)
              .map((r) => (
                <li key={r.assessmentId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="capitalize text-slate-700">
                    {r.type.replace("_", " ")} — {r.score}/100 — {new Date(r.date).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function MyDrivePrepSection({ onLogMockInterview }: { onLogMockInterview: (prefill: MockInterviewPrefill) => void }) {
  const { firebaseUser, appUser } = useAuth();
  const assignments = useMyDrivePrepAssignments(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const drives = useDrivesById();
  const mockInterviews = useAllMockInterviews(appUser);
  const mockEvaluations = useMockEvaluations(appUser);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  // MockEvaluation (Mock Interview Modules, e.g. "Infosys Mock") has no
  // driveId — a module isn't tied to a specific Drive record the way the
  // older one-off MockInterview is, so an exact per-drive match isn't
  // possible. Any evaluation at all is treated as evidence of readiness,
  // same tier as an old-style driveId match below.
  const evaluatedStudentIds = useMemo(() => new Set((mockEvaluations ?? []).map((e) => e.studentId)), [mockEvaluations]);

  if (!assignments) return null;
  // Same "hide when empty" treatment as My Mentees / Log today's evaluations
  // — most coordinators never get assigned drive prep themselves, so an
  // empty card here is just noise.
  if (assignments.length === 0) return null;

  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-slate-900">My drive prep</h3>
      <p className="mb-4 text-sm text-slate-500">
        Students your coordinator has assigned to you ahead of an upcoming drive.
      </p>

      <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Drive</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a) => {
                const student = studentsByUid[a.studentId];
                const drive = drives?.[a.driveId];
                const ready =
                  !!mockInterviews?.some((mi) => mi.studentId === a.studentId && mi.driveId === a.driveId) ||
                  evaluatedStudentIds.has(a.studentId);
                return (
                  <tr key={a.assignmentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">
                      {student ? `${student.rollNo} — ${student.name}` : a.studentId}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{drive?.companyName ?? a.driveId}</td>
                    <td className="py-2 pr-4">
                      {ready ? <Badge variant="success">Ready</Badge> : <Badge variant="warning">Pending prep</Badge>}
                    </td>
                    <td className="py-2 pr-4">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          onLogMockInterview({ studentId: a.studentId, driveId: a.driveId, companyName: drive?.companyName ?? a.driveId })
                        }
                      >
                        Log mock interview
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
      </div>
    </Card>
  );
}

/** Coordinator/hod can create a faculty_mentor account directly here instead
 * of going through Manage Staff (admin-only, and doesn't have this
 * Designation field) — see the database.rules.json comment on users/$uid
 * for the scoped creation rule this relies on: role must be exactly
 * 'faculty_mentor' and department must match the creator's own, so this
 * can't be used to mint a coordinator/hod/admin account. Admin can also use
 * this as a quicker path than Manage Staff for a mentor-only account, with
 * a free department choice since admin isn't tied to one. */
function AddMentorForm() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const myDept = appUser && "department" in appUser ? appUser.department : undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState<FacultyDesignation>("assistant_professor");
  const [department, setDepartment] = useState<Department>(myDept ?? "CSE");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await createStaffAccount({
        email: email.trim(),
        password: password.trim(),
        name: name.trim(),
        role: "faculty_mentor",
        department: myDept ?? department,
        designation,
      });
      showToast(`${name.trim()} added as a mentor`);
      setName("");
      setEmail("");
      setPassword("");
      setDesignation("assistant_professor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create mentor account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
        <UserPlus className="h-5 w-5 text-brand-600" />
        Add mentor
      </h3>
      <p className="mb-4 text-sm text-slate-500">Create a new faculty mentor account for your department.</p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Designation</label>
          <select value={designation} onChange={(e) => setDesignation(e.target.value as FacultyDesignation)} className={inputClass}>
            {DESIGNATIONS.map((d) => (
              <option key={d} value={d}>
                {DESIGNATION_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Department</label>
          {myDept ? (
            <input type="text" disabled value={myDept} className={`${inputClass} bg-slate-50 text-slate-500`} />
          ) : (
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={inputClass}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Temporary password</label>
          <input
            type="text"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

        <div className="sm:col-span-2">
          <Button type="submit" loading={submitting}>
            Add mentor
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface MentorImportOutcome {
  row: ParsedMentorRow;
  result: "created" | "failed";
  message?: string;
}

/** Same paste-and-review pattern as Bulk Import Students, but no Department
 * column in the sheet — one batch always creates into one department,
 * picked once here rather than per row (see the doc comment on
 * parseMentorRows in staffAuthActions.ts for why: coordinator/hod can only
 * ever create mentors in their own department per the scoped rule anyway). */
function ImportMentorsForm() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const myDept = appUser && "department" in appUser ? appUser.department : undefined;

  const [expanded, setExpanded] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [department, setDepartment] = useState<Department>(myDept ?? "CSE");
  const [parsed, setParsed] = useState<ParsedMentorRow[] | null>(null);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<MentorImportOutcome[] | null>(null);

  const importableRows = (parsed ?? []).filter((r) => r.errors.length === 0);

  function handleParse() {
    const { headers, rows } = parseDelimited(pasteText);
    if (headers.length === 0) {
      showToast("Paste some data first");
      return;
    }
    const { rows: parsedRows, unmappedHeaders: unmapped } = parseMentorRows(headers, rows);
    setParsed(parsedRows);
    setUnmappedHeaders(unmapped);
    setOutcomes(null);
  }

  async function handleImport() {
    if (importableRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    const results: MentorImportOutcome[] = [];
    for (const row of importableRows) {
      try {
        await createStaffAccount({
          email: row.email,
          password: row.password,
          name: row.name,
          role: "faculty_mentor",
          department: myDept ?? department,
          designation: row.designation,
        });
        results.push({ row, result: "created" });
      } catch (err) {
        results.push({ row, result: "failed", message: err instanceof Error ? err.message : "Unknown error" });
      }
      setProgress((p) => p + 1);
    }
    setOutcomes(results);
    setImporting(false);
    const createdCount = results.filter((r) => r.result === "created").length;
    showToast(`${createdCount} of ${importableRows.length} mentor(s) created`);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        <Upload className="h-4 w-4" />
        Import mentors from a sheet
      </button>
    );
  }

  return (
    <Card>
      <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
        <Upload className="h-5 w-5 text-brand-600" />
        Import mentors
      </h3>
      <p className="mb-3 text-sm text-slate-500">
        Paste rows with Name, Email, Designation, and Password columns — works with a tab-separated Excel/Sheets
        paste or a comma-separated CSV. Designation defaults to Assistant Professor if left blank or unrecognized.
      </p>

      {!myDept && (
        <div className="mb-3">
          <label className={labelClass}>Department (applies to this whole batch)</label>
          <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={`${inputClass} sm:w-56`}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        rows={6}
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        placeholder={"Name\tEmail\tDesignation\tPassword"}
        className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-3 flex gap-2">
        <Button onClick={handleParse}>Parse</Button>
        <Button variant="secondary" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>

      {parsed !== null && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Review ({parsed.length} row(s))</h4>

          {unmappedHeaders.length > 0 && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Columns not recognized, ignored: {unmappedHeaders.join(", ")}
            </p>
          )}
          <p className="mb-3 text-xs text-slate-500">
            {importableRows.length} of {parsed.length} row(s) will be imported, into{" "}
            {myDept ?? department}.
          </p>

          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Name</th>
                  <th className="py-1.5 pr-3">Email</th>
                  <th className="py-1.5 pr-3">Designation</th>
                  <th className="py-1.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.map((row) => {
                  const outcome = outcomes?.find((o) => o.row.rowIndex === row.rowIndex);
                  return (
                    <tr key={row.rowIndex}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{row.name || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.email || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{DESIGNATION_LABEL[row.designation]}</td>
                      <td className="py-1.5 pr-3">
                        {outcome ? (
                          outcome.result === "created" ? (
                            <Badge variant="success">Created</Badge>
                          ) : (
                            <Badge variant="danger">{outcome.message ?? "Failed"}</Badge>
                          )
                        ) : row.errors.length > 0 ? (
                          <Badge variant="danger">{row.errors.join("; ")}</Badge>
                        ) : row.warnings.length > 0 ? (
                          <Badge variant="warning">{row.warnings.join("; ")}</Badge>
                        ) : (
                          <Badge variant="success">Ready</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button className="mt-4" onClick={handleImport} loading={importing} disabled={importableRows.length === 0}>
            Import {importableRows.length} mentor(s)
          </Button>
          {importing && (
            <p className="mt-2 text-xs text-slate-500">
              {progress} of {importableRows.length} done…
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function MentorTools() {
  const { appUser } = useAuth();
  const canRecordMentorFeedback =
    appUser && ["faculty_mentor", "coordinator", "hod", "dean", "cpo", "admin"].includes(appUser.role);
  const canAssignMentor = appUser && ["coordinator", "hod", "dean", "cpo", "admin"].includes(appUser.role);
  // Matches exactly who the database.rules.json creation rule actually
  // permits — coordinator/hod (scoped to their own department) plus admin
  // (unconditional). dean/cpo/principal aren't in the rule, so they don't
  // get the form even though they can assign mentors.
  const canCreateMentor = appUser && ["coordinator", "hod", "admin"].includes(appUser.role);
  const [mockInterviewPrefill, setMockInterviewPrefill] = useState<MockInterviewPrefill | null>(null);

  function handleLogMockInterview(prefill: MockInterviewPrefill) {
    setMockInterviewPrefill(prefill);
    document.getElementById("mock-interview-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // faculty_mentor always has the mentee-focused sections below — that's
  // their whole page. canAssignMentor roles (coordinator/hod/dean/cpo/admin)
  // only get those too if they personally happen to have mentees or drive
  // prep of their own (both sections hide themselves when empty) — for most
  // of them this page is just Assign Mentor + the roster table, so the
  // subtitle shouldn't describe sections that usually aren't there.
  const subtitle =
    appUser?.role === "faculty_mentor"
      ? "Follow up with your mentees, and record mock interviews, resume reviews, and skill assessments."
      : "Assign mentors to your department's students, and see who's currently assigned to whom.";

  return (
    <div className="space-y-6">
      <PageHeader title="Mentor Tools" subtitle={subtitle} icon={GraduationCap} gradient="from-pink-500 to-rose-600" />

      {canCreateMentor && <AddMentorForm />}
      {canCreateMentor && <ImportMentorsForm />}
      {canRecordMentorFeedback && <MyMenteesSection />}
      {canAssignMentor && <AssignMentorSection />}
      {canRecordMentorFeedback && (
        <>
          <MyDrivePrepSection onLogMockInterview={handleLogMockInterview} />
          <MockInterviewSection prefill={mockInterviewPrefill} onConsumedPrefill={() => setMockInterviewPrefill(null)} />
          <ResumeReviewSection />
          <SkillAssessmentSection />
        </>
      )}
    </div>
  );
}
