// Cloud Functions — Placement App
// This is a starter file. We'll add more triggers module by module
// (eligibility auto-match, notification sends, PRI recompute, etc.)

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

/**
 * Example trigger — recomputes a student's Placement Readiness Index
 * whenever their attendance changes. We'll flesh this out fully in the
 * Mentor Progress / PRI module (Step 10) — this is just the skeleton
 * wired up now so the project builds end-to-end from day one.
 */
export const onAttendanceWrite = onDocumentWritten(
  "attendance/{attendanceId}",
  async (event) => {
    const data = event.data?.after.data();
    if (!data) return; // deleted doc — skip

    const { studentId } = data;

    // Placeholder — real aggregation logic comes in Step 10
    await db.collection("readinessScores").doc(studentId).set(
      {
        computedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);
