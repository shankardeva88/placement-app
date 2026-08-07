import { useEffect, useState } from "react";
import { ref, push, onValue, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AlumniPlacementStatus, Department, Drive, Offer, PlacementStatus, Student } from "@placement-app/types";

/** Drives are readable by any signed-in user (see database.rules.json), so a
 * plain root subscription is enough — no dept-scoping needed, same as the
 * private copy of this hook in MentorTools.tsx. */
export function useDrivesById(): Record<string, Drive> | null {
  const [drives, setDrives] = useState<Record<string, Drive> | null>(null);
  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);
  return drives;
}

export const PLACEMENT_STATUS_MAP: Record<PlacementStatus, AlumniPlacementStatus> = {
  placed: "placed",
  multiple_offers: "placed",
  opted_higher_studies: "higher_studies",
  not_placed: "unplaced",
  opted_out: "unplaced",
};

/** Prefers an accepted offer (that's what "placed" actually means); among
 * ties — e.g. a multiple_offers student who accepted only one — picks the
 * highest CTC one if somehow more than one is marked accepted. */
function bestOffer(offers: Offer[]): Offer | null {
  const accepted = offers.filter((o) => o.status === "accepted");
  const pool = accepted.length > 0 ? accepted : offers;
  if (pool.length === 0) return null;
  return pool.reduce((best, o) => (o.ctc > best.ctc ? o : best), pool[0]);
}

export interface GraduateBatchCandidate {
  student: Student;
  offer: Offer | null;
  drive: Drive | null;
}

/** Students in the given department + batch year that aren't alumni yet —
 * the pool a "graduate this batch" action would act on. */
export function buildGraduateBatchCandidates(
  students: Student[],
  department: Department,
  batchYear: number,
  offers: Offer[],
  drivesById: Record<string, Drive>
): GraduateBatchCandidate[] {
  return students
    .filter((s) => s.department === department && s.batchYear === batchYear && !s.isAlumni)
    .map((student) => {
      const offer = bestOffer(offers.filter((o) => o.studentId === student.uid));
      const drive = offer ? drivesById[offer.driveId] ?? null : null;
      return { student, offer, drive };
    })
    .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo));
}

/** Archives each candidate into `alumni` (prefilled from their Student
 * record + best offer/drive) and flips `isAlumni` on the Student record —
 * deliberately NOT a delete: mentorMapping, attendance, mock evaluations,
 * offers etc. all still reference the student's uid, and historical reports
 * need those lookups to keep resolving. `isAlumni` is what active-view
 * pickers (Students list, batch/mentor rosters) filter on to keep graduated
 * batches from cluttering current-student workflows — see AlumniRecord's
 * doc comment in packages/types for why alumni is a separate node at all. */
export async function graduateBatch(candidates: GraduateBatchCandidate[], actorUid: string): Promise<number> {
  const updates: Record<string, unknown> = {};
  const now = Date.now();

  for (const { student, offer, drive } of candidates) {
    const alumniId = push(ref(db, DB_NODES.alumni)).key as string;
    const record: Record<string, unknown> = {
      alumniId,
      rollNo: student.rollNo,
      name: student.name,
      department: student.department,
      batchYear: student.batchYear,
      placementStatus: PLACEMENT_STATUS_MAP[student.placementStatus],
      addedBy: actorUid,
      createdAt: now,
      updatedAt: now,
    };
    if (student.cgpa != null) record.cgpa = student.cgpa;
    if (offer) {
      record.ctc = offer.ctc;
      record.designation = offer.designation;
      if (offer.offerLetterUrl) record.offerLetterUrl = offer.offerLetterUrl;
    }
    if (drive) record.companyName = drive.companyName;
    if (student.studentPhone) record.contactPhone = student.studentPhone;
    const email = student.personalEmail || student.email;
    if (email) record.contactEmail = email;

    updates[`${DB_NODES.alumni}/${alumniId}`] = record;
    updates[`${DB_NODES.students}/${student.uid}/isAlumni`] = true;
  }

  await update(ref(db), updates);
  return candidates.length;
}
