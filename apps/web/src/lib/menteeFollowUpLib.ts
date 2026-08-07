import { useMemo } from "react";
import { ref, push, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, FollowUpCategory, MentorMapping, MenteeFollowUp, ParentContactMode, Student } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";
import { useIndexedList, sortedSgpaEntries } from "./mentorProgressLib";

export const AT_RISK_CGPA_THRESHOLD = 6.0; // heuristic — matches common eligibility cutoffs, adjust if your college's bar differs
export const STALE_FOLLOW_UP_DAYS = 30;

/** Cheap, no-new-schema signals a mentor can act on immediately — not a
 * formal risk model, just "what would make a mentor want to check in."
 * Shared between MentorTools.tsx (per-mentee detail) and StaffDashboard.tsx
 * (aggregate at-risk count). */
export function computeAtRiskReasons(student: Student, lastFollowUpAt: number | null): string[] {
  const reasons: string[] = [];
  if (student.activeBacklogs > 0) reasons.push(`${student.activeBacklogs} backlog(s)`);
  if (student.cgpa < AT_RISK_CGPA_THRESHOLD) reasons.push(`CGPA ${student.cgpa}`);
  const sgpa = sortedSgpaEntries(student.semesterWiseSgpa);
  if (sgpa.length >= 2 && sgpa[sgpa.length - 1].value < sgpa[sgpa.length - 2].value) {
    reasons.push("SGPA declining");
  }
  const staleMs = STALE_FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000;
  if (lastFollowUpAt === null || Date.now() - lastFollowUpAt > staleMs) {
    reasons.push(`No follow-up in ${STALE_FOLLOW_UP_DAYS}+ days`);
  }
  return reasons;
}

/** The mentor's own roster — mentorMapping records where facultyId is them.
 * mentorMapping's per-record read already allows any dept-scoped staff to
 * read their own department's mappings, so this is just the dept-scoped fan
 * out (same one MentorMapping-writers already rely on) filtered client-side. */
export function useMyMentees(appUser: AppUser | null, mentorUid: string | undefined): MentorMapping[] | null {
  const all = useDeptScopedCollection<MentorMapping>(appUser, DB_NODES.mentorMapping, DB_NODES.mentorMappingDeptIndex);
  return useMemo(() => {
    if (!mentorUid || !all) return null;
    return all.filter((m) => m.facultyId === mentorUid);
  }, [all, mentorUid]);
}

/** One mentee's follow-up log, newest first — reuses the studentIndex fan-out
 * already built for mockInterviews/resumeReviews/skillAssessments, since a
 * follow-up read is naturally "which student is this about," not
 * department-wide (avoids fetching entries other mentors wrote that this
 * mentor can't open anyway — see the rules comment on menteeFollowUps). */
export function useMenteeFollowUps(studentId: string | undefined): MenteeFollowUp[] | null {
  const list = useIndexedList<MenteeFollowUp>(studentId, DB_NODES.menteeFollowUps);
  return useMemo(() => (list ? [...list].sort((a, b) => b.createdAt - a.createdAt) : null), [list]);
}

export interface RecordFollowUpInput {
  studentId: string;
  department: Department;
  mentorId: string;
  category: FollowUpCategory;
  note: string;
  parentContactMode?: ParentContactMode;
  nextMeetingDate?: number;
}

export async function recordFollowUp(input: RecordFollowUpInput) {
  const newRef = push(ref(db, DB_NODES.menteeFollowUps));
  const followUpId = newRef.key as string;
  const record: Record<string, unknown> = {
    followUpId,
    studentId: input.studentId,
    department: input.department,
    mentorId: input.mentorId,
    category: input.category,
    note: input.note,
    createdAt: Date.now(),
  };
  if (input.category === "parent_communication" && input.parentContactMode) {
    record.parentContactMode = input.parentContactMode;
  }
  if (input.nextMeetingDate) record.nextMeetingDate = input.nextMeetingDate;
  await update(ref(db), {
    [`${DB_NODES.menteeFollowUps}/${followUpId}`]: record,
    [`${DB_NODES.studentIndex}/${input.studentId}/${DB_NODES.menteeFollowUps}/${followUpId}`]: true,
    [`${DB_NODES.menteeFollowUpsDeptIndex}/${input.department}/${followUpId}`]: true,
  });
  return followUpId;
}

/** The standing "next meeting" for a mentee is whatever the most recent
 * follow-up entry says — each new entry with a date supersedes the last. */
export function getNextMeetingDate(followUps: MenteeFollowUp[] | null): number | null {
  if (!followUps || followUps.length === 0) return null;
  const withDate = followUps.filter((f) => f.nextMeetingDate);
  if (withDate.length === 0) return null;
  const latest = withDate.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  return latest.nextMeetingDate ?? null;
}
