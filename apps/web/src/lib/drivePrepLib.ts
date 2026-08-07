import { useEffect, useState } from "react";
import { ref, get, update, remove } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, DrivePrepAssignment } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);
const ALL_DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

/** Same shape as useStudentsDirectory, applied to mentorIndex instead of
 * departmentIndex — dean/principal/cpo see every department's mentors,
 * coordinator/hod only their own. One-shot get() per department node
 * rather than a live subscription: a mentor picker doesn't need to be
 * realtime, and this avoids juggling up to 9 open listeners. */
export function useMentorDirectory(appUser: AppUser | null): AppUser[] | null {
  const [mentors, setMentors] = useState<AppUser[] | null>(null);
  const isInstitution = !!appUser && INSTITUTION_ROLES.has(appUser.role);
  const department = appUser && "department" in appUser ? appUser.department : undefined;

  useEffect(() => {
    if (!appUser) return;
    let cancelled = false;

    async function load() {
      const depts = isInstitution ? ALL_DEPARTMENTS : department ? [department] : [];
      const uidSets = await Promise.all(
        depts.map(async (d) => {
          const snap = await get(ref(db, `${DB_NODES.mentorIndex}/${d}`));
          const val = snap.val() as Record<string, boolean> | null;
          return val ? Object.keys(val) : [];
        })
      );
      const uids = Array.from(new Set(uidSets.flat()));
      const userSnaps = await Promise.all(uids.map((uid) => get(ref(db, `${DB_NODES.users}/${uid}`))));
      if (cancelled) return;
      setMentors(userSnaps.filter((s) => s.exists()).map((s) => s.val() as AppUser));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [appUser, isInstitution, department]);

  return mentors;
}

/** drivePrepAssignments' root read is institution-only now — dept-scoped
 * roles (hod/coordinator/faculty_mentor) fan out through
 * drivePrepAssignmentsDeptIndex instead (see useDeptScopedCollection). The
 * assignment's `department` is the student's, but since useMentorDirectory
 * already restricts a dept-scoped coordinator/hod to picking mentors from
 * their own department, a mentor's own assignments always land in their own
 * department's slice too — no separate by-mentor index needed. */
function useAllDrivePrepAssignments(appUser: AppUser | null): DrivePrepAssignment[] | null {
  return useDeptScopedCollection<DrivePrepAssignment>(
    appUser,
    DB_NODES.drivePrepAssignments,
    DB_NODES.drivePrepAssignmentsDeptIndex
  );
}

export function useDrivePrepAssignments(
  appUser: AppUser | null,
  driveId: string | undefined
): DrivePrepAssignment[] | null {
  const all = useAllDrivePrepAssignments(appUser);
  if (!driveId) return null;
  if (!all) return null;
  return all.filter((a) => a.driveId === driveId);
}

export function useMyDrivePrepAssignments(
  appUser: AppUser | null,
  mentorUid: string | undefined
): DrivePrepAssignment[] | null {
  const all = useAllDrivePrepAssignments(appUser);
  if (!mentorUid) return null;
  if (!all) return null;
  return all.filter((a) => a.mentorId === mentorUid);
}

/** Total drive-prep assignments per mentor, across every drive — used to cap
 * auto-distribute so it doesn't pile prep duty onto a mentor who's already
 * loaded up from other drives, on top of their normal ~10-12 student
 * mentoring load. */
export function useDrivePrepLoad(appUser: AppUser | null): Record<string, number> | null {
  const all = useAllDrivePrepAssignments(appUser);
  if (!all) return null;
  const counts: Record<string, number> = {};
  for (const a of all) counts[a.mentorId] = (counts[a.mentorId] ?? 0) + 1;
  return counts;
}

export const DEFAULT_MAX_PREP_PER_MENTOR = 12;

export interface PrepPair {
  studentId: string;
  department: Department;
  mentorId: string;
}

/** assignmentId = `${driveId}_${studentId}` — one assignment per student per
 * drive, so re-assigning a student to a different mentor just overwrites
 * the existing record instead of creating a duplicate. */
export async function assignDrivePrep(driveId: string, pairs: PrepPair[], assignedBy: string) {
  const updates: Record<string, unknown> = {};
  for (const { studentId, department, mentorId } of pairs) {
    const assignmentId = `${driveId}_${studentId}`;
    updates[`${DB_NODES.drivePrepAssignments}/${assignmentId}`] = {
      assignmentId,
      driveId,
      studentId,
      department,
      mentorId,
      assignedBy,
      assignedAt: Date.now(),
    };
    updates[`${DB_NODES.drivePrepAssignmentsDeptIndex}/${department}/${assignmentId}`] = true;
  }
  await update(ref(db), updates);
}

export async function removeDrivePrepAssignment(driveId: string, studentId: string) {
  await remove(ref(db, `${DB_NODES.drivePrepAssignments}/${driveId}_${studentId}`));
}

/** Round-robin, skipping any mentor already at maxPerMentor total drive-prep
 * assignments (across all drives, per currentLoad). Students left over once
 * every mentor is at capacity come back unassigned — the caller surfaces
 * that count so the coordinator knows to hand-place the rest. The
 * coordinator can still hand-override any pairing before saving. */
export function autoDistribute(
  students: { uid: string; department: Department }[],
  mentorIds: string[],
  currentLoad: Record<string, number> = {},
  maxPerMentor: number = DEFAULT_MAX_PREP_PER_MENTOR
): PrepPair[] {
  if (mentorIds.length === 0) return [];
  const load: Record<string, number> = { ...currentLoad };
  for (const mentorId of mentorIds) load[mentorId] ??= 0;

  const pairs: PrepPair[] = [];
  let cursor = 0;
  for (const { uid: studentId, department } of students) {
    let chosen: string | null = null;
    for (let i = 0; i < mentorIds.length; i++) {
      const candidate = mentorIds[(cursor + i) % mentorIds.length];
      if (load[candidate] < maxPerMentor) {
        chosen = candidate;
        cursor = cursor + i + 1;
        break;
      }
    }
    if (chosen) {
      load[chosen]++;
      pairs.push({ studentId, department, mentorId: chosen });
    }
  }
  return pairs;
}
