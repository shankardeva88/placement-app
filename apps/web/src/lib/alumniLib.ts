import { useEffect, useState } from "react";
import { ref, push, set, update, remove, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AlumniPlacementStatus, AlumniRecord, Department } from "@placement-app/types";

export function useAllAlumni(): AlumniRecord[] | null {
  const [alumni, setAlumni] = useState<AlumniRecord[] | null>(null);
  useEffect(() => {
    return onValue(ref(db, DB_NODES.alumni), (snap) => {
      const val = snap.val() as Record<string, AlumniRecord> | null;
      setAlumni(val ? Object.values(val) : []);
    });
  }, []);
  return alumni;
}

export interface AlumniInput {
  rollNo: string;
  name: string;
  department: Department;
  batchYear: number;
  cgpa?: number;
  placementStatus: AlumniPlacementStatus;
  companyName?: string;
  designation?: string;
  ctc?: number;
  offerLetterUrl?: string;
  joiningReportUrl?: string;
  higherStudiesDetails?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

/** set() rejects `undefined` outright, so empty/undefined optional fields
 * are simply omitted from the written object — nothing to clear yet on a
 * brand-new record. */
function omitEmpty(input: AlumniInput) {
  const out: Record<string, unknown> = { ...input };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined || out[key] === "") delete out[key];
  }
  return out;
}

/** update() only touches keys present in the object — omitting a cleared
 * field would leave the old value stuck forever, so an emptied field is
 * explicitly set to `null` (RTDB's delete-this-field value) instead of
 * being left out. */
function nullifyEmpty(input: AlumniInput) {
  const out: Record<string, unknown> = { ...input };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined || out[key] === "") out[key] = null;
  }
  return out;
}

export async function createAlumniRecord(input: AlumniInput, addedBy: string) {
  const newRef = push(ref(db, DB_NODES.alumni));
  const alumniId = newRef.key as string;
  await set(newRef, {
    alumniId,
    ...omitEmpty(input),
    addedBy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return alumniId;
}

export async function updateAlumniRecord(alumniId: string, input: AlumniInput) {
  await update(ref(db, `${DB_NODES.alumni}/${alumniId}`), {
    ...nullifyEmpty(input),
    updatedAt: Date.now(),
  });
}

export async function deleteAlumniRecord(alumniId: string) {
  await remove(ref(db, `${DB_NODES.alumni}/${alumniId}`));
}

export async function bulkImportAlumni(records: AlumniInput[], addedBy: string) {
  const updates: Record<string, unknown> = {};
  const now = Date.now();
  for (const input of records) {
    const alumniId = push(ref(db, DB_NODES.alumni)).key as string;
    updates[`${DB_NODES.alumni}/${alumniId}`] = {
      alumniId,
      ...omitEmpty(input),
      addedBy,
      createdAt: now,
      updatedAt: now,
    };
  }
  await update(ref(db), updates);
  return records.length;
}

export const ALUMNI_CSV_HEADERS = [
  "RollNo",
  "Name",
  "Department",
  "BatchYear",
  "CGPA",
  "PlacementStatus",
  "CompanyName",
  "Designation",
  "CTC",
  "OfferLetterURL",
  "JoiningReportURL",
  "HigherStudiesDetails",
  "ContactPhone",
  "ContactEmail",
  "Notes",
];

/** Minimal CSV line parser — handles quoted fields (with escaped "" and
 * embedded commas), which is all a spreadsheet export needs. Not a general
 * CSV library; doesn't handle embedded newlines inside a quoted field. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

const VALID_DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];
const VALID_STATUSES: AlumniPlacementStatus[] = ["placed", "unplaced", "entrepreneur", "higher_studies"];

export interface ParsedAlumniRow {
  row: number;
  input: AlumniInput | null;
  errors: string[];
}

export function parseAlumniCsv(text: string): ParsedAlumniRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const results: ParsedAlumniRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const get = (name: string) => {
      const idx = header.indexOf(name);
      return idx >= 0 ? (cells[idx] ?? "").trim() : "";
    };

    const errors: string[] = [];
    const rollNo = get("RollNo");
    const name = get("Name");
    const department = get("Department").toUpperCase() as Department;
    const batchYear = Number(get("BatchYear"));
    const placementStatus = get("PlacementStatus").toLowerCase() as AlumniPlacementStatus;

    if (!rollNo) errors.push("Missing RollNo");
    if (!name) errors.push("Missing Name");
    if (!VALID_DEPARTMENTS.includes(department)) errors.push(`Invalid Department "${get("Department")}"`);
    if (!batchYear || Number.isNaN(batchYear)) errors.push("Invalid BatchYear");
    if (!VALID_STATUSES.includes(placementStatus)) {
      errors.push(`Invalid PlacementStatus "${get("PlacementStatus")}" (must be placed/unplaced/entrepreneur/higher_studies)`);
    }

    const cgpaRaw = get("CGPA");
    const ctcRaw = get("CTC");

    results.push({
      row: i + 1,
      errors,
      input:
        errors.length === 0
          ? {
              rollNo,
              name,
              department,
              batchYear,
              cgpa: cgpaRaw ? Number(cgpaRaw) : undefined,
              placementStatus,
              companyName: get("CompanyName") || undefined,
              designation: get("Designation") || undefined,
              ctc: ctcRaw ? Number(ctcRaw) : undefined,
              offerLetterUrl: get("OfferLetterURL") || undefined,
              joiningReportUrl: get("JoiningReportURL") || undefined,
              higherStudiesDetails: get("HigherStudiesDetails") || undefined,
              contactPhone: get("ContactPhone") || undefined,
              contactEmail: get("ContactEmail") || undefined,
              notes: get("Notes") || undefined,
            }
          : null,
    });
  }

  return results;
}
