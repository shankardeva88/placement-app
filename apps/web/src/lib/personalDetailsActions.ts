import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { BloodGroup, Gender } from "@placement-app/types";

export interface PersonalDetailsInput {
  studentPhone: string;
  personalEmail: string;
  parentName: string;
  parentPhone: string;
  alternatePhone: string;

  address: string;
  city: string;
  state: string;
  pincode: string;

  dateOfBirth: number | null;
  gender: Gender | "";
  bloodGroup: BloodGroup | "";

  tenthPercentage: number | null;
  tenthSchool: string;
  tenthBoard: string;
  tenthYearOfPassing: number | null;

  twelfthPercentage: number | null;
  twelfthSchool: string;
  twelfthBoard: string;
  twelfthYearOfPassing: number | null;

  diplomaPercentage: number | null;
  diplomaSchool: string;
  diplomaBoard: string;
  diplomaYearOfPassing: number | null;

  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  photoUrl: string;

  skills: string[];
  certifications: { name: string; url?: string }[];
}

/** Every field this writes has its own scoped self-write bypass in
 * database.rules.json (students/$studentId), so this stays editable even
 * after verifiedByFaculty locks the rest of the record — bulk-imported
 * students (bulkImportLib.ts) start out verified with none of this filled
 * in, so they need it to remain writable, not just students verified later. */
export async function updatePersonalDetails(uid: string, input: PersonalDetailsInput) {
  await update(ref(db, `${DB_NODES.students}/${uid}`), {
    ...input,
    updatedAt: serverTimestamp(),
    // Skills/certifications/resume link live in this form, so any save here
    // counts as a placement-critical update — see the doc comment on
    // Student.lastSignificantUpdateAt.
    lastSignificantUpdateAt: serverTimestamp(),
  });
}
