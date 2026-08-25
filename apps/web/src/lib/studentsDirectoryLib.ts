import { useEffect, useState } from "react";
import { ref, onValue, update, get, remove } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, EntranceExamType, Gender, Student } from "@placement-app/types";

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);

/** dean/principal/cpo get a direct root read of /students (unrestricted, see
 * database.rules.json); coordinator/hod are dept-scoped and instead fan out
 * from departmentIndex/{department} — same reasoning as useOwnedDriveRecords
 * on the student side. */
export function useStudentsDirectory(appUser: AppUser | null): Student[] | null {
  const [allStudents, setAllStudents] = useState<Student[] | null>(null);
  const [deptUids, setDeptUids] = useState<string[] | null>(null);
  const [deptStudents, setDeptStudents] = useState<Record<string, Student>>({});

  const isInstitution = !!appUser && INSTITUTION_ROLES.has(appUser.role);
  const department = appUser && "department" in appUser ? appUser.department : undefined;

  useEffect(() => {
    if (!isInstitution) return;
    return onValue(ref(db, DB_NODES.students), (snap) => {
      const val = snap.val() as Record<string, Student> | null;
      setAllStudents(val ? Object.values(val) : []);
    });
  }, [isInstitution]);

  useEffect(() => {
    if (isInstitution || !department) return;
    return onValue(ref(db, `${DB_NODES.departmentIndex}/${department}`), (snap) => {
      const val = snap.val() as Record<string, boolean> | null;
      setDeptUids(val ? Object.keys(val) : []);
    });
  }, [isInstitution, department]);

  useEffect(() => {
    if (!deptUids) return;
    const unsubs = deptUids.map((uid) =>
      onValue(ref(db, `${DB_NODES.students}/${uid}`), (snap) => {
        if (snap.exists()) {
          setDeptStudents((prev) => ({ ...prev, [uid]: snap.val() as Student }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [deptUids]);

  if (isInstitution) return allStudents;
  if (!deptUids) return null;
  return deptUids.map((uid) => deptStudents[uid]).filter((s): s is Student => s !== undefined);
}

export async function setStudentVerified(uid: string, verified: boolean) {
  await update(ref(db, `${DB_NODES.students}/${uid}`), { verifiedByFaculty: verified });
}

/** The "official roster" fields — same set bulkImportLib.ts writes at
 * creation time, the ones a coordinator/hod is the source of truth for
 * (confirmed scope). Personal/self-reported fields (address, skills, social
 * links, parent contact) stay student-editable only, unchanged from before. */
// The optional fields are `| null`, not just `?`, because the caller needs a
// way to say "this is genuinely blank" — Firebase's update() throws
// synchronously if any property is literally `undefined` (as opposed to
// `null`, which is the valid, supported way to clear/omit a field), so a
// form that blanks out an already-empty field has to send null, not leave
// the key `undefined`. See EditStudentForm in StudentDetail.tsx.
export interface StudentProfileUpdate {
  rollNo?: string;
  name?: string;
  department?: Department;
  batchYear?: number;
  cgpa?: number;
  activeBacklogs?: number;
  gender?: Gender;
  studentPhone?: string | null;
  personalEmail?: string | null;
  dateOfBirth?: number | null;
  tenthPercentage?: number | null;
  tenthYearOfPassing?: number | null;
  twelfthPercentage?: number | null;
  twelfthYearOfPassing?: number | null;
  entranceType?: EntranceExamType | null;
  entranceRank?: string | null;
  resumeUrl?: string | null;
}

export async function updateStudentProfile(uid: string, updates: StudentProfileUpdate) {
  await update(ref(db, `${DB_NODES.students}/${uid}`), { ...updates, updatedAt: Date.now() });
}

/** "Delete" in the coordinator-facing UI — deactivates rather than removes
 * (confirmed choice): reversible, keeps all history (applications/offers/
 * mentoring records) intact, and doesn't touch the Firebase Auth login the
 * way a hard delete would need to. See the isActive field rule under
 * /users/$uid in database.rules.json for who's allowed to call this. */
export async function setStudentActive(uid: string, isActive: boolean) {
  await update(ref(db, `${DB_NODES.users}/${uid}`), { isActive });
}

/** True hard delete — for a mistakenly-created/test record, not a real
 * student (use setStudentActive for that). Two sequential calls, not one
 * multi-path update: the /users deletion rule cross-references
 * students/{uid}/department to check the actor's department, so /users
 * must be removed first while /students still exists for that lookup to
 * resolve, then /students + its departmentIndex entry are removed in a
 * second call (already covered by the existing department-match write rule
 * on /students, no new rule needed there). */
export async function removeStudent(uid: string) {
  const studentSnap = await get(ref(db, `${DB_NODES.students}/${uid}`));
  const department = (studentSnap.val() as Student | null)?.department;

  await remove(ref(db, `${DB_NODES.users}/${uid}`));

  const updates: Record<string, null> = { [`${DB_NODES.students}/${uid}`]: null };
  if (department) {
    updates[`${DB_NODES.departmentIndex}/${department}/${uid}`] = null;
  }
  await update(ref(db), updates);
}
