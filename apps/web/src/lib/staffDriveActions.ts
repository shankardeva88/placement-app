import { ref, push, set, update, get } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppNotification, Drive, DriveRole, DriveRound, DriveStatus, DriveType, EligibilityCriteria } from "@placement-app/types";
import { sendNotification } from "./staffNotificationsLib";

export interface DriveFormInput {
  companyName: string;
  jobRole: string;
  type: DriveType;
  ctc: number;
  jdUrl: string;
  driveDate: number;
  eligibility: EligibilityCriteria;
  selectedStudentIds: string[];
  roles: DriveRole[];
  rounds: DriveRound[];
}

export async function createDrive(input: DriveFormInput, createdByUid: string) {
  const newRef = push(ref(db, DB_NODES.drives));
  const driveId = newRef.key as string;
  const drive: Drive = {
    driveId,
    campusId: "main",
    companyName: input.companyName,
    jobRole: input.jobRole,
    type: input.type,
    ctc: input.ctc,
    eligibility: input.eligibility,
    rounds: input.rounds,
    driveDate: input.driveDate,
    status: "upcoming",
    createdBy: createdByUid,
    createdAt: Date.now(),
  };
  // set() rejects `undefined` values outright — omit the key instead when empty.
  if (input.jdUrl) drive.jdUrl = input.jdUrl;
  if (input.selectedStudentIds.length > 0) drive.selectedStudentIds = input.selectedStudentIds;
  if (input.roles.length > 0) drive.roles = input.roles;
  await set(newRef, drive);
  // Auto-notify whoever the drive is actually for — eligible_list/
  // selected_students notifications resolve their real audience via
  // isDriveVisibleToStudent using this same driveId (see notificationsLib.ts),
  // so this stays in sync with who can see the drive without duplicating the
  // eligibility logic here. Best-effort: a notification failure shouldn't
  // block the drive itself from being created.
  await sendNotification({
    title: `New drive: ${input.companyName}`,
    body: `${input.jobRole} · ${input.ctc} LPA — check your eligibility and apply.`,
    audienceType: input.selectedStudentIds.length > 0 ? "selected_students" : "eligible_list",
    filterValue: driveId,
    sentBy: createdByUid,
  }).catch(() => {});
  return driveId;
}

export async function updateDrive(driveId: string, input: DriveFormInput) {
  await update(ref(db, `${DB_NODES.drives}/${driveId}`), {
    companyName: input.companyName,
    jobRole: input.jobRole,
    type: input.type,
    ctc: input.ctc,
    jdUrl: input.jdUrl || null,
    eligibility: input.eligibility,
    selectedStudentIds: input.selectedStudentIds.length > 0 ? input.selectedStudentIds : null,
    roles: input.roles.length > 0 ? input.roles : null,
    rounds: input.rounds,
  });
}

export async function updateDriveStatus(driveId: string, status: DriveStatus) {
  await update(ref(db, `${DB_NODES.drives}/${driveId}`), { status });
}

/** Hard delete — for cleaning up a drive posted by mistake. The caller is
 * responsible for confirming there are no applications first (see the
 * applicantCount check in staff/Drives.tsx): deleting a drive that already
 * has applications/offers/joining reports pointing at its driveId would
 * orphan those records rather than cascade-deleting them, which is exactly
 * the "app crashes on missing drive data" failure mode this app has hit
 * before. Cancel the drive (updateDriveStatus) instead once anyone's applied.
 *
 * Also deletes the auto-notification sent on creation (see createDrive) —
 * leaving it behind wouldn't just be a stale notice, it'd actively become
 * MORE visible than before: useRelevantNotifications resolves an
 * eligible_list/selected_students notification's audience by looking up its
 * driveId, and falls back to showing it to *everyone* when that drive can't
 * be found, since a manually-sent notification with a bad filterValue should
 * still be visible rather than silently dropped. A deleted drive would hit
 * that same fallback, so its notification must go with it. */
export async function deleteDrive(driveId: string) {
  const notifSnap = await get(ref(db, DB_NODES.notifications));
  const notifications = (notifSnap.val() as Record<string, AppNotification> | null) ?? {};
  const updates: Record<string, null> = { [`${DB_NODES.drives}/${driveId}`]: null };
  for (const [notificationId, n] of Object.entries(notifications)) {
    if (n.audience?.filterValue === driveId) updates[`${DB_NODES.notifications}/${notificationId}`] = null;
  }
  await update(ref(db), updates);
}
