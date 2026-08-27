import { ref, push, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, Internship, InternshipMode, InternshipStatus } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";

export function useAllInternships(appUser: AppUser | null): Internship[] | null {
  return useDeptScopedCollection<Internship>(appUser, DB_NODES.internships, DB_NODES.internshipsDeptIndex);
}

export interface RecordInternshipInput {
  studentId: string;
  department: Department;
  companyName: string;
  role: string;
  durationMonths: number;
  startDate: number;
  stipend?: number;
  mode?: InternshipMode;
  status: InternshipStatus;
  offerLetterUrl?: string;
  completionCertificateUrl?: string;
  createdBy: string;
}

/** Many-per-student, no natural composite key — push id + studentIndex
 * entry, same pattern as recordResumeReview in mentorToolsLib.ts. */
export async function recordInternship(input: RecordInternshipInput) {
  const newRef = push(ref(db, DB_NODES.internships));
  const internshipId = newRef.key as string;
  const record: Record<string, unknown> = {
    internshipId,
    studentId: input.studentId,
    department: input.department,
    companyName: input.companyName,
    role: input.role,
    durationMonths: input.durationMonths,
    startDate: input.startDate,
    status: input.status,
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };
  if (input.stipend != null) record.stipend = input.stipend;
  if (input.mode) record.mode = input.mode;
  if (input.offerLetterUrl) record.offerLetterUrl = input.offerLetterUrl;
  if (input.completionCertificateUrl) record.completionCertificateUrl = input.completionCertificateUrl;
  await update(ref(db), {
    [`${DB_NODES.internships}/${internshipId}`]: record,
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.internships}/${internshipId}`]: true,
    [`${DB_NODES.internshipsDeptIndex}/${input.department}/${internshipId}`]: true,
  });
  return internshipId;
}

export interface UpdateInternshipInput {
  companyName: string;
  role: string;
  durationMonths: number;
  startDate: number;
  stipend: number | null;
  mode: InternshipMode | null;
  status: InternshipStatus;
  offerLetterUrl: string | null;
  completionCertificateUrl: string | null;
}

export async function updateInternship(internshipId: string, input: UpdateInternshipInput) {
  await update(ref(db, `${DB_NODES.internships}/${internshipId}`), { ...input });
}

/** Cleans up all three write sites in one atomic update — the record itself
 * plus both index entries — rather than leaving orphaned index pointers
 * behind (see the Nuclei drive stale-application cleanup for why that's
 * worth avoiding). */
export async function deleteInternship(internshipId: string, studentId: string, department: Department) {
  await update(ref(db), {
    [`${DB_NODES.internships}/${internshipId}`]: null,
    [`${DB_NODES.studentIndex}/${studentId}/${DB_NODES.internships}/${internshipId}`]: null,
    [`${DB_NODES.internshipsDeptIndex}/${department}/${internshipId}`]: null,
  });
}
