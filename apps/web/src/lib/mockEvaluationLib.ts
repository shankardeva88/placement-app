import { useEffect, useState } from "react";
import { ref, push, update, onValue } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, MockEvalRating, MockEvaluation, MockInterviewModule } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";

export const RATING_OPTIONS: MockEvalRating[] = [
  "excellent",
  "very_good",
  "good",
  "average",
  "need_to_improve",
  "poor",
  "absent",
];

export const RATING_LABEL: Record<MockEvalRating, string> = {
  excellent: "Excellent",
  very_good: "Very Good",
  good: "Good",
  average: "Average",
  need_to_improve: "Need to Improve",
  poor: "Poor",
  absent: "Absent",
};

/** For the progress trend chart — Absent isn't a performance point (there's
 * nothing to plot that day), everything else maps onto a 1-6 scale so a
 * mentor/coordinator can see whether a student is actually improving over
 * the module's run. */
export const RATING_SCORE: Record<MockEvalRating, number | null> = {
  excellent: 6,
  very_good: 5,
  good: 4,
  average: 3,
  need_to_improve: 2,
  poor: 1,
  absent: null,
};

export const EVAL_CATEGORIES: { key: keyof EvalRatingFields; label: string }[] = [
  { key: "selfIntroduction", label: "Self Introduction" },
  { key: "projectExplanation", label: "Project Explanation" },
  { key: "technicalOopJava", label: "Technical (OOP/Java)" },
  { key: "technicalCnOs", label: "Technical (CN/OS)" },
  { key: "technicalDbmsSql", label: "Technical (DBMS/SQL)" },
  { key: "communication", label: "Communication" },
  { key: "hr", label: "HR" },
  { key: "selfConfidence", label: "Self Confidence" },
  { key: "overallPerformance", label: "Overall Performance" },
];

export interface EvalRatingFields {
  selfIntroduction: MockEvalRating;
  projectExplanation: MockEvalRating;
  technicalOopJava: MockEvalRating;
  technicalCnOs: MockEvalRating;
  technicalDbmsSql: MockEvalRating;
  communication: MockEvalRating;
  hr: MockEvalRating;
  selfConfidence: MockEvalRating;
  overallPerformance: MockEvalRating;
}

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Midnight (local) for a given day — evaluations are keyed/compared by day,
 * not exact time, so "today's entry" stays stable no matter what time of
 * day a mentor logs it. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function useMockModules(appUser: AppUser | null): MockInterviewModule[] | null {
  return useDeptScopedCollection<MockInterviewModule>(
    appUser,
    DB_NODES.mockInterviewModules,
    DB_NODES.mockInterviewModulesDeptIndex
  );
}

export function useMockEvaluations(appUser: AppUser | null): MockEvaluation[] | null {
  return useDeptScopedCollection<MockEvaluation>(appUser, DB_NODES.mockEvaluations, DB_NODES.mockEvaluationsDeptIndex);
}

/** Fetches specific modules by id — for the student side, where moduleIds
 * come from the student's own evaluations (via studentIndex), not from
 * listing the collection (students can't enumerate mockInterviewModules,
 * only read one they already know the id of — see the .read comment in
 * database.rules.json). */
export function useModulesByIds(moduleIds: string[]): Record<string, MockInterviewModule> {
  const [modules, setModules] = useState<Record<string, MockInterviewModule>>({});

  useEffect(() => {
    const unsubs = moduleIds.map((id) =>
      onValue(ref(db, `${DB_NODES.mockInterviewModules}/${id}`), (snap) => {
        if (snap.exists()) {
          setModules((prev) => ({ ...prev, [id]: snap.val() as MockInterviewModule }));
        }
      })
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleIds.join(",")]);

  return modules;
}

export interface CreateMockModuleInput {
  name: string;
  department: Department;
  startDate: number;
  endDate: number;
  createdBy: string;
}

export async function createMockModule(input: CreateMockModuleInput) {
  const moduleId = push(ref(db, DB_NODES.mockInterviewModules)).key as string;
  const module: MockInterviewModule = {
    moduleId,
    name: input.name,
    department: input.department,
    startDate: startOfDay(input.startDate),
    endDate: startOfDay(input.endDate),
    createdBy: input.createdBy,
    createdAt: Date.now(),
  };
  await update(ref(db), {
    [`${DB_NODES.mockInterviewModules}/${moduleId}`]: module,
    [`${DB_NODES.mockInterviewModulesDeptIndex}/${input.department}/${moduleId}`]: true,
  });
  return moduleId;
}

export interface RecordMockEvaluationInput extends EvalRatingFields {
  moduleId: string;
  studentId: string;
  department: Department;
  mentorId: string;
  date: number;
  notes?: string;
}

export async function recordMockEvaluation(input: RecordMockEvaluationInput) {
  const day = startOfDay(input.date);
  const evaluationId = `${input.moduleId}_${input.studentId}_${dateKey(day)}`;
  const evaluation: MockEvaluation = {
    evaluationId,
    moduleId: input.moduleId,
    studentId: input.studentId,
    department: input.department,
    mentorId: input.mentorId,
    date: day,
    selfIntroduction: input.selfIntroduction,
    projectExplanation: input.projectExplanation,
    technicalOopJava: input.technicalOopJava,
    technicalCnOs: input.technicalCnOs,
    technicalDbmsSql: input.technicalDbmsSql,
    communication: input.communication,
    hr: input.hr,
    selfConfidence: input.selfConfidence,
    overallPerformance: input.overallPerformance,
    notes: input.notes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await update(ref(db), {
    [`${DB_NODES.mockEvaluations}/${evaluationId}`]: evaluation,
    [`${DB_NODES.mockEvaluationsDeptIndex}/${input.department}/${evaluationId}`]: true,
    // Lets the student discover their own evaluation ids — same pattern as
    // recordMockInterview/recordResumeReview in mentorToolsLib.ts. Written
    // every time (including re-logging the same day), which is harmless:
    // it's just `true`, already true.
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.mockEvaluations}/${evaluationId}`]: true,
  });
  return evaluationId;
}
