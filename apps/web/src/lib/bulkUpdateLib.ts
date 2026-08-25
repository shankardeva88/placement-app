import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, Student } from "@placement-app/types";
import { normalizeHeader, parseDepartment, parseEntranceType, parseGender, parseIndianDate, parseNumber } from "./bulkImportLib";

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);

/** Fields this tool can fill in on an EXISTING student record — the ones
 * the placement team's roster commonly carries beyond what bulk import
 * already seeds. Deliberately smaller than the full Student type: fields
 * with their own side effects (skills, certifications, resumeUrl, ...) stay
 * student-self-edit-only (see PersonalDetails.tsx / database.rules.json),
 * and cgpa/activeBacklogs/currentSemester already have a dedicated
 * "recently updated" flow via the student's own Academic Record page. */
export const UPDATABLE_FIELDS = [
  "name",
  "email",
  "department",
  "batchYear",
  "currentSemester",
  "tenthPercentage",
  "tenthSchool",
  "tenthYearOfPassing",
  "twelfthPercentage",
  "twelfthSchool",
  "twelfthYearOfPassing",
  "entranceType",
  "entranceRank",
  "studentPhone",
  "personalEmail",
  "parentName",
  "parentPhone",
  "address",
  "state",
  "dateOfBirth",
  "gender",
  "photoUrl",
] as const;
export type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

const HEADER_MAP: Record<string, UpdatableField> = {
  [normalizeHeader("Name")]: "name",
  [normalizeHeader("Full Name")]: "name",
  [normalizeHeader("Email")]: "email",
  [normalizeHeader("College Email")]: "email",
  [normalizeHeader("Department")]: "department",
  [normalizeHeader("Branch")]: "department",
  [normalizeHeader("Dept")]: "department",
  [normalizeHeader("Batch Year")]: "batchYear",
  [normalizeHeader("Batch")]: "batchYear",
  [normalizeHeader("Current Semester")]: "currentSemester",
  [normalizeHeader("Semester")]: "currentSemester",
  [normalizeHeader("10th Percentage")]: "tenthPercentage",
  [normalizeHeader("Tenth Percentage")]: "tenthPercentage",
  [normalizeHeader("X Class Percentage %")]: "tenthPercentage",
  [normalizeHeader("10th School")]: "tenthSchool",
  [normalizeHeader("Tenth School")]: "tenthSchool",
  [normalizeHeader("10th Year Of Passing")]: "tenthYearOfPassing",
  [normalizeHeader("12th Percentage")]: "twelfthPercentage",
  [normalizeHeader("Twelfth Percentage")]: "twelfthPercentage",
  [normalizeHeader("XII/Diploma Percentage %")]: "twelfthPercentage",
  [normalizeHeader("12th School")]: "twelfthSchool",
  [normalizeHeader("Twelfth School")]: "twelfthSchool",
  [normalizeHeader("12th Year Of Passing")]: "twelfthYearOfPassing",
  [normalizeHeader("Entrance Type")]: "entranceType",
  [normalizeHeader("EAMCET/ECET")]: "entranceType",
  [normalizeHeader("Rank")]: "entranceRank",
  [normalizeHeader("Entrance Rank")]: "entranceRank",
  [normalizeHeader("Student Phone")]: "studentPhone",
  [normalizeHeader("Phone")]: "studentPhone",
  [normalizeHeader("Phone Number")]: "studentPhone",
  [normalizeHeader("Mobile")]: "studentPhone",
  [normalizeHeader("Personal Email")]: "personalEmail",
  [normalizeHeader("Parent Name")]: "parentName",
  [normalizeHeader("Guardian Name")]: "parentName",
  [normalizeHeader("Parent Phone")]: "parentPhone",
  [normalizeHeader("Guardian Phone")]: "parentPhone",
  [normalizeHeader("Address")]: "address",
  [normalizeHeader("State")]: "state",
  [normalizeHeader("Date Of Birth")]: "dateOfBirth",
  [normalizeHeader("DOB")]: "dateOfBirth",
  [normalizeHeader("Gender")]: "gender",
  [normalizeHeader("Photo")]: "photoUrl",
  [normalizeHeader("Photo URL")]: "photoUrl",
  [normalizeHeader("Photo Link")]: "photoUrl",
  [normalizeHeader("Profile Photo")]: "photoUrl",
};
// Every UPDATABLE_FIELDS name itself is also a recognized header (matches
// the exact field names — this tool's own doc/instructions use them, so a
// sheet built by following that naming works without any alias lookup).
for (const field of UPDATABLE_FIELDS) HEADER_MAP[normalizeHeader(field)] = field;

// Checked before HEADER_MAP (and returned on early) in parseStudentUpdateRows
// — roll number is the match key, not a field to write, so it must never
// fall through to a HEADER_MAP lookup.
const ROLL_NO_HEADERS = new Set([normalizeHeader("Roll No"), normalizeHeader("Roll Number"), normalizeHeader("rollNo")]);

export interface ParsedUpdateRow {
  rowIndex: number;
  rollNo: string;
  values: Partial<Record<UpdatableField, string | number>>;
  warnings: string[];
  errors: string[];
}

export interface ParseUpdateResult {
  rows: ParsedUpdateRow[];
  unmappedHeaders: string[];
}

/** Unlike bulk import, every column here is optional — a row only needs a
 * roll number to match against. Blank cells are simply not included in
 * `values`, so applyStudentUpdate never overwrites existing data with an
 * empty value (this tool is for filling in *pending* fields the placement
 * team supplied, not for blanking out ones they didn't). */
export function parseStudentUpdateRows(headers: string[], rawRows: string[][]): ParseUpdateResult {
  let rollNoIndex = -1;
  const fieldIndex: Partial<Record<UpdatableField, number>> = {};
  const unmappedHeaders: string[] = [];

  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (ROLL_NO_HEADERS.has(key)) {
      rollNoIndex = i;
      return;
    }
    const field = HEADER_MAP[key];
    if (field) fieldIndex[field] = i;
    else if (h.trim()) unmappedHeaders.push(h);
  });

  const get = (row: string[], i: number | undefined) => (i != null ? (row[i] ?? "").trim() : "");

  const rows = rawRows.map((row, i): ParsedUpdateRow => {
    const warnings: string[] = [];
    const errors: string[] = [];
    const rollNo = get(row, rollNoIndex);
    if (!rollNo) errors.push("Missing roll number");

    const values: Partial<Record<UpdatableField, string | number>> = {};

    function setIfPresent(field: UpdatableField, transform?: (raw: string) => { value: string | number | undefined; warning?: string }) {
      const raw = get(row, fieldIndex[field]);
      if (!raw) return;
      if (!transform) {
        values[field] = raw;
        return;
      }
      const { value, warning } = transform(raw);
      if (warning) warnings.push(warning);
      if (value !== undefined) values[field] = value;
    }

    setIfPresent("name");
    setIfPresent("email");
    setIfPresent("department", (raw) => {
      const { value, warning } = parseDepartment(raw);
      return { value, warning };
    });
    setIfPresent("batchYear", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `Batch year "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("currentSemester", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `Current semester "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("tenthPercentage", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `10th percentage "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("tenthSchool");
    setIfPresent("tenthYearOfPassing", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `10th year of passing "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("twelfthPercentage", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `12th percentage "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("twelfthSchool");
    setIfPresent("twelfthYearOfPassing", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `12th year of passing "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("entranceType", (raw) => {
      const { value, warning } = parseEntranceType(raw);
      return { value, warning };
    });
    setIfPresent("entranceRank", (raw) => {
      const n = parseNumber(raw);
      return n == null ? { value: undefined, warning: `Entrance rank "${raw}" isn't a number — skipped` } : { value: n };
    });
    setIfPresent("studentPhone");
    setIfPresent("personalEmail");
    setIfPresent("parentName");
    setIfPresent("parentPhone");
    setIfPresent("address");
    setIfPresent("state");
    setIfPresent("dateOfBirth", (raw) => {
      const ts = parseIndianDate(raw);
      return ts == null ? { value: undefined, warning: `Date of birth "${raw}" couldn't be parsed — skipped` } : { value: ts };
    });
    setIfPresent("gender", (raw) => {
      const { value, warning } = parseGender(raw);
      return { value, warning };
    });
    setIfPresent("photoUrl");

    if (Object.keys(values).length === 0 && !errors.length) warnings.push("No recognized fields with data in this row — nothing to update");

    return { rowIndex: i + 1, rollNo, values, warnings, errors };
  });

  return { rows, unmappedHeaders };
}

export interface ApplyUpdateResult {
  changedFields: string[];
  skippedFields: string[]; // present in `values` but not written — see below
}

/** Writes only the fields present in `values`, using the signed-in staff
 * member's own session — no secondary-auth trick needed, since
 * database.rules.json already grants department-matched staff full write
 * access to any student record in their own department (the same rule that
 * lets a coordinator edit a student's details from StudentDetail.tsx).
 *
 * A department change needs its own departmentIndex fixup (add under the
 * new department, remove from the old) — just writing the `department`
 * field would leave the student indexed under their old department, so
 * their new department's coordinator could never find them via
 * departmentIndex, and their old department's coordinator would still see
 * a stale entry. Writing the NEW department's index entry needs the actor's
 * own /users department to match that new department (or an institution
 * role) — a coordinator moving a student OUT of their own department into
 * someone else's has no such access, and since update() is one atomic
 * multi-path write, attempting it anyway would deny every other field in
 * the same row too. Checked up front and skipped (reported, not silently
 * dropped) rather than risking that.
 *
 * `email` here is only the denormalized copy on /students (see the
 * Student.email doc comment) — it deliberately does NOT also write
 * /users/{uid}/email. That path has no department-matched-staff write rule
 * (only the carved-out `isActive` field does — see database.rules.json), so
 * attempting it would hit the same atomic-failure risk as the department
 * case above. It's also not the student's real Firebase Auth login
 * credential either way, just a second display copy — so leaving it
 * unmirrored is a smaller inconsistency than breaking the whole row. */
export async function applyStudentUpdate(
  existing: Student,
  values: ParsedUpdateRow["values"],
  actor: { role: string; department?: Department }
): Promise<ApplyUpdateResult> {
  let changedFields = (Object.keys(values) as UpdatableField[]).filter(
    (field) => String(values[field]) !== String(existing[field as keyof Student] ?? "")
  );

  const skippedFields: string[] = [];
  const newDept = values.department as Department | undefined;
  const movingDept = !!newDept && newDept !== existing.department && changedFields.includes("department");
  const canMoveDept = INSTITUTION_ROLES.has(actor.role) || actor.department === newDept;
  if (movingDept && !canMoveDept) {
    skippedFields.push("department");
    changedFields = changedFields.filter((f) => f !== "department");
  }

  if (changedFields.length === 0) return { changedFields, skippedFields };

  const updates: Record<string, unknown> = { [`${DB_NODES.students}/${existing.uid}/updatedAt`]: serverTimestamp() };
  for (const field of changedFields) updates[`${DB_NODES.students}/${existing.uid}/${field}`] = values[field];

  if (movingDept && canMoveDept) {
    updates[`${DB_NODES.departmentIndex}/${existing.department}/${existing.uid}`] = null;
    updates[`${DB_NODES.departmentIndex}/${newDept}/${existing.uid}`] = true;
  }

  await update(ref(db), updates);
  return { changedFields, skippedFields };
}
