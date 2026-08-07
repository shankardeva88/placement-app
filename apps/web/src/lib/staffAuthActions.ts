import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, set, get, update, serverTimestamp } from "firebase/database";
import { db, firebaseConfig } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, FacultyDesignation, UserRole } from "@placement-app/types";

export type StaffRole = Extract<
  UserRole,
  "admin" | "hod" | "coordinator" | "faculty_mentor" | "dean" | "principal" | "cpo"
>;

/** Coordinators and HODs mentor their own slice of final-year students
 * alongside dedicated faculty_mentor accounts, so all three roles are
 * enumerable via mentorIndex — see the doc comment above DB_NODES in
 * packages/types. */
const MENTOR_INDEX_ROLES = new Set<StaffRole>(["faculty_mentor", "coordinator", "hod"]);

export interface CreateStaffAccountInput {
  email: string;
  password: string;
  name: string;
  role: StaffRole;
  department?: Department; // required for hod/coordinator/faculty_mentor
  designation?: FacultyDesignation;
}

/** Creating a user with the app's normal (primary) auth instance would sign
 * the current admin out and sign in as the new account — Firebase's client
 * SDK doesn't support "create a user without switching the session". A
 * throwaway secondary Firebase App instance sidesteps that: it gets its own
 * isolated auth state, and is deleted once the account is created. The
 * actual /users write still happens through the primary `db` (still
 * authenticated as the admin the whole time). */
export async function createStaffAccount(input: CreateStaffAccountInput) {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
    const uid = cred.user.uid;

    const userRecord: Record<string, unknown> = {
      uid,
      email: input.email,
      name: input.name,
      role: input.role,
      campusId: "main",
      createdAt: serverTimestamp(),
      isActive: true,
    };
    if (input.department) userRecord.department = input.department;
    if (input.designation) userRecord.designation = input.designation;

    try {
      await set(ref(db, `${DB_NODES.users}/${uid}`), userRecord);
      if (MENTOR_INDEX_ROLES.has(input.role) && input.department) {
        await set(ref(db, `${DB_NODES.mentorIndex}/${input.department}/${uid}`), true);
      }
    } catch (writeErr) {
      // Auth account exists but /users never landed (e.g. a coordinator's
      // scoped creation rule denied it) — delete it rather than leave an
      // orphaned login with no profile and an email that's now permanently
      // "taken". Same fix already applied to signUpStudent (authActions.ts)
      // and createBulkStudent (bulkImportLib.ts) for the identical failure
      // mode.
      await cred.user.delete().catch(() => {});
      throw writeErr;
    }

    await signOut(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}

export interface ParsedMentorRow {
  rowIndex: number;
  name: string;
  email: string;
  designation: FacultyDesignation;
  password: string;
  errors: string[];
  warnings: string[];
}

export interface ParseMentorResult {
  rows: ParsedMentorRow[];
  unmappedHeaders: string[];
}

function normalizeMentorHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

const MENTOR_NAME_HEADERS = new Set(["name", "mentor name", "full name"]);
const MENTOR_EMAIL_HEADERS = new Set(["email", "email id", "mail id", "college email"]);
const MENTOR_DESIGNATION_HEADERS = new Set(["designation"]);
const MENTOR_PASSWORD_HEADERS = new Set(["password", "temporary password", "temp password"]);

const DESIGNATION_ALIASES: Record<string, FacultyDesignation> = {
  professor: "professor",
  prof: "professor",
  "associate professor": "associate_professor",
  "assoc professor": "associate_professor",
  "assoc. professor": "associate_professor",
  "assistant professor": "assistant_professor",
  "asst professor": "assistant_professor",
  "asst. professor": "assistant_professor",
};

/** No Department column — bulk import always creates mentors in one
 * department, picked once outside the sheet (see ImportMentorsForm in
 * MentorTools.tsx), not per row. Matches how the scoped creation rule works
 * anyway: coordinator/hod can only ever create mentors in their own
 * department, so a per-row department would be misleading for the common
 * case and is only meaningful for admin, who already picks one explicitly. */
export function parseMentorRows(headers: string[], rawRows: string[][]): ParseMentorResult {
  let nameIdx = -1;
  let emailIdx = -1;
  let designationIdx = -1;
  let passwordIdx = -1;
  const unmappedHeaders: string[] = [];

  headers.forEach((h, i) => {
    const norm = normalizeMentorHeader(h);
    if (MENTOR_NAME_HEADERS.has(norm)) nameIdx = i;
    else if (MENTOR_EMAIL_HEADERS.has(norm)) emailIdx = i;
    else if (MENTOR_DESIGNATION_HEADERS.has(norm)) designationIdx = i;
    else if (MENTOR_PASSWORD_HEADERS.has(norm)) passwordIdx = i;
    else if (norm) unmappedHeaders.push(h);
  });

  const get = (row: string[], idx: number) => (idx >= 0 ? (row[idx] ?? "").trim() : "");

  const rows: ParsedMentorRow[] = [];
  rawRows.forEach((row, i) => {
    const name = get(row, nameIdx);
    const email = get(row, emailIdx);
    if (!name && !email) return; // blank/trailing row, not a mentor

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!name) errors.push("Missing name");
    if (!email || !email.includes("@")) errors.push("Missing or invalid email");

    const password = get(row, passwordIdx);
    if (!password) errors.push("Missing password");
    else if (password.length < 6) errors.push("Password must be at least 6 characters");

    const designationRaw = get(row, designationIdx).toLowerCase();
    let designation: FacultyDesignation = "assistant_professor";
    if (designationRaw) {
      const matched = DESIGNATION_ALIASES[designationRaw];
      if (matched) designation = matched;
      else warnings.push(`Designation "${designationRaw}" not recognized — defaulted to Assistant Professor`);
    } else {
      warnings.push("No designation given — defaulted to Assistant Professor");
    }

    rows.push({ rowIndex: i + 1, name, email, designation, password, errors, warnings });
  });

  return { rows, unmappedHeaders };
}

export interface UpdateStaffAccountInput {
  uid: string;
  name: string;
  role: StaffRole;
  department?: Department; // required for hod/coordinator/faculty_mentor, omitted otherwise
  isActive: boolean;
}

/** Name/role/department/active-state edits for an existing account — only
 * reachable by admin (see the /users rules comment). Keeps mentorIndex in
 * sync: drops the old department's entry when the role stops being
 * mentor-eligible or the department changes, adds the new one when it
 * becomes eligible.
 *
 * Deliberately does NOT touch email: the Firebase Auth login email is a
 * separate record from the /users profile, and the client SDK can only
 * change a user's own email while signed in as them — the deployed app has
 * no in-browser way to change someone else's login credentials without a
 * backend (Cloud Functions needs the Blaze plan). It's not unfixable,
 * though — `firebase auth:export` + edit + `firebase auth:import` changes a
 * user's login email from the CLI while preserving their password, no
 * billing required. That's an operator-run fix (ask in a Claude Code
 * session), not something this function or the ManageStaff UI can trigger
 * itself. */
export async function updateStaffAccount(input: UpdateStaffAccountInput) {
  const snap = await get(ref(db, `${DB_NODES.users}/${input.uid}`));
  if (!snap.exists()) throw new Error("Staff account not found");
  const existing = snap.val() as { role: StaffRole; department?: Department };

  const wasIndexed = MENTOR_INDEX_ROLES.has(existing.role) && !!existing.department;
  const isIndexed = MENTOR_INDEX_ROLES.has(input.role) && !!input.department;

  const updates: Record<string, unknown> = {
    [`${DB_NODES.users}/${input.uid}/name`]: input.name,
    [`${DB_NODES.users}/${input.uid}/role`]: input.role,
    [`${DB_NODES.users}/${input.uid}/department`]: input.department ?? null,
    [`${DB_NODES.users}/${input.uid}/isActive`]: input.isActive,
  };

  if (wasIndexed && (!isIndexed || existing.department !== input.department)) {
    updates[`${DB_NODES.mentorIndex}/${existing.department}/${input.uid}`] = null;
  }
  if (isIndexed) {
    updates[`${DB_NODES.mentorIndex}/${input.department}/${input.uid}`] = true;
  }

  await update(ref(db), updates);
}

/** Removes the /users profile (and its mentorIndex entry, if any) so the
 * account loses all app access immediately. This does NOT delete the
 * underlying Firebase Auth login — that needs the Admin SDK, which this
 * Spark-plan project doesn't have server-side. In practice that's fine: with
 * no /users record the account can't sign into anything (every screen reads
 * /users first), it's just that its email stays "taken" in Firebase Auth
 * until the login itself is deleted from the Firebase console/CLI. */
export async function removeStaffAccount(uid: string) {
  const snap = await get(ref(db, `${DB_NODES.users}/${uid}`));
  const existing = snap.exists() ? (snap.val() as { role: StaffRole; department?: Department }) : null;

  const updates: Record<string, unknown> = {
    [`${DB_NODES.users}/${uid}`]: null,
  };
  if (existing && MENTOR_INDEX_ROLES.has(existing.role) && existing.department) {
    updates[`${DB_NODES.mentorIndex}/${existing.department}/${uid}`] = null;
  }

  await update(ref(db), updates);
}
