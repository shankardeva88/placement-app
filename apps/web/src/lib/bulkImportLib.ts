import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { ref, update, get, serverTimestamp } from "firebase/database";
import { db, firebaseConfig } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, EntranceExamType, Gender } from "@placement-app/types";

/** Column headers this expects, normalized (lowercased, punctuation/spaces
 * stripped) so minor formatting differences in a pasted sheet still match.
 * Keyed to the exact columns from the source roster (roll number, name,
 * gender, branch, CGPA, backlogs, passout year, phone, DOB, 10th/12th
 * percentage+year, college email, personal email, resume link). */
export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_MAP: Record<string, string> = {
  [normalizeHeader("Roll Number")]: "rollNo",
  [normalizeHeader("Full Name(As per Aadhar)")]: "name",
  [normalizeHeader("Gender")]: "gender",
  [normalizeHeader("Branch")]: "department",
  [normalizeHeader("DEPT")]: "department",
  [normalizeHeader("B.Tech CGPA")]: "cgpa",
  [normalizeHeader("CGPA")]: "cgpa",
  [normalizeHeader("Backlogs")]: "activeBacklogs",
  [normalizeHeader("Year of Passedout")]: "batchYear",
  [normalizeHeader("Batch")]: "batchYear",
  [normalizeHeader("Phone Number")]: "studentPhone",
  [normalizeHeader("Date of Birth")]: "dateOfBirth",
  [normalizeHeader("X Class Percentage %")]: "tenthPercentage",
  [normalizeHeader("X Class Year of passing")]: "tenthYearOfPassing",
  [normalizeHeader("XII/Diploma Percentage %")]: "twelfthPercentage",
  [normalizeHeader("XII/Diploma Year of passing")]: "twelfthYearOfPassing",
  [normalizeHeader("Email Address (College Domain Mail ID)")]: "email",
  [normalizeHeader("Email")]: "email",
  [normalizeHeader("Personal Email")]: "personalEmail",
  [normalizeHeader("Entrance Type")]: "entranceType",
  [normalizeHeader("EAMCET/ECET")]: "entranceType",
  [normalizeHeader("Rank")]: "entranceRank",
  [normalizeHeader("Entrance Rank")]: "entranceRank",
  [normalizeHeader("Resume Link (It should be accessible by everyone)")]: "resumeUrl",
  // Password is always the roll number (see createBulkStudent) — mapped here
  // only so a "Password" column in the sheet doesn't show up as unmapped;
  // parseStudentRows below warns if it's present but doesn't match the roll number.
  [normalizeHeader("Password")]: "password",
};

const DEPARTMENT_ALIASES: Record<string, Department> = {
  cse: "CSE",
  computerscience: "CSE",
  computerscienceengineering: "CSE",
  ece: "ECE",
  electronicsandcommunication: "ECE",
  electronicsandcommunicationengineering: "ECE",
  eee: "EEE",
  electricalandelectronics: "EEE",
  electricalandelectronicsengineering: "EEE",
  mech: "MECH",
  mechanical: "MECH",
  mechanicalengineering: "MECH",
  civil: "CIVIL",
  civilengineering: "CIVIL",
  it: "IT",
  informationtechnology: "IT",
  aiml: "AIML",
  aiandml: "AIML",
  artificialintelligenceandmachinelearning: "AIML",
  aids: "AIDS",
  aianddatascience: "AIDS",
  artificialintelligenceanddatascience: "AIDS",
};

export function parseDepartment(raw: string): { value: Department; warning?: string } {
  const key = normalizeHeader(raw);
  const mapped = DEPARTMENT_ALIASES[key];
  if (mapped) return { value: mapped };
  return { value: "OTHER", warning: `Branch "${raw}" not recognized — set to OTHER, please fix manually` };
}

export function parseGender(raw: string): { value: Gender; warning?: string } {
  const key = normalizeHeader(raw);
  if (["m", "male"].includes(key)) return { value: "male" };
  if (["f", "female"].includes(key)) return { value: "female" };
  if (["o", "other"].includes(key)) return { value: "other" };
  if (!key) return { value: "prefer_not_to_say" };
  return { value: "prefer_not_to_say", warning: `Gender "${raw}" not recognized` };
}

export function parseEntranceType(raw: string): { value: EntranceExamType | undefined; warning?: string } {
  const key = normalizeHeader(raw);
  if (!key) return { value: undefined };
  if (key === "eamcet") return { value: "EAMCET" };
  if (key === "ecet") return { value: "ECET" };
  return { value: undefined, warning: `Entrance type "${raw}" not recognized — expected EAMCET or ECET, left blank` };
}

/** Indian sheets are almost always DD/MM/YYYY, not the US MM/DD/YYYY that
 * Date.parse assumes — parsing that ambiguity wrong silently swaps day and
 * month, so this parses DD/MM/YYYY explicitly first. */
export function parseIndianDate(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(/[/.-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y > 1900) {
      const date = new Date(y, m - 1, d);
      if (!isNaN(date.getTime())) return date.getTime();
    }
  }
  const fallback = Date.parse(trimmed);
  return isNaN(fallback) ? undefined : fallback;
}

export function parseNumber(raw: string): number | undefined {
  const n = parseFloat(raw.trim());
  return isNaN(n) ? undefined : n;
}

export interface ParsedStudentRow {
  rowIndex: number; // 1-based within the pasted data, for error display
  rollNo: string;
  name: string;
  gender: Gender;
  department: Department;
  cgpa: number;
  activeBacklogs: number;
  batchYear: number;
  studentPhone: string;
  dateOfBirth?: number;
  tenthPercentage?: number;
  tenthYearOfPassing?: number;
  twelfthPercentage?: number;
  twelfthYearOfPassing?: number;
  entranceType?: EntranceExamType;
  entranceRank?: string; // usually numeric, but can be a category like "SPOT" or "BCAT" — see the Student.entranceRank doc comment
  email: string; // college email — becomes the login
  personalEmail: string;
  resumeUrl: string;
  warnings: string[];
  errors: string[]; // non-empty means this row can't be imported as-is
}

export interface ParseResult {
  rows: ParsedStudentRow[];
  unmappedHeaders: string[];
}

export function parseStudentRows(headers: string[], rawRows: string[][]): ParseResult {
  const fieldIndex: Record<string, number> = {};
  const unmappedHeaders: string[] = [];
  headers.forEach((h, i) => {
    const field = HEADER_MAP[normalizeHeader(h)];
    if (field) fieldIndex[field] = i;
    else if (h.trim()) unmappedHeaders.push(h);
  });

  const get = (row: string[], field: string) => (fieldIndex[field] != null ? (row[fieldIndex[field]] ?? "").trim() : "");

  const rows = rawRows.map((row, i): ParsedStudentRow => {
    const warnings: string[] = [];
    const errors: string[] = [];

    const rollNo = get(row, "rollNo");
    if (!rollNo) errors.push("Missing roll number");
    if (rollNo && rollNo.length < 6) warnings.push("Roll number is under 6 characters — it's used as the temporary password, Firebase requires 6+");

    const passwordCol = get(row, "password");
    if (passwordCol && passwordCol !== rollNo) warnings.push(`Password column "${passwordCol}" ignored — login password is always the roll number`);

    const name = get(row, "name");
    if (!name) errors.push("Missing name");

    const email = get(row, "email");
    if (!email || !email.includes("@")) errors.push("Missing or invalid college email");

    const { value: department, warning: deptWarning } = parseDepartment(get(row, "department"));
    if (deptWarning) warnings.push(deptWarning);

    const { value: gender, warning: genderWarning } = parseGender(get(row, "gender"));
    if (genderWarning) warnings.push(genderWarning);

    const cgpaRaw = get(row, "cgpa");
    const cgpa = parseNumber(cgpaRaw);
    if (cgpa == null) errors.push(`CGPA "${cgpaRaw}" isn't a number`);

    const backlogsRaw = get(row, "activeBacklogs");
    const activeBacklogs = backlogsRaw ? parseNumber(backlogsRaw) : 0;
    if (activeBacklogs == null) warnings.push(`Backlogs "${backlogsRaw}" isn't a number — set to 0`);

    const batchYearRaw = get(row, "batchYear");
    const batchYear = parseNumber(batchYearRaw);
    // Blocking, not a warning: this used to silently fall back to the
    // current calendar year, which is wrong for every student it applied to
    // (their actual passout year) and quietly split the roster across two
    // batches — see the database.rules.json / StudentMasterReport batch
    // filter conversation. Treat a bad value the same as a bad rollNo/name/CGPA.
    if (batchYear == null) errors.push(`Passout year "${batchYearRaw}" isn't a number`);

    const dateOfBirth = parseIndianDate(get(row, "dateOfBirth"));
    if (get(row, "dateOfBirth") && !dateOfBirth) warnings.push("Date of birth couldn't be parsed");

    const tenthPercentage = parseNumber(get(row, "tenthPercentage"));
    const tenthYearOfPassing = parseNumber(get(row, "tenthYearOfPassing"));
    const twelfthPercentage = parseNumber(get(row, "twelfthPercentage"));
    const twelfthYearOfPassing = parseNumber(get(row, "twelfthYearOfPassing"));

    const { value: entranceType, warning: entranceTypeWarning } = parseEntranceType(get(row, "entranceType"));
    if (entranceTypeWarning) warnings.push(entranceTypeWarning);
    // Free text — usually a number, but "SPOT"/"BCAT" for category-admitted
    // students who were never assigned an entrance exam rank at all.
    const entranceRank = get(row, "entranceRank") || undefined;

    const resumeUrl = get(row, "resumeUrl");
    if (!resumeUrl) warnings.push("No resume link");

    return {
      rowIndex: i + 1,
      rollNo,
      name,
      gender,
      department,
      cgpa: cgpa ?? 0,
      activeBacklogs: activeBacklogs ?? 0,
      batchYear: batchYear ?? 0, // never used: batchYear==null already pushed a blocking error above
      studentPhone: get(row, "studentPhone"),
      dateOfBirth,
      tenthPercentage,
      tenthYearOfPassing,
      twelfthPercentage,
      twelfthYearOfPassing,
      entranceType,
      entranceRank,
      email,
      personalEmail: get(row, "personalEmail"),
      resumeUrl,
      warnings,
      errors,
    };
  });

  return { rows, unmappedHeaders };
}

export type CreateBulkStudentResult = { uid: string } | { alreadyExists: true } | { error: string };

/** Same secondary-app technique as createStaffAccount (in staffAuthActions.ts)
 * — creating a user on the primary auth instance would sign the admin out.
 * Password is the roll number (confirmed choice — students change it after
 * first login; there's no backend to force-reset it to the roll number later,
 * only the standard Firebase "forgot password" email flow going forward). */
export async function createBulkStudent(row: ParsedStudentRow): Promise<CreateBulkStudentResult> {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const secondaryAuth = getAuth(secondaryApp);

    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, row.email, row.rollNo);
      uid = cred.user.uid;
    } catch (createErr) {
      // "email-already-in-use" almost always means a previous import attempt
      // created this Auth login but never finished the DB write (rules
      // rejection, closed tab, dropped connection mid-import) — an orphaned
      // account with the roll number still as its password. Recover it by
      // signing in rather than reporting a false "already exists" failure.
      const code = (createErr as { code?: string }).code;
      if (code !== "auth/email-already-in-use") throw createErr;
      const cred = await signInWithEmailAndPassword(secondaryAuth, row.email, row.rollNo);
      uid = cred.user.uid;
    }

    const existing = await get(ref(db, `${DB_NODES.students}/${uid}`));
    if (existing.exists()) {
      await signOut(secondaryAuth);
      return { alreadyExists: true };
    }

    try {
      await writeStudentRecords(uid, row);
    } catch (writeErr) {
      // The auth account exists but has no /users or /students record — a
      // dept-scoped coordinator importing a row for a different department
      // hits exactly this (rules deny the write after the account already
      // exists). Delete it rather than leave an orphaned login with no
      // profile and an email that's now permanently "taken".
      await secondaryAuth.currentUser?.delete().catch(() => {});
      throw writeErr;
    }

    await signOut(secondaryAuth);
    return { uid };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  } finally {
    await deleteApp(secondaryApp);
  }
}

async function writeStudentRecords(uid: string, row: ParsedStudentRow) {
    const studentRecord: Record<string, unknown> = {
      studentId: uid,
      uid,
      campusId: "main",
      rollNo: row.rollNo,
      name: row.name,
      email: row.email,
      department: row.department,
      batchYear: row.batchYear,
      currentSemester: 8, // final year, per the source roster being the current passout batch
      cgpa: row.cgpa,
      activeBacklogs: row.activeBacklogs,
      gender: row.gender,
      skills: [],
      profileComplete: true,
      placementStatus: "not_placed",
      isAlumni: false,
      verifiedByFaculty: true, // sourced from the college's own official roster, not self-reported
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (row.studentPhone) studentRecord.studentPhone = row.studentPhone;
    if (row.personalEmail) studentRecord.personalEmail = row.personalEmail;
    if (row.dateOfBirth) studentRecord.dateOfBirth = row.dateOfBirth;
    if (row.tenthPercentage != null) studentRecord.tenthPercentage = row.tenthPercentage;
    if (row.tenthYearOfPassing != null) studentRecord.tenthYearOfPassing = row.tenthYearOfPassing;
    if (row.twelfthPercentage != null) studentRecord.twelfthPercentage = row.twelfthPercentage;
    if (row.twelfthYearOfPassing != null) studentRecord.twelfthYearOfPassing = row.twelfthYearOfPassing;
    if (row.entranceType) studentRecord.entranceType = row.entranceType;
    if (row.entranceRank) studentRecord.entranceRank = row.entranceRank;
    if (row.resumeUrl) studentRecord.resumeUrl = row.resumeUrl;

    await update(ref(db), {
      [`${DB_NODES.users}/${uid}`]: {
        uid,
        email: row.email,
        name: row.name,
        role: "student",
        campusId: "main",
        createdAt: serverTimestamp(),
        isActive: true,
      },
      [`${DB_NODES.students}/${uid}`]: studentRecord,
      [`${DB_NODES.departmentIndex}/${row.department}/${uid}`]: true,
    });
}
