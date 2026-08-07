import { ref, push, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, MockInterview, MockInterviewType } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";

export function useAllMockInterviews(appUser: AppUser | null): MockInterview[] | null {
  return useDeptScopedCollection<MockInterview>(appUser, DB_NODES.mockInterviews, DB_NODES.mockInterviewsDeptIndex);
}

/** Every write here also sets studentIndex/{uid}/{collection}/{id} = true and
 * {collection}DeptIndex/{department}/{id} = true in the same multi-path
 * update() — studentIndex is the contract the student-side Mentor Progress
 * page relies on to discover "which records are mine", DeptIndex is what
 * lets dept-scoped staff (hod/coordinator/faculty_mentor) enumerate their
 * own department's records now that root reads are institution-only (see
 * the DB_NODES doc comment in packages/types). */

export interface AssignMentorInput {
  facultyId: string;
  studentId: string;
  department: Department;
}

export async function assignMentor(input: AssignMentorInput) {
  const newRef = push(ref(db, DB_NODES.mentorMapping));
  const mappingId = newRef.key as string;
  await update(ref(db), {
    [`${DB_NODES.mentorMapping}/${mappingId}`]: {
      mappingId,
      facultyId: input.facultyId,
      studentId: input.studentId,
      department: input.department,
      assignedAt: Date.now(),
    },
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.mentorMapping}/${mappingId}`]: true,
    [`${DB_NODES.mentorMappingDeptIndex}/${input.department}/${mappingId}`]: true,
  });
  return mappingId;
}

export interface AssignMentorBulkInput {
  facultyId: string;
  studentIds: string[];
  department: Department;
}

/** Same shape as assignMentor, one mappingId per student, all written in a
 * single multi-path update() — lets a coordinator assign a whole class to
 * one mentor instead of repeating the single-student form per student. */
export async function assignMentorBulk(input: AssignMentorBulkInput) {
  const assignedAt = Date.now();
  const updates: Record<string, unknown> = {};
  for (const studentId of input.studentIds) {
    const mappingId = push(ref(db, DB_NODES.mentorMapping)).key as string;
    updates[`${DB_NODES.mentorMapping}/${mappingId}`] = {
      mappingId,
      facultyId: input.facultyId,
      studentId,
      department: input.department,
      assignedAt,
    };
    updates[`${DB_NODES.studentIndex}/${studentId}/${DB_NODES.mentorMapping}/${mappingId}`] = true;
    updates[`${DB_NODES.mentorMappingDeptIndex}/${input.department}/${mappingId}`] = true;
  }
  await update(ref(db), updates);
}

export interface MockInterviewInput {
  studentId: string;
  department: Department;
  mentorId: string;
  type: MockInterviewType;
  communication: number;
  technical: number;
  confidence: number;
  feedback: string;
  driveId?: string; // set when this session is targeted prep for a specific drive
}

export async function recordMockInterview(input: MockInterviewInput) {
  const newRef = push(ref(db, DB_NODES.mockInterviews));
  const interviewId = newRef.key as string;
  const record: Record<string, unknown> = {
    interviewId,
    studentId: input.studentId,
    department: input.department,
    mentorId: input.mentorId,
    date: Date.now(),
    type: input.type,
    scores: { communication: input.communication, technical: input.technical, confidence: input.confidence },
    feedback: input.feedback,
  };
  if (input.driveId) record.driveId = input.driveId;
  await update(ref(db), {
    [`${DB_NODES.mockInterviews}/${interviewId}`]: record,
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.mockInterviews}/${interviewId}`]: true,
    [`${DB_NODES.mockInterviewsDeptIndex}/${input.department}/${interviewId}`]: true,
  });
  return interviewId;
}

export interface ResumeReviewInput {
  studentId: string;
  department: Department;
  mentorId: string;
  version: number;
  fileUrl: string;
  status: "not_reviewed" | "needs_revision" | "approved";
  comment: string;
}

export async function recordResumeReview(input: ResumeReviewInput) {
  const newRef = push(ref(db, DB_NODES.resumeReviews));
  const reviewId = newRef.key as string;
  await update(ref(db), {
    [`${DB_NODES.resumeReviews}/${reviewId}`]: {
      reviewId,
      studentId: input.studentId,
      department: input.department,
      mentorId: input.mentorId,
      version: input.version,
      fileUrl: input.fileUrl,
      status: input.status,
      comments: input.comment ? [input.comment] : [],
      reviewedAt: Date.now(),
    },
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.resumeReviews}/${reviewId}`]: true,
    [`${DB_NODES.resumeReviewsDeptIndex}/${input.department}/${reviewId}`]: true,
  });
  return reviewId;
}

export interface SkillAssessmentInput {
  studentId: string;
  department: Department;
  type: "technical" | "soft_skill" | "certification";
  source: "manual" | "hackerrank" | "codechef" | "other";
  score: number;
  notes: string;
}

export async function recordSkillAssessment(input: SkillAssessmentInput) {
  const newRef = push(ref(db, DB_NODES.skillAssessments));
  const assessmentId = newRef.key as string;
  await update(ref(db), {
    [`${DB_NODES.skillAssessments}/${assessmentId}`]: {
      assessmentId,
      studentId: input.studentId,
      department: input.department,
      type: input.type,
      source: input.source,
      score: input.score,
      date: Date.now(),
      notes: input.notes || null,
    },
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.skillAssessments}/${assessmentId}`]: true,
    [`${DB_NODES.skillAssessmentsDeptIndex}/${input.department}/${assessmentId}`]: true,
  });
  return assessmentId;
}
