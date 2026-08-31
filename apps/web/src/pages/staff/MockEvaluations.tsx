import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ClipboardCheck, Download, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { ApplicationStatus, Department, Drive, MentorMapping, MockEvalRating, MockInterviewModule, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../lib/menteeFollowUpLib";
import { useAllApplications } from "../../lib/applicantsLib";
import { useMentorDirectory } from "../../lib/drivePrepLib";
import { useDeptScopedCollection } from "../../lib/useDeptScopedCollection";
import {
  useMockModules,
  useMockEvaluations,
  createMockModule,
  updateMockModule,
  deleteMockModule,
  recordMockEvaluation,
  startOfDay,
  RATING_OPTIONS,
  RATING_LABEL,
  RATING_SCORE,
  EVAL_CATEGORIES,
} from "../../lib/mockEvaluationLib";
import type { EvalRatingFields } from "../../lib/mockEvaluationLib";
import { downloadCsv } from "../../lib/csv";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { TrendLineChart } from "../../components/charts/TrendLineChart";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];
const CAN_CREATE_MODULE_ROLES = ["coordinator", "hod", "dean", "cpo", "admin"];
const CAN_LOG_EVAL_ROLES = ["faculty_mentor", "coordinator", "hod", "dean", "cpo", "admin"];

// "Advanced" in the linked drive's process — cleared at least the first
// round, not just applied. This is what a module linked to a drive filters
// mentees down to.
const ADVANCED_STATUSES: ApplicationStatus[] = ["shortlisted", "in_round", "selected"];

const RATING_BADGE: Record<MockEvalRating, BadgeVariant> = {
  excellent: "success",
  very_good: "success",
  good: "brand",
  average: "warning",
  need_to_improve: "warning",
  poor: "danger",
  absent: "neutral",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

// Local date components, not toISOString() — see the matching comment on
// dateKey in mockEvaluationLib.ts. Using UTC here made this default to
// yesterday's date all day, every day, for any timezone ahead of UTC.
function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function CreateModuleSection({ onCreated }: { onCreated: () => void }) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const myDept = appUser && "department" in appUser ? appUser.department : undefined;

  const [name, setName] = useState("");
  const [department, setDepartment] = useState<Department>(myDept ?? "CSE");
  const [startDate, setStartDate] = useState(toDateInputValue(Date.now()));
  const [endDate, setEndDate] = useState(toDateInputValue(Date.now()));
  const [driveId, setDriveId] = useState("");
  const [drives, setDrives] = useState<Drive[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  const sortedDrives = useMemo(() => drives.slice().sort((a, b) => b.driveDate - a.driveDate), [drives]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    setError(null);
    if (!name.trim()) {
      setError("Give the module a name.");
      return;
    }
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      setError("Start date must be on or before the end date.");
      return;
    }
    setSubmitting(true);
    try {
      await createMockModule({
        name: name.trim(),
        department: myDept ?? department,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        driveId: driveId || undefined,
        createdBy: appUser.uid,
      });
      showToast("Module created");
      setName("");
      setDriveId("");
      onCreated();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <h3 className="mb-1 text-base font-semibold text-slate-900">Create mock interview module</h3>
      <p className="mb-4 text-sm text-slate-500">
        A dated drive (e.g. "Infosys Mock") mentors log daily per-mentee evaluations against.
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Module name</label>
          <input type="text" placeholder="Infosys Mock" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        {!myDept && (
          <div>
            <label className={labelClass}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={inputClass}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className={labelClass}>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Link to drive (optional)</label>
          <select value={driveId} onChange={(e) => setDriveId(e.target.value)} className={inputClass}>
            <option value="">Not linked — show every mentee</option>
            {sortedDrives.map((d) => (
              <option key={d.driveId} value={d.driveId}>
                {d.companyName} — {new Date(d.driveDate).toLocaleDateString()}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            When linked, mentors only see mentees who've cleared at least the first round of this drive — not the whole roster.
          </p>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        <div className="sm:col-span-4">
          <Button type="submit" loading={submitting}>
            Create module
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EvaluationForm({
  studentId,
  department,
  moduleId,
  moduleStart,
  moduleEnd,
  existing,
  mentorId,
  onSaved,
}: {
  studentId: string;
  department: Department;
  moduleId: string;
  moduleStart: number;
  moduleEnd: number;
  existing: (EvalRatingFields & { date: number; notes?: string }) | undefined;
  mentorId: string;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const today = startOfDay(Date.now());
  const maxDate = Math.min(today, moduleEnd);

  const [date, setDate] = useState(toDateInputValue(existing?.date ?? today));
  const [ratings, setRatings] = useState<EvalRatingFields>(
    existing ?? {
      selfIntroduction: "good",
      projectExplanation: "good",
      technicalOopJava: "good",
      technicalCnOs: "good",
      technicalDbmsSql: "good",
      communication: "good",
      hr: "good",
      selfConfidence: "good",
      overallPerformance: "good",
    }
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  function setRating(key: keyof EvalRatingFields, value: MockEvalRating) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await recordMockEvaluation({
        moduleId,
        studentId,
        department,
        mentorId,
        date: new Date(date).getTime(),
        notes: notes.trim() || undefined,
        ...ratings,
      });
      showToast("Evaluation saved");
      onSaved();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-slate-50 p-3">
      <div>
        <label className={labelClass}>Date</label>
        <input
          type="date"
          value={date}
          min={toDateInputValue(moduleStart)}
          max={toDateInputValue(maxDate)}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputClass} sm:w-48`}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EVAL_CATEGORIES.map(({ key, label }) => (
          <div key={key}>
            <label className={labelClass}>{label}</label>
            <select value={ratings[key]} onChange={(e) => setRating(key, e.target.value as MockEvalRating)} className={inputClass}>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {RATING_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
      <Button type="submit" loading={submitting} className="!px-3 !py-1.5 text-xs">
        {existing ? "Update evaluation" : "Save evaluation"}
      </Button>
    </form>
  );
}

function MenteeEvalRow({
  student,
  moduleId,
  moduleStart,
  moduleEnd,
  evaluations,
  mentorId,
}: {
  student: Student;
  moduleId: string;
  moduleStart: number;
  moduleEnd: number;
  evaluations: (EvalRatingFields & { date: number; notes?: string })[];
  mentorId: string;
}) {
  const [open, setOpen] = useState(false);
  const today = startOfDay(Date.now());
  const todayEntry = evaluations.find((e) => e.date === today);
  const daysLogged = evaluations.length;

  return (
    <li className="py-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm">
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          <span className="font-medium text-slate-800">
            {student.rollNo} — {student.name}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{daysLogged} day(s) logged</span>
          {todayEntry ? (
            <Badge variant={RATING_BADGE[todayEntry.overallPerformance]}>Today: {RATING_LABEL[todayEntry.overallPerformance]}</Badge>
          ) : (
            <Badge variant="neutral">Not logged today</Badge>
          )}
        </span>
      </button>
      {open && (
        <div className="mt-2">
          <EvaluationForm
            studentId={student.uid}
            department={student.department}
            moduleId={moduleId}
            moduleStart={moduleStart}
            moduleEnd={moduleEnd}
            existing={todayEntry}
            mentorId={mentorId}
            onSaved={() => setOpen(false)}
          />
        </div>
      )}
    </li>
  );
}

function EditModuleForm({
  module,
  onDone,
  onCancel,
}: {
  module: MockInterviewModule;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState(module.name);
  const [startDate, setStartDate] = useState(toDateInputValue(module.startDate));
  const [endDate, setEndDate] = useState(toDateInputValue(module.endDate));
  const [driveId, setDriveId] = useState(module.driveId ?? "");
  const [drives, setDrives] = useState<Drive[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  const sortedDrives = useMemo(() => drives.slice().sort((a, b) => b.driveDate - a.driveDate), [drives]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the module a name.");
      return;
    }
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      setError("Start date must be on or before the end date.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateMockModule(module.moduleId, {
        name: name.trim(),
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        driveId: driveId || undefined,
      });
      showToast("Module updated");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Edit module</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Module name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Link to drive (optional)</label>
          <select value={driveId} onChange={(e) => setDriveId(e.target.value)} className={inputClass}>
            <option value="">Not linked — show every mentee</option>
            {sortedDrives.map((d) => (
              <option key={d.driveId} value={d.driveId}>
                {d.companyName} — {new Date(d.driveDate).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        <div className="flex gap-2 sm:col-span-4">
          <Button type="submit" loading={submitting}>
            Save changes
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DeleteModuleConfirm({
  module,
  onDone,
  onCancel,
}: {
  module: MockInterviewModule;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const evaluations = useMockEvaluations(appUser);
  const [deleting, setDeleting] = useState(false);

  const moduleEvals = useMemo(() => (evaluations ?? []).filter((e) => e.moduleId === module.moduleId), [evaluations, module.moduleId]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMockModule(module.moduleId, module.department, moduleEvals);
      showToast("Module deleted");
      onDone();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete module");
      setDeleting(false);
    }
  }

  return (
    <Card className="mb-4 border border-red-200 bg-red-50">
      <p className="text-sm text-red-800">
        Delete "{module.name}"? This also removes all {moduleEvals.length} evaluation{moduleEvals.length === 1 ? "" : "s"} logged
        against it — this can't be undone.
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" onClick={handleDelete} loading={deleting}>
          Delete module
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={deleting}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function LogEvaluationsSection({
  moduleId,
  moduleStart,
  moduleEnd,
  driveId,
  driveName,
}: {
  moduleId: string;
  moduleStart: number;
  moduleEnd: number;
  driveId?: string;
  driveName?: string;
}) {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const evaluations = useMockEvaluations(appUser);
  const applications = useAllApplications(appUser);
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  // Cleared at least the first round of the linked drive — see
  // ADVANCED_STATUSES. Only meaningful once applications have loaded; while
  // they're still null, don't filter anything out yet (avoids a flash of
  // "no mentees" before the data that would actually include them arrives).
  const advancedIds = useMemo(() => {
    if (!driveId || !applications) return null;
    return new Set(
      applications.filter((a) => a.driveId === driveId && ADVANCED_STATUSES.includes(a.status)).map((a) => a.studentId)
    );
  }, [driveId, applications]);

  const evalsByStudent = useMemo(() => {
    const map: Record<string, (EvalRatingFields & { date: number; notes?: string })[]> = {};
    for (const e of evaluations ?? []) {
      if (e.moduleId !== moduleId) continue;
      map[e.studentId] ??= [];
      map[e.studentId].push(e);
    }
    return map;
  }, [evaluations, moduleId]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  // A mentor can carry mentees from more than one batch year (e.g. a
  // lateral-entry mentee alongside a regular one) — every mentee showed up
  // together with no way to narrow to just one batch.
  const batchYearOptions = useMemo(
    () => Array.from(new Set(menteeStudents.map((s) => s.batchYear))).sort((a, b) => a - b),
    [menteeStudents]
  );

  // Narrowed to mentees who cleared at least the first round of the linked
  // drive, when one's linked — see advancedIds above — and to the selected
  // batch, when one's picked. Kept separate from menteeStudents so the "you
  // have no mentees at all" case (below) stays distinct from "you have
  // mentees, none match the current filters".
  const filteredMenteeStudents = useMemo(() => {
    let result = menteeStudents;
    if (driveId && advancedIds) result = result.filter((s) => advancedIds.has(s.uid));
    if (batchFilter) result = result.filter((s) => s.batchYear === batchFilter);
    return result;
  }, [menteeStudents, driveId, advancedIds, batchFilter]);

  if (!firebaseUser) return null;
  // Coordinator/hod/dean/cpo/admin can technically log evaluations too (same
  // tier as mockInterviews — small colleges often have the coordinator
  // double as a trainer), but most of them have no mentees of their own and
  // this section has nothing useful to say to them. Only faculty_mentor (or
  // anyone who does happen to have mentees assigned) sees it; render
  // nothing rather than an empty "no mentees" card for everyone else.
  if (mentees !== null && students !== null && menteeStudents.length === 0) return null;

  const stillLoading = mentees === null || students === null || (!!driveId && advancedIds === null);

  return (
    <Card className="mb-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Log today's evaluations</h3>
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
      <p className="mb-3 text-sm text-slate-500">
        {driveId
          ? `Mentees who've cleared at least the first round of ${driveName ?? "the linked drive"} — click one to log or update an evaluation.`
          : "Your mentees — click one to log or update an evaluation."}
      </p>
      {stillLoading ? (
        <Skeleton className="h-24" />
      ) : filteredMenteeStudents.length === 0 ? (
        <p className="text-sm text-slate-400">
          {driveId && batchFilter
            ? `None of your Batch ${batchFilter} mentees have advanced in ${driveName ?? "this drive"} yet.`
            : driveId
              ? `None of your mentees have advanced in ${driveName ?? "this drive"} yet.`
              : `No mentees in Batch ${batchFilter}.`}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredMenteeStudents.map((s) => (
            <MenteeEvalRow
              key={s.studentId}
              student={s}
              moduleId={moduleId}
              moduleStart={moduleStart}
              moduleEnd={moduleEnd}
              evaluations={evalsByStudent[s.uid] ?? []}
              mentorId={firebaseUser.uid}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function StudentProgressPanel({
  student,
  evaluations,
}: {
  student: Student | undefined;
  evaluations: (EvalRatingFields & { date: number })[];
}) {
  const sorted = useMemo(() => evaluations.slice().sort((a, b) => a.date - b.date), [evaluations]);

  const trendData = useMemo(() => {
    return sorted
      .map((e) => ({ key: String(e.date), label: formatDay(e.date), value: RATING_SCORE[e.overallPerformance] }))
      .filter((p): p is { key: string; label: string; value: number } => p.value !== null);
  }, [sorted]);

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
      {trendData.length >= 2 && (
        <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Overall performance trend</p>
          <TrendLineChart data={trendData} height={140} />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pl-3 pr-3">Date</th>
              {EVAL_CATEGORIES.map((c) => (
                <th key={c.key} className="py-1.5 pr-3">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((e) => (
              <tr key={e.date}>
                <td className="py-1.5 pl-3 pr-3 font-medium text-slate-700">{formatDay(e.date)}</td>
                {EVAL_CATEGORIES.map((c) => (
                  <td key={c.key} className="py-1.5 pr-3">
                    <Badge variant={RATING_BADGE[e[c.key]]}>{RATING_LABEL[e[c.key]]}</Badge>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {student?.email && <p className="text-xs text-slate-400">{student.rollNo} · {student.email}</p>}
    </div>
  );
}

function ConsolidationSection({
  moduleId,
  moduleName,
  driveId,
  driveName,
}: {
  moduleId: string;
  moduleName: string;
  driveId?: string;
  driveName?: string;
}) {
  const { appUser, firebaseUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const evaluations = useMockEvaluations(appUser);
  const mentors = useMentorDirectory(appUser);
  const applications = useAllApplications(appUser);
  const mentorMappings = useDeptScopedCollection<MentorMapping>(appUser, DB_NODES.mentorMapping, DB_NODES.mentorMappingDeptIndex);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<number | "">("");
  const [mentorFilter, setMentorFilter] = useState("");

  // This section doubles as a coordinator/hod compliance tool (mentor
  // filter, "hasn't logged" callout across the whole department) — a
  // faculty_mentor viewing the same page must never see that: it would leak
  // every other mentor's mentees and logging status to a peer. So for
  // faculty_mentor, evaluations are hard-filtered to their own mentorId
  // before anything else runs, and the cross-mentor UI is hidden below.
  const isMentorScoped = appUser?.role === "faculty_mentor";
  const myUid = firebaseUser?.uid;

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const mentorsByUid = useMemo(() => Object.fromEntries((mentors ?? []).map((m) => [m.uid, m])), [mentors]);

  const moduleEvals = useMemo(() => {
    const all = (evaluations ?? []).filter((e) => e.moduleId === moduleId);
    return isMentorScoped ? all.filter((e) => e.mentorId === myUid) : all;
  }, [evaluations, moduleId, isMentorScoped, myUid]);

  // Cleared at least the first round of the linked drive — same as
  // LogEvaluationsSection's advancedIds, computed independently here since
  // this section covers the whole department, not just one mentor.
  const advancedIds = useMemo(() => {
    if (!driveId || !applications) return null;
    return new Set(
      applications.filter((a) => a.driveId === driveId && ADVANCED_STATUSES.includes(a.status)).map((a) => a.studentId)
    );
  }, [driveId, applications]);

  // Which mentors actually have a mentee relevant to this module — every
  // faculty mentor in the department when unlinked, or only the ones with a
  // mentee who's advanced in the linked drive. Without this, a mentor whose
  // mentees haven't even cleared round 1 got flagged as "hasn't logged" for
  // a module they have nobody to evaluate yet — noise, not signal.
  const relevantMentorUids = useMemo(() => {
    if (!driveId || !advancedIds || !mentorMappings) return null;
    return new Set(mentorMappings.filter((m) => advancedIds.has(m.studentId)).map((m) => m.facultyId));
  }, [driveId, advancedIds, mentorMappings]);

  // Who's actually logged something for this module vs. every relevant
  // faculty mentor in the department — the gap between the two is "who
  // hasn't conducted a mock interview yet," which a coordinator can't see
  // just by scrolling the evaluations themselves (no entry means no row).
  const mentorsWithEvals = useMemo(() => new Set(moduleEvals.map((e) => e.mentorId)), [moduleEvals]);
  const deptMentors = useMemo(() => {
    const all = (mentors ?? []).filter((m) => m.role === "faculty_mentor");
    return relevantMentorUids ? all.filter((m) => relevantMentorUids.has(m.uid)) : all;
  }, [mentors, relevantMentorUids]);
  const mentorsWithoutEvals = useMemo(
    () => deptMentors.filter((m) => !mentorsWithEvals.has(m.uid)).sort((a, b) => a.name.localeCompare(b.name)),
    [deptMentors, mentorsWithEvals]
  );

  const filteredEvals = useMemo(
    () => (!isMentorScoped && mentorFilter ? moduleEvals.filter((e) => e.mentorId === mentorFilter) : moduleEvals),
    [moduleEvals, mentorFilter, isMentorScoped]
  );

  const evalsByStudent = useMemo(() => {
    const map: Record<string, typeof filteredEvals> = {};
    for (const e of filteredEvals) {
      map[e.studentId] ??= [];
      map[e.studentId].push(e);
    }
    return map;
  }, [filteredEvals]);

  const dates = useMemo(() => Array.from(new Set(filteredEvals.map((e) => e.date))).sort((a, b) => a - b), [filteredEvals]);

  const studentIds = useMemo(
    () => Object.keys(evalsByStudent).sort((a, b) => (studentsByUid[a]?.rollNo ?? "").localeCompare(studentsByUid[b]?.rollNo ?? "")),
    [evalsByStudent, studentsByUid]
  );

  const dayEvals = useMemo(
    () =>
      dayFilter === ""
        ? []
        : filteredEvals
            .filter((e) => e.date === dayFilter)
            .sort((a, b) => (studentsByUid[a.studentId]?.rollNo ?? "").localeCompare(studentsByUid[b.studentId]?.rollNo ?? "")),
    [filteredEvals, dayFilter, studentsByUid]
  );

  function handleDownload() {
    const headers = ["Roll No", "Name", "Date", "Mentor", ...EVAL_CATEGORIES.map((c) => c.label), "Notes"];
    const source = dayFilter === "" ? filteredEvals : filteredEvals.filter((e) => e.date === dayFilter);
    const rows = source
      .slice()
      .sort((a, b) => (studentsByUid[a.studentId]?.rollNo ?? "").localeCompare(studentsByUid[b.studentId]?.rollNo ?? "") || a.date - b.date)
      .map((e) => {
        const s = studentsByUid[e.studentId];
        return [
          s?.rollNo ?? e.studentId,
          s?.name ?? "",
          formatDay(e.date),
          mentorsByUid[e.mentorId]?.name ?? e.mentorId,
          ...EVAL_CATEGORIES.map((c) => RATING_LABEL[e[c.key]]),
          e.notes ?? "",
        ];
      });
    downloadCsv(`${moduleName.replace(/\s+/g, "-").toLowerCase()}-evaluations.csv`, headers, rows);
  }

  if (
    evaluations === null ||
    students === null ||
    (!!driveId && (applications === null || mentorMappings === null))
  ) {
    return <Skeleton className="h-40" />;
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Consolidated report</h3>
          <p className="text-sm text-slate-500">
            {dayFilter === ""
              ? "Overall performance by day — click a student for the full breakdown and trend."
              : "Every question's value for the selected day, with the mentor who logged it."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isMentorScoped && (
            <select
              value={mentorFilter}
              onChange={(e) => setMentorFilter(e.target.value)}
              className={`${inputClass} sm:w-48`}
            >
              <option value="">All mentors</option>
              {deptMentors
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.name}
                    {mentorsWithEvals.has(m.uid) ? "" : " (no evaluations yet)"}
                  </option>
                ))}
            </select>
          )}
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value ? Number(e.target.value) : "")}
            className={`${inputClass} sm:w-48`}
          >
            <option value="">All days (summary)</option>
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
          {moduleEvals.length > 0 && (
            <Button variant="secondary" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          )}
        </div>
      </div>

      {!isMentorScoped && mentorsWithoutEvals.length > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {driveId
            ? `Have a mentee who cleared ${driveName ?? "this drive"} but haven't logged an evaluation yet: `
            : "Haven't logged any evaluations for this module yet: "}
          {mentorsWithoutEvals.map((m) => m.name).join(", ")}
        </p>
      )}

      {studentIds.length === 0 ? (
        <p className="text-sm text-slate-400">No evaluations logged for this module yet.</p>
      ) : dayFilter !== "" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Mentor</th>
                {EVAL_CATEGORIES.map((c) => (
                  <th key={c.key} className="py-2 pr-4">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dayEvals.map((e) => {
                const student = studentsByUid[e.studentId];
                return (
                  <tr key={e.evaluationId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">
                      {student ? `${student.rollNo} — ${student.name}` : e.studentId}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{mentorsByUid[e.mentorId]?.name ?? e.mentorId}</td>
                    {EVAL_CATEGORIES.map((c) => (
                      <td key={c.key} className="py-2 pr-4">
                        <Badge variant={RATING_BADGE[e[c.key]]}>{RATING_LABEL[e[c.key]]}</Badge>
                      </td>
                    ))}
                  </tr>
                );
              })}
              {dayEvals.length === 0 && (
                <tr>
                  <td colSpan={2 + EVAL_CATEGORIES.length} className="py-6 text-center text-sm text-slate-400">
                    No evaluations logged for this day.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Student</th>
                {dates.map((d) => (
                  <th key={d} className="py-2 pr-4">
                    {formatDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studentIds.map((studentId) => {
                const student = studentsByUid[studentId];
                const byDate = Object.fromEntries(evalsByStudent[studentId].map((e) => [e.date, e]));
                const isExpanded = expandedStudentId === studentId;
                return (
                  <Fragment key={studentId}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpandedStudentId(isExpanded ? null : studentId)}
                    >
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {student ? `${student.rollNo} — ${student.name}` : studentId}
                      </td>
                      {dates.map((d) => {
                        const entry = byDate[d];
                        return (
                          <td key={d} className="py-2 pr-4">
                            {entry ? (
                              <Badge variant={RATING_BADGE[entry.overallPerformance]}>{RATING_LABEL[entry.overallPerformance]}</Badge>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={dates.length + 1} className="pb-3">
                          <StudentProgressPanel student={student} evaluations={evalsByStudent[studentId]} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function MockEvaluations() {
  const { appUser } = useAuth();
  const modules = useMockModules(appUser);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [editingModule, setEditingModule] = useState(false);
  const [deletingModule, setDeletingModule] = useState(false);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  const canCreateModule = !!appUser && CAN_CREATE_MODULE_ROLES.includes(appUser.role);
  const canLogEval = !!appUser && CAN_LOG_EVAL_ROLES.includes(appUser.role);

  const sortedModules = useMemo(() => (modules ?? []).slice().sort((a, b) => b.startDate - a.startDate), [modules]);
  const selectedModule = sortedModules.find((m) => m.moduleId === selectedModuleId) ?? sortedModules[0];

  return (
    <div>
      <PageHeader
        title="Mock Interview Modules"
        subtitle="Daily per-mentee mock interview evaluations for a company drive, consolidated across the module's run."
        icon={ClipboardCheck}
        gradient="from-indigo-500 to-purple-600"
      />

      {canCreateModule && <CreateModuleSection onCreated={() => {}} />}

      {modules === null ? (
        <Skeleton className="h-24" />
      ) : sortedModules.length === 0 ? (
        <Card className="text-sm text-slate-500">No modules yet.</Card>
      ) : (
        <>
          <Card className="mb-4">
            <label className={labelClass}>Module</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedModule?.moduleId ?? ""}
                onChange={(e) => {
                  setSelectedModuleId(e.target.value);
                  setEditingModule(false);
                  setDeletingModule(false);
                }}
                className={`${inputClass} sm:w-96`}
              >
                {sortedModules.map((m) => (
                  <option key={m.moduleId} value={m.moduleId}>
                    {m.name} ({formatDay(m.startDate)} – {formatDay(m.endDate)})
                    {m.driveId && drives[m.driveId] ? ` — linked to ${drives[m.driveId].companyName}` : ""}
                  </option>
                ))}
              </select>
              {canCreateModule && selectedModule && !editingModule && !deletingModule && (
                <>
                  <Button variant="secondary" onClick={() => setEditingModule(true)} className="shrink-0">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="danger" onClick={() => setDeletingModule(true)} className="shrink-0">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </Card>

          {selectedModule && editingModule && (
            <EditModuleForm module={selectedModule} onDone={() => setEditingModule(false)} onCancel={() => setEditingModule(false)} />
          )}
          {selectedModule && deletingModule && (
            <DeleteModuleConfirm
              module={selectedModule}
              onDone={() => {
                setDeletingModule(false);
                setSelectedModuleId("");
              }}
              onCancel={() => setDeletingModule(false)}
            />
          )}

          {selectedModule && !editingModule && !deletingModule && (
            <>
              {canLogEval && (
                <LogEvaluationsSection
                  moduleId={selectedModule.moduleId}
                  moduleStart={selectedModule.startDate}
                  moduleEnd={selectedModule.endDate}
                  driveId={selectedModule.driveId}
                  driveName={selectedModule.driveId ? drives[selectedModule.driveId]?.companyName : undefined}
                />
              )}
              <ConsolidationSection
                moduleId={selectedModule.moduleId}
                moduleName={selectedModule.name}
                driveId={selectedModule.driveId}
                driveName={selectedModule.driveId ? drives[selectedModule.driveId]?.companyName : undefined}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
