import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase/config";
import type { AppUser } from "@placement-app/types";

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);

/** Generic department-scoped collection reader, reused across every
 * student-tied collection (applications, offers, mockInterviews, etc.) so
 * the same department-scoping fan-out isn't hand-rolled nine separate times.
 * Institution roles (dean/principal/cpo/admin) get the collection's root
 * read directly, unchanged. Dept-scoped roles (hod/coordinator/
 * faculty_mentor) fan out through `${deptIndexNode}/${myDept}` (record ids)
 * then read each record individually — same shape as
 * useStudentsDirectory/useMentorDirectory. Returns null while loading, []
 * once loaded with nothing to show. */
export function useDeptScopedCollection<T>(
  appUser: AppUser | null,
  collectionNode: string,
  deptIndexNode: string
): T[] | null {
  const isInstitution = !!appUser && INSTITUTION_ROLES.has(appUser.role);
  const department = appUser && "department" in appUser ? appUser.department : undefined;

  const [rootRecords, setRootRecords] = useState<T[] | null>(null);
  const [deptIds, setDeptIds] = useState<string[] | null>(null);
  const [deptRecords, setDeptRecords] = useState<Record<string, T>>({});

  useEffect(() => {
    if (!isInstitution) return;
    return onValue(ref(db, collectionNode), (snap) => {
      const val = snap.val() as Record<string, T> | null;
      setRootRecords(val ? Object.values(val) : []);
    });
  }, [isInstitution, collectionNode]);

  useEffect(() => {
    if (isInstitution || !department) return;
    return onValue(ref(db, `${deptIndexNode}/${department}`), (snap) => {
      const val = snap.val() as Record<string, boolean> | null;
      setDeptIds(val ? Object.keys(val) : []);
    });
  }, [isInstitution, department, deptIndexNode]);

  useEffect(() => {
    if (!deptIds) return;
    const unsubs = deptIds.map((id) =>
      onValue(ref(db, `${collectionNode}/${id}`), (snap) => {
        if (snap.exists()) {
          setDeptRecords((prev) => ({ ...prev, [id]: snap.val() as T }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [deptIds, collectionNode]);

  if (!appUser) return null;
  if (isInstitution) return rootRecords;
  if (!department) return [];
  if (deptIds === null) return null;
  return Object.values(deptRecords);
}
