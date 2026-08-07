import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive } from "@placement-app/types";

export interface DriveWithRecord<T> {
  drive: Drive;
  record: T | null;
}

/** Fetches every drive plus, for each one, this student's record at
 * `${collectionNode}/${studentUid}_${drive.driveId}` — the deterministic-id
 * pattern documented above DB_NODES in packages/types, used by
 * applications, offers, and (via a different suffix) attendance. Returns
 * null while drives are still loading. */
export function useOwnedDriveRecords<T>(
  studentUid: string | undefined,
  collectionNode: string
): DriveWithRecord<T>[] | null {
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [records, setRecords] = useState<Record<string, T | null>>({});

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  useEffect(() => {
    if (!studentUid || !drives) return;
    const unsubs = drives.map((drive) =>
      onValue(ref(db, `${collectionNode}/${studentUid}_${drive.driveId}`), (snap) => {
        setRecords((prev) => ({ ...prev, [drive.driveId]: snap.exists() ? (snap.val() as T) : null }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [studentUid, drives, collectionNode]);

  if (!drives) return null;
  return drives.map((drive) => ({ drive, record: records[drive.driveId] ?? null }));
}
