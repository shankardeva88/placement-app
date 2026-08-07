import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, Student } from "@placement-app/types";

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/** minPri isn't checked yet — Placement Readiness Index isn't computed
 * anywhere in the app yet (see ReadinessScore comment in the types package).
 * When a drive has selectedStudentIds set, that list is the sole gate —
 * criteria don't apply at all (see the Drive.selectedStudentIds doc
 * comment in packages/types). */
export function checkEligibility(student: Student, drive: Drive): EligibilityResult {
  if (drive.selectedStudentIds && drive.selectedStudentIds.length > 0) {
    return drive.selectedStudentIds.includes(student.uid)
      ? { eligible: true, reasons: [] }
      : { eligible: false, reasons: ["Not on the selected list for this drive"] };
  }

  const criteria = drive.eligibility;
  const reasons: string[] = [];

  if (student.cgpa < criteria.minCgpa) {
    reasons.push(`CGPA ${student.cgpa} is below the required ${criteria.minCgpa}`);
  }
  if (student.activeBacklogs > criteria.maxBacklogsAllowed) {
    reasons.push(
      `${student.activeBacklogs} active backlog(s) — max allowed is ${criteria.maxBacklogsAllowed}`
    );
  }
  if (criteria.departments.length > 0 && !criteria.departments.includes(student.department)) {
    reasons.push(`${student.department} is not an eligible department`);
  }
  if (criteria.batchYears.length > 0 && !criteria.batchYears.includes(student.batchYear)) {
    reasons.push(`Batch year ${student.batchYear} is not eligible`);
  }
  if (criteria.requiredSkills && criteria.requiredSkills.length > 0) {
    const missing = criteria.requiredSkills.filter((skill) => !(student.skills ?? []).includes(skill));
    if (missing.length > 0) {
      reasons.push(`Missing required skill(s): ${missing.join(", ")}`);
    }
  }
  if (criteria.requiredTrainings && criteria.requiredTrainings.length > 0) {
    const missing = criteria.requiredTrainings.filter((t) => !(student.trainings ?? {})[t]);
    if (missing.length > 0) {
      reasons.push(`Missing required training(s): ${missing.join(", ")}`);
    }
  }
  if (criteria.gender && criteria.gender !== "any" && student.gender !== criteria.gender) {
    reasons.push(`This drive is restricted to ${criteria.gender} candidates`);
  }

  return { eligible: reasons.length === 0, reasons };
}

/** What a coordinator types when a company says "minimum X%" — Indian
 * colleges commonly convert a flat CGPA to percentage as CGPA × 9.5, so
 * that's the basis used here (confirmed choice; not a universal formula). */
export function cgpaToPercent(cgpa: number): number {
  return Math.round(cgpa * 9.5 * 10) / 10;
}
export function percentToCgpa(percent: number): number {
  return Math.round((percent / 9.5) * 100) / 100;
}

/** Deterministic id (studentUid_driveId) instead of a push id — lets a
 * student check "did I already apply to this drive" with a direct read of
 * a known path, since RTDB rules only grant students read/write on
 * applications they own, not a query over the whole /applications list. */
export function applicationIdFor(studentUid: string, driveId: string) {
  return `${studentUid}_${driveId}`;
}

export async function applyToDrive(student: Student, drive: Drive) {
  const applicationId = applicationIdFor(student.uid, drive.driveId);
  await update(ref(db), {
    [`${DB_NODES.applications}/${applicationId}`]: {
      applicationId,
      studentId: student.uid,
      department: student.department,
      driveId: drive.driveId,
      status: "applied",
      resumeUrlSnapshot: student.resumeUrl ?? "",
      appliedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    [`${DB_NODES.applicationsDeptIndex}/${student.department}/${applicationId}`]: true,
  });
}
