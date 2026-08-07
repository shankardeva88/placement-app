import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AttendanceRecord, TrainingBatch, TrainingSession } from "@placement-app/types";

export interface SessionWithAttendance {
  session: TrainingSession;
  attendance: AttendanceRecord | null;
}

export interface BatchWithSessions {
  batch: TrainingBatch;
  sessions: SessionWithAttendance[];
}

/** trainingBatches/trainingSessions are fully readable, so batches are found
 * by filtering client-side on studentIds. Attendance is then looked up per
 * session at `attendance/{sessionId}/{studentUid}` — nested, not a flat
 * composite id (see DB_NODES doc comment in packages/types for why). */
export function useMyTraining(studentUid: string | undefined): BatchWithSessions[] | null {
  const [batches, setBatches] = useState<TrainingBatch[] | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[] | null>(null);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord | null>>({});

  useEffect(() => {
    return onValue(ref(db, DB_NODES.trainingBatches), (snap) => {
      const val = snap.val() as Record<string, TrainingBatch> | null;
      setBatches(val ? Object.values(val) : []);
    });
  }, []);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.trainingSessions), (snap) => {
      const val = snap.val() as Record<string, TrainingSession> | null;
      setSessions(val ? Object.values(val) : []);
    });
  }, []);

  const myBatches = useMemo(
    () => (batches && studentUid ? batches.filter((b) => b.studentIds.includes(studentUid)) : null),
    [batches, studentUid]
  );

  const mySessions = useMemo(() => {
    if (!myBatches || !sessions) return null;
    const myBatchIds = new Set(myBatches.map((b) => b.batchId));
    return sessions.filter((s) => myBatchIds.has(s.batchId));
  }, [myBatches, sessions]);

  useEffect(() => {
    if (!studentUid || !mySessions) return;
    const unsubs = mySessions.map((session) =>
      onValue(ref(db, `${DB_NODES.attendance}/${session.sessionId}/${studentUid}`), (snap) => {
        setAttendance((prev) => ({
          ...prev,
          [session.sessionId]: snap.exists() ? (snap.val() as AttendanceRecord) : null,
        }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [studentUid, mySessions]);

  if (!myBatches || !mySessions) return null;

  return myBatches.map((batch) => ({
    batch,
    sessions: mySessions
      .filter((s) => s.batchId === batch.batchId)
      .map((session) => ({ session, attendance: attendance[session.sessionId] ?? null })),
  }));
}
