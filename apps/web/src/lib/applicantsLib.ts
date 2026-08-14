import { useMemo } from "react";
import { ref, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Application, ApplicationStatus, Student } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";

export interface ApplicantRow {
  application: Application;
  // null means the student record couldn't be read — shouldn't normally
  // happen now that applications are department-scoped the same as
  // students, but kept as a defensive fallback.
  student: Student | null;
}

/** Applications' root read is institution-only now — dept-scoped roles
 * (hod/coordinator/faculty_mentor) fan out through applicationsDeptIndex
 * instead (see useDeptScopedCollection). A dept-scoped coordinator/hod
 * reviewing a drive open to multiple departments only sees their own
 * department's applicants here; institution roles see everyone — see the
 * DB_NODES doc comment in packages/types for why.
 *
 * Takes an already-loaded `students` list (from useStudentsDirectory,
 * caller-owned) rather than fetching each applicant's record itself — this
 * used to do one individual get() per applicant inside a useEffect keyed on
 * the WHOLE department's applications collection, so every single write
 * anywhere in the department (any drive, any status change) re-triggered a
 * fresh fetch-every-applicant cascade for whichever drive's page was open.
 * A high-traffic drive (many applicants, many status updates in flight)
 * made its own page pay for that cascade worst of all — a lookup into an
 * already-subscribed list is just a plain derived value, no network calls
 * or effect re-runs involved. */
export function useDriveApplicants(
  appUser: AppUser | null,
  driveId: string | undefined,
  students: Student[] | null
): ApplicantRow[] | null {
  const applications = useAllApplications(appUser);

  const studentsByUid = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students ?? []) map.set(s.uid, s);
    return map;
  }, [students]);

  return useMemo(() => {
    if (!applications || !driveId || !students) return null;
    return applications
      .filter((a) => a.driveId === driveId)
      .map((application) => ({ application, student: studentsByUid.get(application.studentId) ?? null }));
  }, [applications, driveId, students, studentsByUid]);
}

export function useAllApplications(appUser: AppUser | null): Application[] | null {
  return useDeptScopedCollection<Application>(appUser, DB_NODES.applications, DB_NODES.applicationsDeptIndex);
}

export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus, currentRoundId?: string) {
  await update(ref(db, `${DB_NODES.applications}/${applicationId}`), {
    status,
    currentRoundId: currentRoundId ?? null,
    updatedAt: Date.now(),
  });
}
