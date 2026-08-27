import type { Application, Drive, DriveRole, DriveType } from "@placement-app/types";

export const DRIVE_TYPE_LABEL: Record<DriveType, string> = {
  full_time: "Full time",
  internship: "Internship",
  internship_plus_full_time: "Internship + Full time",
};

/** Every drive has a primary role (jobRole/ctc on the Drive itself);
 * Drive.roles holds any additional named roles beyond that one. This
 * always returns the full list — primary first — so callers never need to
 * special-case "is this a multi-role drive". */
export function allDriveRoles(drive: Drive): DriveRole[] {
  return [{ roleId: "primary", jobRole: drive.jobRole, ctc: drive.ctc }, ...(drive.roles ?? [])];
}

export function isMultiRole(drive: Drive): boolean {
  return !!drive.roles && drive.roles.length > 0;
}

/** application.roleId is undefined for the primary role — "primary" here
 * is just this module's internal id for it, never written to the DB. */
export function roleForApplication(drive: Drive, roleId: string | undefined): DriveRole {
  if (!roleId || roleId === "primary") return { roleId: "primary", jobRole: drive.jobRole, ctc: drive.ctc };
  return drive.roles?.find((r) => r.roleId === roleId) ?? { roleId: "primary", jobRole: drive.jobRole, ctc: drive.ctc };
}

/** Roll-call summary for places that just want one line of text (dashboard
 * lists, report tables) rather than a full role picker. */
export function driveRoleSummary(drive: Drive): string {
  if (!isMultiRole(drive)) return drive.jobRole;
  return allDriveRoles(drive)
    .map((r) => r.jobRole)
    .join(", ");
}

export function driveCtcSummary(drive: Drive): string {
  if (!isMultiRole(drive)) return `${drive.ctc} LPA`;
  const ctcs = allDriveRoles(drive).map((r) => r.ctc);
  const min = Math.min(...ctcs);
  const max = Math.max(...ctcs);
  return min === max ? `${min} LPA` : `${min}–${max} LPA`;
}

export function applicationRoleLabel(drive: Drive, application: Application): string {
  return roleForApplication(drive, application.roleId).jobRole;
}
