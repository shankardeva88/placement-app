import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";

export interface AcademicRecordInput {
  semesterWiseSgpa: Record<string, number>;
  cgpa: number;
  activeBacklogs: number;
  currentSemester: number;
}

/** Scoped update() touching only the fields the students/$id child-write
 * rules permit — keeps working even after verifiedByFaculty locks the rest
 * of the record (see database.rules.json). */
export async function updateAcademicRecord(uid: string, input: AcademicRecordInput) {
  await update(ref(db, `${DB_NODES.students}/${uid}`), {
    ...input,
    updatedAt: serverTimestamp(),
    // Semester-wise SGPA/CGPA/backlogs are placement-critical — see the doc
    // comment on Student.lastSignificantUpdateAt.
    lastSignificantUpdateAt: serverTimestamp(),
  });
}
