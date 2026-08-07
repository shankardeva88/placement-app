import { ref, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Student } from "@placement-app/types";

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

const ROLL_NO_HEADERS = new Set(["reg.no", "reg no", "regno", "roll no", "roll number", "rollno"]);
const NAME_HEADERS = new Set(["name"]);

/** Matches "Training1(Infosys)", "Training 2 (BeingZero)", etc. — the
 * training's name is whatever's in the parens, not the column position, so
 * sheets can add/drop/reorder training columns without code changes. */
const TRAINING_HEADER_RE = /^training\s*\d*\s*\((.+)\)$/i;

/** RTDB object keys can't contain ".", "#", "$", "/", "[", or "]" — a real
 * column in this sheet is literally "Training4(.Net)", which produces the
 * training name ".Net". Left unsanitized, every row with that training set
 * fails the whole per-student write (the invalid key poisons the entire
 * `trainings` object being written, not just that one entry). */
function sanitizeTrainingKey(name: string): string {
  return name.replace(/[.#$/[\]]/g, "_");
}

export interface ParsedTrainingRow {
  rowIndex: number;
  rollNo: string;
  name: string;
  trainings: Record<string, string>;
}

export interface ParseTrainingResult {
  rows: ParsedTrainingRow[];
  trainingNames: string[];
  unmappedHeaders: string[];
}

/** Rows with no roll number (the trailing blank row and the "Total" summary
 * row this sheet always ends with) are silently dropped, not surfaced as
 * errors — they're a normal part of the sheet's shape, not a data problem. */
export function parseTrainingRows(headers: string[], rawRows: string[][]): ParseTrainingResult {
  let rollNoIdx = -1;
  let nameIdx = -1;
  const trainingCols: { idx: number; name: string }[] = [];
  const unmappedHeaders: string[] = [];

  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const trainingMatch = h.trim().match(TRAINING_HEADER_RE);
    if (ROLL_NO_HEADERS.has(norm)) rollNoIdx = i;
    else if (NAME_HEADERS.has(norm)) nameIdx = i;
    else if (trainingMatch) trainingCols.push({ idx: i, name: sanitizeTrainingKey(trainingMatch[1].trim()) });
    else if (norm && norm !== "s.no" && norm !== "sno" && norm !== "branch") unmappedHeaders.push(h);
  });

  const rows: ParsedTrainingRow[] = [];
  rawRows.forEach((row, i) => {
    const rollNo = (rollNoIdx >= 0 ? row[rollNoIdx] : "")?.trim() ?? "";
    if (!rollNo) return; // blank/"Total" row — not a student

    const trainings: Record<string, string> = {};
    for (const col of trainingCols) {
      const cell = (row[col.idx] ?? "").trim();
      if (cell) trainings[col.name] = cell;
    }

    rows.push({
      rowIndex: i + 1,
      rollNo,
      name: (nameIdx >= 0 ? row[nameIdx] : "")?.trim() ?? "",
      trainings,
    });
  });

  return { rows, trainingNames: trainingCols.map((c) => c.name), unmappedHeaders };
}

export interface TrainingImportOutcome {
  row: ParsedTrainingRow;
  result: "updated" | "not_found" | "no_trainings" | "failed";
  message?: string;
}

/** Merges into each student's existing `trainings` (doesn't replace it) so
 * uploading this week's SAP results doesn't erase last month's Infosys
 * results — see the Student.trainings doc comment in packages/types. Only
 * students already in rosterByRollNo (the coordinator's own department, via
 * useStudentsDirectory) can be matched; everyone else comes back
 * "not_found" rather than silently failing.
 *
 * One write per student, not one big multi-path update() — a single atomic
 * update() covering all matched students would fail *entirely* if even one
 * path were denied (e.g. a stale roster entry), with no way to tell which
 * one, and no partial progress. onProgress lets the caller show live
 * count, since this can be a couple hundred sequential awaits. */
export async function importTrainings(
  rows: ParsedTrainingRow[],
  rosterByRollNo: Record<string, Student>,
  onProgress?: (done: number, total: number) => void
): Promise<TrainingImportOutcome[]> {
  const toWrite = rows.filter((row) => rosterByRollNo[row.rollNo.toUpperCase()]);
  const outcomes: TrainingImportOutcome[] = [];
  let done = 0;

  for (const row of rows) {
    const student = rosterByRollNo[row.rollNo.toUpperCase()];
    if (!student) {
      outcomes.push({ row, result: "not_found" });
      continue;
    }
    if (Object.keys(row.trainings).length === 0) {
      outcomes.push({ row, result: "no_trainings" });
      continue;
    }
    try {
      const merged = { ...(student.trainings ?? {}), ...row.trainings };
      await update(ref(db, `${DB_NODES.students}/${student.uid}`), { trainings: merged });
      outcomes.push({ row, result: "updated" });
    } catch (err) {
      outcomes.push({ row, result: "failed", message: err instanceof Error ? err.message : "Write failed" });
    }
    done += 1;
    onProgress?.(done, toWrite.length);
  }

  return outcomes;
}
