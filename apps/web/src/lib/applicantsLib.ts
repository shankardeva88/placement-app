import { useEffect, useMemo, useState } from "react";
import { ref, get, update } from "firebase/database";
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
 * DB_NODES doc comment in packages/types for why. */
export function useDriveApplicants(appUser: AppUser | null, driveId: string | undefined): ApplicantRow[] | null {
  const applications = useAllApplications(appUser);
  const [rows, setRows] = useState<ApplicantRow[] | null>(null);

  const scoped = useMemo(
    () => (applications && driveId ? applications.filter((a) => a.driveId === driveId) : null),
    [applications, driveId]
  );

  useEffect(() => {
    if (!scoped) return;
    Promise.all(
      scoped.map(async (application): Promise<ApplicantRow> => {
        try {
          const studentSnap = await get(ref(db, `${DB_NODES.students}/${application.studentId}`));
          return { application, student: studentSnap.exists() ? (studentSnap.val() as Student) : null };
        } catch {
          return { application, student: null };
        }
      })
    ).then(setRows);
  }, [scoped]);

  return rows;
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
