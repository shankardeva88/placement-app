import { useEffect, useState } from "react";
import { ref, push, set, get, update, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type {
  AppUser,
  AttendanceMethod,
  AttendanceRecord,
  AttendanceStatus,
  Department,
  SkillTrack,
  TrainingBatch,
  TrainingSession,
} from "@placement-app/types";

export function useAllTrainingBatches(): TrainingBatch[] | null {
  const [batches, setBatches] = useState<TrainingBatch[] | null>(null);
  useEffect(() => {
    return onValue(ref(db, DB_NODES.trainingBatches), (snap) => {
      const val = snap.val() as Record<string, TrainingBatch> | null;
      setBatches(val ? Object.values(val) : []);
    });
  }, []);
  return batches;
}

export function useAllTrainingSessions(): TrainingSession[] | null {
  const [sessions, setSessions] = useState<TrainingSession[] | null>(null);
  useEffect(() => {
    return onValue(ref(db, DB_NODES.trainingSessions), (snap) => {
      const val = snap.val() as Record<string, TrainingSession> | null;
      setSessions(val ? Object.values(val) : []);
    });
  }, []);
  return sessions;
}

export interface CreateBatchInput {
  name: string;
  skillTrack: SkillTrack;
  department: Department;
  batchYear: number;
  studentIds: string[];
  trainerId: string;
}

export async function createTrainingBatch(input: CreateBatchInput) {
  const newRef = push(ref(db, DB_NODES.trainingBatches));
  const batchId = newRef.key as string;
  const batch: TrainingBatch = {
    batchId,
    name: input.name,
    skillTrack: input.skillTrack,
    trainerId: input.trainerId,
    department: input.department,
    batchYear: input.batchYear,
    studentIds: input.studentIds,
    createdAt: Date.now(),
  };
  await set(newRef, batch);
  return batchId;
}

export type UpdateBatchInput = Partial<Omit<CreateBatchInput, "trainerId">>;

export async function updateTrainingBatch(batchId: string, input: UpdateBatchInput) {
  await update(ref(db, `${DB_NODES.trainingBatches}/${batchId}`), input);
}

/** Everything a deleted session or batch leaves behind that isn't
 * automatically cleaned up by RTDB: its own attendance subtree (nested, so
 * one remove() handles that) and — because attendanceDeptIndex is a
 * separate flat index, not nested under the session — one entry per marked
 * student that has to be found and removed individually. Reads the
 * session's attendance first specifically to know which department each
 * entry's index lives under (a session's roster can technically span
 * students marked under different departments' index if the batch was ever
 * edited, so this doesn't assume one department). */
async function sessionDeletionUpdates(sessionId: string): Promise<Record<string, unknown>> {
  const attSnap = await get(ref(db, `${DB_NODES.attendance}/${sessionId}`));
  const attendanceByStudent = (attSnap.val() as Record<string, AttendanceRecord> | null) ?? {};
  const updates: Record<string, unknown> = {
    [`${DB_NODES.trainingSessions}/${sessionId}`]: null,
  };
  // Per-student keys, not a single `attendance/{sessionId}: null` — the
  // .write rule only exists at attendance/{sessionId}/{studentUid}, never
  // at the session level itself or the attendance root. Write rules only
  // cascade DOWN from a grant; a rule that exists solely on a descendant
  // is never consulted for a shallower write, so a whole-subtree null-out
  // here had no valid permission anywhere and silently failed the entire
  // multi-path update() (including the session/batch deletion alongside
  // it, since one denied path fails the whole update atomically).
  for (const [studentUid, record] of Object.entries(attendanceByStudent)) {
    updates[`${DB_NODES.attendance}/${sessionId}/${studentUid}`] = null;
    updates[`${DB_NODES.attendanceDeptIndex}/${record.department}/${sessionId}_${studentUid}`] = null;
  }
  return updates;
}

export async function deleteTrainingSession(sessionId: string) {
  const updates = await sessionDeletionUpdates(sessionId);
  await update(ref(db), updates);
}

/** Cascades to every session under the batch (and each of those sessions'
 * attendance) — sessionIds comes from the caller, which already has the
 * batch's sessions loaded (useAllTrainingSessions filtered by batchId), so
 * this doesn't need to re-fetch and filter the whole collection itself. */
export async function deleteTrainingBatch(batchId: string, sessionIds: string[]) {
  const perSessionUpdates = await Promise.all(sessionIds.map(sessionDeletionUpdates));
  const updates: Record<string, unknown> = { [`${DB_NODES.trainingBatches}/${batchId}`]: null };
  for (const sessionUpdates of perSessionUpdates) Object.assign(updates, sessionUpdates);
  await update(ref(db), updates);
}

export interface CreateSessionInput {
  batchId: string;
  topic: string;
  date: number;
  startTime: string;
  endTime: string;
  mode: "offline" | "online";
}

export async function createTrainingSession(input: CreateSessionInput) {
  const newRef = push(ref(db, DB_NODES.trainingSessions));
  const sessionId = newRef.key as string;
  const session: TrainingSession = {
    sessionId,
    batchId: input.batchId,
    date: input.date,
    topic: input.topic,
    startTime: input.startTime,
    endTime: input.endTime,
    mode: input.mode,
  };
  await set(newRef, session);
  return sessionId;
}

export type UpdateSessionInput = Partial<Omit<CreateSessionInput, "batchId">>;

export async function updateTrainingSession(sessionId: string, input: UpdateSessionInput) {
  await update(ref(db, `${DB_NODES.trainingSessions}/${sessionId}`), input);
}

/** One morning + one evening session per day across a date range (skipping
 * Sundays), created in a single multi-path update() — the point is to stop
 * clicking "New Session" twice a day, every day. Either slot can be omitted
 * (e.g. training-only mornings). */
export interface RecurringSlot {
  enabled: boolean;
  topic: string;
  startTime: string;
  endTime: string;
  mode: "offline" | "online";
}

export interface CreateRecurringSessionsInput {
  batchId: string;
  startDate: number;
  endDate: number;
  skipSundays: boolean;
  morning: RecurringSlot;
  evening: RecurringSlot;
}

export async function createRecurringSessions(input: CreateRecurringSessionsInput) {
  const updates: Record<string, unknown> = {};
  let createdCount = 0;

  for (let day = input.startDate; day <= input.endDate; day += 24 * 60 * 60 * 1000) {
    const date = new Date(day);
    if (input.skipSundays && date.getDay() === 0) continue;

    for (const slot of [input.morning, input.evening]) {
      if (!slot.enabled) continue;
      const sessionId = push(ref(db, DB_NODES.trainingSessions)).key as string;
      const session: TrainingSession = {
        sessionId,
        batchId: input.batchId,
        date: day,
        topic: slot.topic,
        startTime: slot.startTime,
        endTime: slot.endTime,
        mode: slot.mode,
      };
      updates[`${DB_NODES.trainingSessions}/${sessionId}`] = session;
      createdCount += 1;
    }
  }

  if (createdCount > 0) await update(ref(db), updates);
  return createdCount;
}

/** Random 6-character check-in code — short enough to read off a projector
 * and type manually, long enough that guessing it during a short window
 * isn't practical. */
function generateCheckInCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function startCheckIn(sessionId: string, windowMinutes: number) {
  const qrToken = generateCheckInCode();
  const checkInOpenUntil = Date.now() + windowMinutes * 60 * 1000;
  await update(ref(db, `${DB_NODES.trainingSessions}/${sessionId}`), { qrToken, checkInOpenUntil });
  return { qrToken, checkInOpenUntil };
}

export async function closeCheckIn(sessionId: string) {
  await update(ref(db, `${DB_NODES.trainingSessions}/${sessionId}`), { checkInOpenUntil: Date.now() });
}

/** attendance is nested `{sessionId}/{studentUid}` — see the doc comment
 * above DB_NODES in packages/types for why (self-check-in needs the rule to
 * look up the session's qrToken, which a flat composite id can't support).
 * `department` is the batch's — a batch is created for one department (see
 * CreateBatchInput), so every student in its roster shares it. Also writes
 * attendanceDeptIndex/{department}/{attendanceId} = true in the same
 * multi-path update, since root reads are institution-only now. */
export async function markAttendance(
  sessionId: string,
  studentId: string,
  department: Department,
  status: AttendanceStatus,
  markedBy: string,
  method: AttendanceMethod = "manual"
) {
  const attendanceId = `${sessionId}_${studentId}`;
  await update(ref(db), {
    [`${DB_NODES.attendance}/${sessionId}/${studentId}`]: {
      attendanceId,
      sessionId,
      studentId,
      department,
      status,
      markedBy,
      markedAt: Date.now(),
      method,
    },
    [`${DB_NODES.attendanceDeptIndex}/${department}/${attendanceId}`]: true,
  });
}

export async function markRemainingAbsent(
  sessionId: string,
  studentIds: string[],
  department: Department,
  alreadyMarked: Set<string>,
  staffUid: string
) {
  const remaining = studentIds.filter((uid) => !alreadyMarked.has(uid));
  await Promise.all(remaining.map((uid) => markAttendance(sessionId, uid, department, "absent", staffUid, "manual")));
  return remaining.length;
}

export async function markAllPresent(sessionId: string, studentIds: string[], department: Department, staffUid: string) {
  await Promise.all(studentIds.map((uid) => markAttendance(sessionId, uid, department, "present", staffUid, "manual")));
}

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);

/** Dept-scoped attendance, grouped back into the {sessionId: {studentUid:
 * record}} shape the shortage report expects. attendance is nested
 * ({sessionId}/{studentUid}), not flat, so this can't reuse
 * useDeptScopedCollection directly — root read is institution-only now,
 * dept-scoped roles fan out through attendanceDeptIndex (keyed by the
 * record's own attendanceId = "{sessionId}_{studentUid}"), splitting that
 * id back into its two path segments client-side. */
export function useAllAttendance(appUser: AppUser | null): Record<string, Record<string, { status: AttendanceStatus }>> {
  const isInstitution = !!appUser && INSTITUTION_ROLES.has(appUser.role);
  const department = appUser && "department" in appUser ? appUser.department : undefined;

  const [rootAttendance, setRootAttendance] = useState<Record<string, Record<string, AttendanceRecord>> | null>(null);
  const [deptIds, setDeptIds] = useState<string[] | null>(null);
  const [deptRecords, setDeptRecords] = useState<Record<string, AttendanceRecord>>({});

  useEffect(() => {
    if (!isInstitution) return;
    return onValue(ref(db, DB_NODES.attendance), (snap) => {
      setRootAttendance((snap.val() as Record<string, Record<string, AttendanceRecord>> | null) ?? {});
    });
  }, [isInstitution]);

  useEffect(() => {
    if (isInstitution || !department) return;
    return onValue(ref(db, `${DB_NODES.attendanceDeptIndex}/${department}`), (snap) => {
      const val = snap.val() as Record<string, boolean> | null;
      setDeptIds(val ? Object.keys(val) : []);
    });
  }, [isInstitution, department]);

  useEffect(() => {
    if (!deptIds) return;
    const unsubs = deptIds.map((attendanceId) => {
      const splitAt = attendanceId.indexOf("_");
      const sessionId = attendanceId.slice(0, splitAt);
      const studentId = attendanceId.slice(splitAt + 1);
      return onValue(ref(db, `${DB_NODES.attendance}/${sessionId}/${studentId}`), (snap) => {
        if (snap.exists()) {
          setDeptRecords((prev) => ({ ...prev, [attendanceId]: snap.val() as AttendanceRecord }));
        }
      });
    });
    return () => unsubs.forEach((u) => u());
  }, [deptIds]);

  const grouped: Record<string, Record<string, { status: AttendanceStatus }>> = {};
  const records = isInstitution
    ? Object.values(rootAttendance ?? {}).flatMap((byStudent) => Object.values(byStudent))
    : Object.values(deptRecords);
  for (const r of records) {
    grouped[r.sessionId] ??= {};
    grouped[r.sessionId][r.studentId] = { status: r.status };
  }
  return grouped;
}

export function useSessionAttendance(sessionId: string, studentIds: string[]) {
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus | null>>({});

  useEffect(() => {
    const unsubs = studentIds.map((uid) =>
      onValue(ref(db, `${DB_NODES.attendance}/${sessionId}/${uid}`), (snap) => {
        setAttendance((prev) => ({ ...prev, [uid]: snap.exists() ? (snap.val().status as AttendanceStatus) : null }));
      })
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, studentIds.join(",")]);

  return attendance;
}
