import { ref, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department } from "@placement-app/types";

/** Writes the exact record shape the self-check-in rule in
 * database.rules.json expects: status "present", method "qr", markedBy the
 * student's own uid, and checkInToken matching the session's current
 * qrToken within its checkInOpenUntil window. Any mismatch (wrong/expired
 * code, already checked in) is rejected server-side, not just hidden by the
 * UI — this call throws with Firebase's permission-denied error in that case.
 * Also writes attendanceDeptIndex/{department}/{attendanceId} = true in the
 * same multi-path update, same as staff-marked attendance. */
export async function selfCheckIn(sessionId: string, token: string, studentUid: string, department: Department) {
  const attendanceId = `${sessionId}_${studentUid}`;
  await update(ref(db), {
    [`${DB_NODES.attendance}/${sessionId}/${studentUid}`]: {
      attendanceId,
      sessionId,
      studentId: studentUid,
      department,
      status: "present",
      markedBy: studentUid,
      markedAt: Date.now(),
      method: "qr",
      checkInToken: token,
    },
    [`${DB_NODES.attendanceDeptIndex}/${department}/${attendanceId}`]: true,
  });
}
