import { useEffect, useState } from "react";
import { ref, push, set, remove, onValue, get } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, SignupAllowlistEntry } from "@placement-app/types";

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function addToSignupAllowlist(email: string, department: Department, addedBy: string) {
  const newRef = push(ref(db, DB_NODES.signupAllowlist));
  const allowlistId = newRef.key as string;
  await set(ref(db, `${DB_NODES.signupAllowlist}/${allowlistId}`), {
    allowlistId,
    email: normalizeEmail(email),
    department,
    addedBy,
    addedAt: Date.now(),
  });
}

export async function removeFromSignupAllowlist(allowlistId: string) {
  await remove(ref(db, `${DB_NODES.signupAllowlist}/${allowlistId}`));
}

/** Checked right after the Firebase Auth account is created (see
 * signUpStudent in authActions.ts) — before that point there's no
 * authenticated context, and signupAllowlist's read rule requires one.
 * Returns the matching entry (so its allowlistId can be consumed/removed
 * once signup succeeds) or null if this email was never approved. */
export async function findSignupAllowlistEntry(email: string): Promise<SignupAllowlistEntry | null> {
  const target = normalizeEmail(email);
  const snap = await get(ref(db, DB_NODES.signupAllowlist));
  const val = snap.val() as Record<string, SignupAllowlistEntry> | null;
  if (!val) return null;
  return Object.values(val).find((e) => e.email === target) ?? null;
}

/** Dept-scoped for the coordinator/hod-facing management UI (Students.tsx)
 * — same scoping the write rule enforces, filtered client-side rather than
 * a dedicated dept-index fan-out since this list is small (a handful of
 * pending approvals at a time, each consumed and removed once used). */
export function useSignupAllowlist(appUser: AppUser | null): SignupAllowlistEntry[] | null {
  const [entries, setEntries] = useState<SignupAllowlistEntry[] | null>(null);
  const isInstitution = !!appUser && INSTITUTION_ROLES.has(appUser.role);
  const department = appUser && "department" in appUser ? appUser.department : undefined;

  useEffect(() => {
    if (!appUser) return;
    return onValue(ref(db, DB_NODES.signupAllowlist), (snap) => {
      const val = snap.val() as Record<string, SignupAllowlistEntry> | null;
      const all = val ? Object.values(val) : [];
      setEntries(isInstitution ? all : all.filter((e) => e.department === department));
    });
  }, [appUser, isInstitution, department]);

  return entries;
}
