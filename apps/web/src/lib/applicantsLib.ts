import { useMemo } from "react";
import { ref, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Application, ApplicationStatus, Department, Student } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";
import { sendNotification } from "./staffNotificationsLib";

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

// Composed here (not left to the caller) so every call site — the
// single-row update and the bulk update, both in DriveApplicants.tsx —
// gets identical wording for free instead of drifting apart.
function describeApplicationStatusChange(
  companyName: string,
  status: ApplicationStatus,
  roundName?: string
): { title: string; body: string } {
  switch (status) {
    case "shortlisted":
      return { title: `${companyName} — Shortlisted`, body: `You've been shortlisted for ${companyName}. Check the drive for next steps.` };
    case "in_round":
      return roundName
        ? { title: `${companyName} — ${roundName}`, body: `You're through to ${roundName} for ${companyName}.` }
        : { title: `${companyName} — Round update`, body: `Your application for ${companyName} has moved to the next round.` };
    case "selected":
      return { title: `${companyName} — Selected!`, body: `Congratulations — you've been selected at ${companyName}!` };
    case "rejected":
      return {
        title: `${companyName} — Update`,
        body: roundName
          ? `You weren't carried forward past ${roundName} at ${companyName} this time. Keep going!`
          : `You weren't selected at ${companyName} this time. Keep going!`,
      };
    case "withdrawn":
      return { title: `${companyName} — Application withdrawn`, body: `Your application for ${companyName} was withdrawn.` };
    default:
      return { title: `${companyName} — Application update`, body: `Your application status for ${companyName} was updated.` };
  }
}

export interface ApplicationStatusNotifyContext {
  studentUid: string;
  companyName: string;
  roundName?: string; // resolved from currentRoundId by the caller, who already has drive.rounds loaded
  sentBy: string; // acting staff uid
}

/** Updates the application, then best-effort fires a targeted notification
 * (audience "student", see NotificationAudienceType doc comment) so the
 * student finds out without having to notice a status change themselves on
 * the Drives page. `notify` is optional so callers that don't have the
 * context handy (or don't want to notify — e.g. an automated cleanup) can
 * skip it; a failed notification send never fails the status update itself,
 * since the write that actually matters already landed by the time it runs. */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  currentRoundId?: string,
  notify?: ApplicationStatusNotifyContext
) {
  await update(ref(db, `${DB_NODES.applications}/${applicationId}`), {
    status,
    currentRoundId: currentRoundId ?? null,
    updatedAt: Date.now(),
  });
  if (notify) {
    try {
      const { title, body } = describeApplicationStatusChange(notify.companyName, status, notify.roundName);
      await sendNotification({ title, body, audienceType: "student", filterValue: notify.studentUid, sentBy: notify.sentBy });
    } catch {
      // Best-effort — the status update already succeeded either way.
    }
  }
}

/** Removes the application record itself, not just its status — e.g. a
 * student applied but never actually showed up for the drive, and
 * "withdrawn" still leaves them cluttering applicant counts/lists. Cleans
 * up both write sites in one update() (the record and its
 * applicationsDeptIndex entry) so nothing's left pointing at a deleted
 * application — same reasoning as the Nuclei drive stale-application
 * cleanup this formalizes into an in-app action. */
export async function deleteApplication(applicationId: string, department: Department) {
  await update(ref(db), {
    [`${DB_NODES.applications}/${applicationId}`]: null,
    [`${DB_NODES.applicationsDeptIndex}/${department}/${applicationId}`]: null,
  });
}
