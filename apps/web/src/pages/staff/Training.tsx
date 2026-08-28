import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { BarChart3, BookOpen, CalendarPlus, ChevronDown, ChevronUp, ClipboardCopy, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AttendanceStatus, Department, SkillTrack, TrainingBatch, TrainingSession } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import {
  useAllTrainingBatches,
  useAllTrainingSessions,
  createTrainingBatch,
  updateTrainingBatch,
  deleteTrainingBatch,
  createTrainingSession,
  updateTrainingSession,
  deleteTrainingSession,
  createRecurringSessions,
  markAttendance,
  markAllPresent,
  markRemainingAbsent,
  startCheckIn,
  closeCheckIn,
  useSessionAttendance,
} from "../../lib/trainingManagementLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const SKILL_TRACKS: SkillTrack[] = ["aptitude", "coding", "communication", "group_discussion", "domain_technical", "other"];
const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

const ATTENDANCE_BADGE: Record<AttendanceStatus, BadgeVariant> = {
  present: "success",
  absent: "danger",
  late: "warning",
};

function CreateBatchForm({ onDone }: { onDone: () => void }) {
  const { appUser, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const [name, setName] = useState("");
  const [skillTrack, setSkillTrack] = useState<SkillTrack>("aptitude");
  const [department, setDepartment] = useState<Department>("CSE");
  const [batchYear, setBatchYear] = useState(new Date().getFullYear());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleStudents = useMemo(
    () =>
      (students ?? [])
        .filter((s) => !s.isAlumni && s.department === department && s.batchYear === batchYear)
        .sort((a, b) => a.rollNo.localeCompare(b.rollNo)),
    [students, department, batchYear]
  );

  function toggleStudent(uid: string) {
    setSelectedIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  function selectAllEligible() {
    setSelectedIds(eligibleStudents.map((s) => s.uid));
  }

  function clearAllSelected() {
    setSelectedIds([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    if (selectedIds.length === 0) {
      setError("Select at least one student.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createTrainingBatch({
        name,
        skillTrack,
        department,
        batchYear,
        studentIds: selectedIds,
        trainerId: firebaseUser.uid,
      });
      showToast("Batch created");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create batch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Batch name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Skill track</label>
          <select value={skillTrack} onChange={(e) => setSkillTrack(e.target.value as SkillTrack)} className={inputClass}>
            {SKILL_TRACKS.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
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
        <div>
          <label className={labelClass}>Batch year</label>
          <input type="number" value={batchYear} onChange={(e) => setBatchYear(Number(e.target.value))} className={inputClass} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label className={`${labelClass} mb-0`}>Students ({selectedIds.length} selected)</label>
          {eligibleStudents.length > 0 && (
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={selectAllEligible} className="font-medium text-brand-700 hover:underline">
                Select all {eligibleStudents.length}
              </button>
              {selectedIds.length > 0 && (
                <button type="button" onClick={clearAllSelected} className="font-medium text-slate-500 hover:underline">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {students === null && <p className="p-2 text-sm text-slate-400">Loading…</p>}
          {students !== null && eligibleStudents.length === 0 && (
            <p className="p-2 text-sm text-slate-400">No {department} students in batch {batchYear}.</p>
          )}
          {eligibleStudents.map((s) => (
            <label key={s.studentId} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.includes(s.uid)} onChange={() => toggleStudent(s.uid)} />
              <span className="font-medium text-slate-700">{s.rollNo}</span> — {s.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Create batch
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditBatchForm({ batch, onDone }: { batch: TrainingBatch; onDone: () => void }) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const [name, setName] = useState(batch.name);
  const [skillTrack, setSkillTrack] = useState<SkillTrack>(batch.skillTrack);
  const [department, setDepartment] = useState<Department>(batch.department);
  const [batchYear, setBatchYear] = useState(batch.batchYear);
  const [selectedIds, setSelectedIds] = useState<string[]>(batch.studentIds);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleStudents = useMemo(
    () =>
      (students ?? [])
        .filter((s) => !s.isAlumni && s.department === department && s.batchYear === batchYear)
        .sort((a, b) => a.rollNo.localeCompare(b.rollNo)),
    [students, department, batchYear]
  );

  function toggleStudent(uid: string) {
    setSelectedIds((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }

  function selectAllEligible() {
    setSelectedIds(eligibleStudents.map((s) => s.uid));
  }

  function clearAllSelected() {
    setSelectedIds([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Select at least one student.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await updateTrainingBatch(batch.batchId, { name, skillTrack, department, batchYear, studentIds: selectedIds });
      showToast("Batch updated");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update batch");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-4 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Batch name</label>
          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Skill track</label>
          <select value={skillTrack} onChange={(e) => setSkillTrack(e.target.value as SkillTrack)} className={inputClass}>
            {SKILL_TRACKS.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
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
        <div>
          <label className={labelClass}>Batch year</label>
          <input type="number" value={batchYear} onChange={(e) => setBatchYear(Number(e.target.value))} className={inputClass} />
        </div>
      </div>

      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label className={`${labelClass} mb-0`}>Students ({selectedIds.length} selected)</label>
          {eligibleStudents.length > 0 && (
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={selectAllEligible} className="font-medium text-brand-700 hover:underline">
                Select all {eligibleStudents.length}
              </button>
              {selectedIds.length > 0 && (
                <button type="button" onClick={clearAllSelected} className="font-medium text-slate-500 hover:underline">
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
          {students === null && <p className="p-2 text-sm text-slate-400">Loading…</p>}
          {students !== null && eligibleStudents.length === 0 && (
            <p className="p-2 text-sm text-slate-400">No {department} students in batch {batchYear}.</p>
          )}
          {eligibleStudents.map((s) => (
            <label key={s.studentId} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
              <input type="checkbox" checked={selectedIds.includes(s.uid)} onChange={() => toggleStudent(s.uid)} />
              <span className="font-medium text-slate-700">{s.rollNo}</span> — {s.name}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Save changes
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteBatchConfirm({
  batchId,
  sessionIds,
  onDone,
  onCancel,
}: {
  batchId: string;
  sessionIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTrainingBatch(batchId, sessionIds);
      showToast("Batch deleted");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete batch");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-800">
        Delete this batch? This removes {sessionIds.length} session{sessionIds.length === 1 ? "" : "s"} and all attendance records — this can&apos;t
        be undone.
      </p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
          Delete batch
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CreateSessionForm({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const { showToast } = useToast();
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [mode, setMode] = useState<"offline" | "online">("offline");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createTrainingSession({
        batchId,
        topic,
        date: date ? new Date(date).getTime() : Date.now(),
        startTime,
        endTime,
        mode,
      });
      showToast("Session scheduled");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input type="text" placeholder="Topic" required value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} />
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
        <select value={mode} onChange={(e) => setMode(e.target.value as "offline" | "online")} className={inputClass}>
          <option value="offline">Offline</option>
          <option value="online">Online</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Schedule
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function EditSessionForm({ session, onDone }: { session: TrainingSession; onDone: () => void }) {
  const { showToast } = useToast();
  const [topic, setTopic] = useState(session.topic);
  const [date, setDate] = useState(() => {
    const d = new Date(session.date);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  const [mode, setMode] = useState<"offline" | "online">(session.mode);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateTrainingSession(session.sessionId, {
        topic,
        date: date ? new Date(date).getTime() : session.date,
        startTime,
        endTime,
        mode,
      });
      showToast("Session updated");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3 rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input type="text" placeholder="Topic" required value={topic} onChange={(e) => setTopic(e.target.value)} className={inputClass} />
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputClass} />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
        <select value={mode} onChange={(e) => setMode(e.target.value as "offline" | "online")} className={inputClass}>
          <option value="offline">Offline</option>
          <option value="online">Online</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Save changes
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function DeleteSessionConfirm({ sessionId, onDone, onCancel }: { sessionId: string; onDone: () => void; onCancel: () => void }) {
  const { showToast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteTrainingSession(sessionId);
      showToast("Session deleted");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete session");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-800">Delete this session? This removes all attendance records for it — this can&apos;t be undone.</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="danger" onClick={handleDelete} loading={deleting}>
          Delete session
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RecurringSessionForm({ batchId, onDone }: { batchId: string; onDone: () => void }) {
  const { showToast } = useToast();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [skipSundays, setSkipSundays] = useState(true);
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [morningTopic, setMorningTopic] = useState("");
  const [morningStart, setMorningStart] = useState("08:00");
  const [morningEnd, setMorningEnd] = useState("09:30");
  const [morningMode, setMorningMode] = useState<"offline" | "online">("offline");
  const [eveningEnabled, setEveningEnabled] = useState(true);
  const [eveningTopic, setEveningTopic] = useState("");
  const [eveningStart, setEveningStart] = useState("17:00");
  const [eveningEnd, setEveningEnd] = useState("18:30");
  const [eveningMode, setEveningMode] = useState<"offline" | "online">("offline");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Pick a start and end date.");
      return;
    }
    if (!morningEnabled && !eveningEnabled) {
      setError("Enable at least one slot.");
      return;
    }
    if ((morningEnabled && !morningTopic.trim()) || (eveningEnabled && !eveningTopic.trim())) {
      setError("Enter a topic for each enabled slot.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const count = await createRecurringSessions({
        batchId,
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        skipSundays,
        morning: { enabled: morningEnabled, topic: morningTopic, startTime: morningStart, endTime: morningEnd, mode: morningMode },
        evening: { enabled: eveningEnabled, topic: eveningTopic, startTime: eveningStart, endTime: eveningEnd, mode: eveningMode },
      });
      showToast(`${count} session(s) created`);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={labelClass}>From</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>To</label>
          <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={skipSundays} onChange={(e) => setSkipSundays(e.target.checked)} />
        Skip Sundays
      </label>

      <div className="rounded-md border border-slate-200 p-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={morningEnabled} onChange={(e) => setMorningEnabled(e.target.checked)} />
          Morning slot
        </label>
        {morningEnabled && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs text-slate-500">Topic</label>
              <input type="text" required placeholder="e.g. Aptitude" value={morningTopic} onChange={(e) => setMorningTopic(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Mode</label>
              <select value={morningMode} onChange={(e) => setMorningMode(e.target.value as "offline" | "online")} className={inputClass}>
                <option value="offline">Offline</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Start</label>
              <input type="time" value={morningStart} onChange={(e) => setMorningStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">End</label>
              <input type="time" value={morningEnd} onChange={(e) => setMorningEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-md border border-slate-200 p-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={eveningEnabled} onChange={(e) => setEveningEnabled(e.target.checked)} />
          Evening slot
        </label>
        {eveningEnabled && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs text-slate-500">Topic</label>
              <input type="text" required placeholder="e.g. Group Discussion" value={eveningTopic} onChange={(e) => setEveningTopic(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Mode</label>
              <select value={eveningMode} onChange={(e) => setEveningMode(e.target.value as "offline" | "online")} className={inputClass}>
                <option value="offline">Offline</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Start</label>
              <input type="time" value={eveningStart} onChange={(e) => setEveningStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">End</label>
              <input type="time" value={eveningEnd} onChange={(e) => setEveningEnd(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Generate sessions
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CheckInPanel({ session }: { session: TrainingSession }) {
  const { showToast } = useToast();
  const [windowMinutes, setWindowMinutes] = useState(10);
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isOpen = !!session.checkInOpenUntil && session.checkInOpenUntil > now;

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  async function handleStart() {
    setStarting(true);
    try {
      await startCheckIn(session.sessionId, windowMinutes);
      showToast("Check-in started");
    } finally {
      setStarting(false);
    }
  }

  async function handleClose() {
    await closeCheckIn(session.sessionId);
    showToast("Check-in closed");
  }

  if (!isOpen) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          max={60}
          value={windowMinutes}
          onChange={(e) => setWindowMinutes(Number(e.target.value))}
          className="w-16 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
        />
        <span className="text-xs text-slate-500">min window</span>
        <Button variant="secondary" onClick={handleStart} loading={starting} className="!px-2 !py-1 text-xs">
          <QrCode className="h-3.5 w-3.5" />
          Start check-in
        </Button>
      </div>
    );
  }

  const secondsLeft = Math.max(0, Math.round(((session.checkInOpenUntil as number) - now) / 1000));
  const checkInUrl = `${window.location.origin}/checkin/${session.sessionId}/${session.qrToken}`;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-4 ring-1 ring-slate-200 sm:flex-row sm:items-start">
      <QRCodeSVG value={checkInUrl} size={120} />
      <div>
        <p className="text-xs text-slate-500">Scan, or enter this code:</p>
        <p className="text-2xl font-bold tracking-widest text-slate-900">{session.qrToken}</p>
        <p className="mt-1 text-xs text-slate-500">
          Closes in {Math.floor(secondsLeft / 60)}m {secondsLeft % 60}s
        </p>
        <Button variant="secondary" onClick={handleClose} className="mt-2 !px-2 !py-1 text-xs">
          Close now
        </Button>
      </div>
    </div>
  );
}

function AttendanceRoster({ session, batch }: { session: TrainingSession; batch: TrainingBatch }) {
  const { firebaseUser, appUser } = useAuth();
  const { showToast } = useToast();
  const attendance = useSessionAttendance(session.sessionId, batch.studentIds);
  const students = useStudentsDirectory(appUser);
  const nameFor = (uid: string) => {
    const s = students?.find((x) => x.uid === uid);
    return s ? `${s.rollNo} — ${s.name}` : uid;
  };
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("present");

  // A coordinator's actual workflow after finishing attendance is "paste
  // this into the faculty group" — a ready-to-share text summary right
  // where they just finished marking, rather than making them go find this
  // same session again on a separate report page.
  async function handleCopySummary() {
    const present = batch.studentIds.filter((uid) => attendance[uid] === "present");
    const late = batch.studentIds.filter((uid) => attendance[uid] === "late");
    const absent = batch.studentIds.filter((uid) => attendance[uid] === "absent");
    const unmarked = batch.studentIds.filter((uid) => !attendance[uid]);
    const total = batch.studentIds.length;
    const pct = total > 0 ? Math.round(((present.length + late.length) / total) * 100) : 0;

    const lines = [
      `${batch.name} — ${session.topic}`,
      `${new Date(session.date).toLocaleDateString()} · ${session.startTime}-${session.endTime}`,
      "",
      `Total: ${total} | Present: ${present.length} | Late: ${late.length} | Absent: ${absent.length}` +
        (unmarked.length > 0 ? ` | Not marked: ${unmarked.length}` : "") +
        ` (${pct}% attendance)`,
    ];
    if (absent.length > 0) {
      lines.push("", "Absent:");
      absent.forEach((uid, i) => lines.push(`${i + 1}. ${nameFor(uid)}`));
    }
    if (unmarked.length > 0) {
      lines.push("", "Not marked:");
      unmarked.forEach((uid, i) => lines.push(`${i + 1}. ${nameFor(uid)}`));
    }

    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("Summary copied to clipboard");
  }

  async function setStatus(uid: string, status: AttendanceStatus) {
    if (!firebaseUser) return;
    await markAttendance(session.sessionId, uid, batch.department, status, firebaseUser.uid);
  }

  function toggleSelected(uid: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === batch.studentIds.length ? new Set() : new Set(batch.studentIds)));
  }

  async function handleMarkAllPresent() {
    if (!firebaseUser) return;
    setBulkBusy(true);
    try {
      await markAllPresent(session.sessionId, batch.studentIds, batch.department, firebaseUser.uid);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleMarkRemainingAbsent() {
    if (!firebaseUser) return;
    setBulkBusy(true);
    try {
      const already = new Set(Object.entries(attendance).filter(([, v]) => v != null).map(([uid]) => uid));
      await markRemainingAbsent(session.sessionId, batch.studentIds, batch.department, already, firebaseUser.uid);
    } finally {
      setBulkBusy(false);
    }
  }

  // Marks only the checked-off students — the two buttons above cover "all"
  // and "whoever's left", but picking out a specific handful (e.g. a few
  // latecomers) still meant clicking each one's dropdown individually.
  async function handleApplyToSelected() {
    if (!firebaseUser || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((uid) => markAttendance(session.sessionId, uid, batch.department, bulkStatus, firebaseUser.uid))
      );
      setSelectedIds(new Set());
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg bg-slate-50 p-3">
      <CheckInPanel session={session} />

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <Button variant="secondary" onClick={handleMarkAllPresent} loading={bulkBusy} className="!px-2 !py-1 text-xs">
          Mark all present
        </Button>
        <Button variant="secondary" onClick={handleMarkRemainingAbsent} loading={bulkBusy} className="!px-2 !py-1 text-xs">
          Mark remaining absent
        </Button>
        <Button variant="secondary" onClick={handleCopySummary} className="!px-2 !py-1 text-xs">
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy summary
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === batch.studentIds.length}
            ref={(el) => {
              if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < batch.studentIds.length;
            }}
            onChange={toggleSelectAll}
          />
          Select all ({selectedIds.size} selected)
        </label>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
            </select>
            <Button variant="secondary" onClick={handleApplyToSelected} loading={bulkBusy} className="!px-2 !py-1 text-xs">
              Apply to selected
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        {batch.studentIds.map((uid) => (
          <div key={uid} className="flex items-center justify-between gap-3 py-1 text-sm">
            <label className="flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={selectedIds.has(uid)} onChange={() => toggleSelected(uid)} />
              {nameFor(uid)}
            </label>
            <div className="flex items-center gap-2">
              {attendance[uid] && <Badge variant={ATTENDANCE_BADGE[attendance[uid] as AttendanceStatus]}>{attendance[uid]}</Badge>}
              <select
                value={attendance[uid] ?? ""}
                onChange={(e) => setStatus(uid, e.target.value as AttendanceStatus)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
              >
                <option value="" disabled>
                  Mark
                </option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchCard({ batch, canManageSchedule }: { batch: TrainingBatch; canManageSchedule: boolean }) {
  const allSessions = useAllTrainingSessions();
  const sessions = useMemo(
    () => (allSessions ?? []).filter((s) => s.batchId === batch.batchId).sort((a, b) => a.date - b.date),
    [allSessions, batch.batchId]
  );
  const status = useMemo(() => getBatchStatus(batch.batchId, allSessions ?? []), [batch.batchId, allSessions]);
  const [addingSession, setAddingSession] = useState(false);
  const [addingRecurring, setAddingRecurring] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [editingBatch, setEditingBatch] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  // Sessions/attendance collapsed by default — every batch card used to
  // dump its full session list open at once, which is a lot to scroll past
  // just to see which trainings exist; click a batch to see its schedule.
  const [expanded, setExpanded] = useState(false);

  // A multi-day batch (see RecurringSessionForm — morning + evening across a
  // date range) used to dump every session into one flat list, which reads
  // fine for a single day but turns unscannable once there's a week's worth.
  // Group by calendar day instead, with a filter to jump straight to one.
  const dateKey = (ts: number) => new Date(ts).toDateString();
  const dateOptions = useMemo(() => Array.from(new Set(sessions.map((s) => dateKey(s.date)))), [sessions]);
  const visibleSessions = useMemo(
    () => (dateFilter ? sessions.filter((s) => dateKey(s.date) === dateFilter) : sessions),
    [sessions, dateFilter]
  );
  const sessionsByDate = useMemo(() => {
    const groups: { dateKey: string; date: number; sessions: TrainingSession[] }[] = [];
    for (const s of visibleSessions) {
      const key = dateKey(s.date);
      const last = groups[groups.length - 1];
      if (last && last.dateKey === key) last.sessions.push(s);
      else groups.push({ dateKey: key, date: s.date, sessions: [s] });
    }
    return groups;
  }, [visibleSessions]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex flex-1 items-start gap-2 text-left">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{batch.name}</h3>
              <Badge variant={BATCH_STATUS_BADGE[status]}>{status}</Badge>
            </div>
            <p className="text-sm capitalize text-slate-500">
              {batch.skillTrack.replace("_", " ")} · {batch.department} · {batch.batchYear} · {batch.studentIds.length} students
              {" · "}
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
          )}
        </button>
        {canManageSchedule && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAddingRecurring((v) => !v)}>
              <CalendarPlus className="h-4 w-4" />
              Daily Sessions
            </Button>
            <Button variant="secondary" onClick={() => setAddingSession((v) => !v)}>
              <Plus className="h-4 w-4" />
              Session
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDeletingBatch(false);
                setEditingBatch((v) => !v);
              }}
              className="!px-2"
              title="Edit batch"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditingBatch(false);
                setDeletingBatch((v) => !v);
              }}
              className="!px-2 text-red-600"
              title="Delete batch"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {canManageSchedule && editingBatch && <EditBatchForm batch={batch} onDone={() => setEditingBatch(false)} />}
      {canManageSchedule && deletingBatch && (
        <DeleteBatchConfirm
          batchId={batch.batchId}
          sessionIds={sessions.map((s) => s.sessionId)}
          onDone={() => setDeletingBatch(false)}
          onCancel={() => setDeletingBatch(false)}
        />
      )}

      {canManageSchedule && addingRecurring && (
        <RecurringSessionForm batchId={batch.batchId} onDone={() => setAddingRecurring(false)} />
      )}
      {canManageSchedule && addingSession && (
        <CreateSessionForm batchId={batch.batchId} onDone={() => setAddingSession(false)} />
      )}

      {expanded && (sessions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No sessions scheduled yet.</p>
      ) : (
        <>
          {dateOptions.length > 1 && (
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All dates ({sessions.length} sessions)</option>
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {sessionsByDate.map((group) => (
            <div key={group.dateKey} className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {new Date(group.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              </h4>
              <ul className="mt-1 divide-y divide-slate-100">
                {group.sessions.map((session) => (
                  <li key={session.sessionId} className="py-2.5">
                    <div className="flex w-full items-center justify-between gap-3 text-sm">
                      <button
                        onClick={() => setOpenSessionId((prev) => (prev === session.sessionId ? null : session.sessionId))}
                        className="flex flex-1 items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{session.topic}</p>
                          <p className="text-xs text-slate-500">
                            {session.startTime}–{session.endTime} · {session.mode}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-brand-700">
                          {openSessionId === session.sessionId ? "Hide roster" : "Mark attendance"}
                        </span>
                      </button>
                      {canManageSchedule && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            title="Edit session"
                            onClick={() => {
                              setDeletingSessionId(null);
                              setEditingSessionId((prev) => (prev === session.sessionId ? null : session.sessionId));
                            }}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete session"
                            onClick={() => {
                              setEditingSessionId(null);
                              setDeletingSessionId((prev) => (prev === session.sessionId ? null : session.sessionId));
                            }}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {editingSessionId === session.sessionId && (
                      <EditSessionForm session={session} onDone={() => setEditingSessionId(null)} />
                    )}
                    {deletingSessionId === session.sessionId && (
                      <DeleteSessionConfirm
                        sessionId={session.sessionId}
                        onDone={() => setDeletingSessionId(null)}
                        onCancel={() => setDeletingSessionId(null)}
                      />
                    )}
                    {openSessionId === session.sessionId && <AttendanceRoster session={session} batch={batch} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ))}
    </Card>
  );
}

const SCHEDULE_MANAGER_ROLES = ["coordinator", "hod", "dean", "principal", "cpo", "admin"];

type BatchStatus = "ongoing" | "completed";

const BATCH_STATUS_BADGE: Record<BatchStatus, BadgeVariant> = {
  ongoing: "warning",
  completed: "success",
};

/** Derived, not stored — a batch has no status field of its own. A batch
 * with no sessions yet counts as "ongoing" (about to start, not finished);
 * otherwise it's "completed" once every session's date has passed, judged
 * against the start of today so a session scheduled for later today still
 * counts as ongoing. */
function getBatchStatus(batchId: string, sessions: TrainingSession[]): BatchStatus {
  const batchSessions = sessions.filter((s) => s.batchId === batchId);
  if (batchSessions.length === 0) return "ongoing";
  const latest = Math.max(...batchSessions.map((s) => s.date));
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return latest < todayStart.getTime() ? "completed" : "ongoing";
}

export default function StaffTraining() {
  const { appUser } = useAuth();
  const canManageSchedule = !!appUser && SCHEDULE_MANAGER_ROLES.includes(appUser.role);
  const batches = useAllTrainingBatches();
  const sessions = useAllTrainingSessions();
  const [creating, setCreating] = useState(false);
  const [batchYearFilter, setBatchYearFilter] = useState<number | "">("");
  const [skillTrackFilter, setSkillTrackFilter] = useState<SkillTrack | "">("");
  const [statusFilter, setStatusFilter] = useState<BatchStatus | "">("");

  const batchYearOptions = useMemo(
    () => Array.from(new Set((batches ?? []).map((b) => b.batchYear))).sort((a, b) => a - b),
    [batches]
  );
  const skillTrackOptions = useMemo(
    () => Array.from(new Set((batches ?? []).map((b) => b.skillTrack))).sort((a, b) => a.localeCompare(b)),
    [batches]
  );
  const statusByBatchId = useMemo(() => {
    if (!batches || !sessions) return null;
    return Object.fromEntries(batches.map((b) => [b.batchId, getBatchStatus(b.batchId, sessions)]));
  }, [batches, sessions]);
  const filteredBatches = useMemo(() => {
    if (!batches || !statusByBatchId) return null;
    return batches
      .filter((b) => !batchYearFilter || b.batchYear === batchYearFilter)
      .filter((b) => !skillTrackFilter || b.skillTrack === skillTrackFilter)
      .filter((b) => !statusFilter || statusByBatchId[b.batchId] === statusFilter)
      // Ongoing first, then completed — a coordinator cares about what's
      // currently running before what's already wrapped up.
      .sort((a, b) => {
        const rank = (id: string) => (statusByBatchId[id] === "ongoing" ? 0 : 1);
        return rank(a.batchId) - rank(b.batchId);
      });
  }, [batches, statusByBatchId, batchYearFilter, skillTrackFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Training"
        subtitle={
          batches && filteredBatches && filteredBatches.length !== batches.length
            ? `${filteredBatches.length} of ${batches.length} batch(es)`
            : "Batches, sessions, and attendance."
        }
        icon={BookOpen}
        gradient="from-amber-500 to-orange-600"
        action={
          <div className="flex gap-2">
            <Link to="/staff/attendance-report">
              <Button variant="secondary">
                <BarChart3 className="h-4 w-4" />
                Attendance Report
              </Button>
            </Link>
            {canManageSchedule && !creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                New Batch
              </Button>
            )}
          </div>
        }
      />

      {canManageSchedule && creating && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">New training batch</h3>
          <CreateBatchForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {batches !== null && batches.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {batchYearOptions.length > 0 && (
            <select
              value={batchYearFilter}
              onChange={(e) => setBatchYearFilter(e.target.value ? Number(e.target.value) : "")}
              className={`${inputClass} sm:w-44`}
            >
              <option value="">All batches</option>
              {batchYearOptions.map((y) => (
                <option key={y} value={y}>
                  Batch {y}
                </option>
              ))}
            </select>
          )}
          {skillTrackOptions.length > 0 && (
            <select
              value={skillTrackFilter}
              onChange={(e) => setSkillTrackFilter(e.target.value as SkillTrack | "")}
              className={`${inputClass} sm:w-44`}
            >
              <option value="">All trainings</option>
              {skillTrackOptions.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BatchStatus | "")}
            className={`${inputClass} sm:w-44`}
          >
            <option value="">All statuses</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}

      {batches === null && <Skeleton className="h-40" />}
      {batches !== null && batches.length === 0 && !creating && (
        <EmptyState icon={BookOpen} title="No training batches yet" />
      )}
      {batches !== null && batches.length > 0 && filteredBatches !== null && filteredBatches.length === 0 && (
        <EmptyState icon={BookOpen} title="No training batches match your filters" />
      )}

      <div className="space-y-4">
        {filteredBatches?.map((b) => (
          <BatchCard key={b.batchId} batch={b} canManageSchedule={canManageSchedule} />
        ))}
      </div>
    </div>
  );
}
