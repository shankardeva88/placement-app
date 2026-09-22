import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { ref, set, update, serverTimestamp } from "firebase/database";
import { auth, db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department } from "@placement-app/types";
import { findSignupAllowlistEntry, removeFromSignupAllowlist } from "./signupAllowlistLib";

export async function signUpStudent(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;

  try {
    // Coordinator/hod must have approved this email first (Students.tsx →
    // Signup approvals) — otherwise anyone could create a student account
    // with any email and an empty roll number, which is how this got added
    // in the first place. Checked here (auth account already exists, so
    // auth != null holds) rather than before creating it, since the
    // allowlist read rule needs an authenticated context.
    const allowlistEntry = await findSignupAllowlistEntry(email);
    if (!allowlistEntry) {
      throw new Error("This email hasn't been approved for signup yet — contact your placement coordinator.");
    }

    await set(ref(db, `${DB_NODES.users}/${uid}`), {
      uid,
      email,
      name,
      role: "student",
      campusId: "main",
      createdAt: serverTimestamp(),
      isActive: true,
    });

    await set(ref(db, `${DB_NODES.students}/${uid}`), {
      studentId: uid,
      uid,
      campusId: "main",
      rollNo: "",
      name,
      email,
      department: "OTHER",
      batchYear: new Date().getFullYear(),
      currentSemester: 1,
      cgpa: 0,
      activeBacklogs: 0,
      skills: [],
      profileComplete: false,
      placementStatus: "not_placed",
      isAlumni: false,
      verifiedByFaculty: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Consumed now that it's done its job — a failure here shouldn't roll
    // back the account that was just successfully created over it, so it's
    // deliberately not inside the same try scope's failure path.
    await removeFromSignupAllowlist(allowlistEntry.allowlistId).catch(() => {});
  } catch (writeErr) {
    // Auth account exists but /users or /students never landed — delete it
    // rather than leave an orphaned login with no profile and an email
    // that's now permanently "taken" (same failure mode as createBulkStudent
    // in bulkImportLib.ts, same fix).
    await cred.user.delete().catch(() => {});
    throw writeErr;
  }

  return cred.user;
}

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export interface ProfileSetupInput {
  rollNo: string;
  department: Department;
  batchYear: number;
  currentSemester: number;
  cgpa: number;
  activeBacklogs: number;
  skills: string[];
  resumeUrl: string;
}

export async function completeStudentProfile(uid: string, input: ProfileSetupInput) {
  await update(ref(db, `${DB_NODES.students}/${uid}`), {
    ...input,
    profileComplete: true,
    updatedAt: serverTimestamp(),
  });
  // Lets department-scoped staff (coordinator/hod) enumerate students in
  // their department — see the DB_NODES.departmentIndex doc comment.
  await set(ref(db, `${DB_NODES.departmentIndex}/${input.department}/${uid}`), true);
}
