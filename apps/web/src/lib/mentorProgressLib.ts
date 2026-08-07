import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";

/** semesterWiseSgpa keys are "sem1".."sem8" — sorted numerically, not
 * alphabetically (alphabetical would put "sem10" before "sem2"). Shared
 * between the staff mentee view (MentorTools.tsx) and the student's own
 * view (MentorProgress.tsx) — same chart, same data shape either side. */
export function sortedSgpaEntries(sgpa: Record<string, number> | undefined): { key: string; label: string; value: number }[] {
  return Object.entries(sgpa ?? {})
    .map(([key, value]) => ({ key, label: key.replace(/\D/g, ""), value, n: parseInt(key.replace(/\D/g, ""), 10) || 0 }))
    .sort((a, b) => a.n - b.n)
    .map(({ key, label, value }) => ({ key, label: `Sem ${label}`, value }));
}

/** Reads studentIndex/{studentUid}/{collectionNode} to discover record ids,
 * then fetches each record from `${collectionNode}/{id}` individually — see
 * the studentIndex doc comment above DB_NODES in packages/types for why a
 * direct collection read isn't possible for these many-per-student
 * collections (mockInterviews, resumeReviews, skillAssessments, mentorMapping). */
export function useIndexedList<T>(studentUid: string | undefined, collectionNode: string): T[] | null {
  const [ids, setIds] = useState<string[] | null>(null);
  const [records, setRecords] = useState<Record<string, T>>({});

  useEffect(() => {
    if (!studentUid) return;
    return onValue(ref(db, `${DB_NODES.studentIndex}/${studentUid}/${collectionNode}`), (snap) => {
      const val = snap.val() as Record<string, boolean> | null;
      setIds(val ? Object.keys(val) : []);
    });
  }, [studentUid, collectionNode]);

  useEffect(() => {
    if (!ids) return;
    const unsubs = ids.map((id) =>
      onValue(ref(db, `${collectionNode}/${id}`), (snap) => {
        if (snap.exists()) {
          setRecords((prev) => ({ ...prev, [id]: snap.val() as T }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [ids, collectionNode]);

  if (!ids) return null;
  return ids.map((id) => records[id]).filter((r): r is T => r !== undefined);
}
