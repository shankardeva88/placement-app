import { ref, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department, JoiningReport, Offer, OfferStatus } from "@placement-app/types";
import { useDeptScopedCollection } from "./useDeptScopedCollection";

export function useAllOffers(appUser: AppUser | null): Offer[] | null {
  return useDeptScopedCollection<Offer>(appUser, DB_NODES.offers, DB_NODES.offersDeptIndex);
}

export function useAllJoiningReports(appUser: AppUser | null): Record<string, JoiningReport> {
  const reports = useDeptScopedCollection<JoiningReport>(appUser, DB_NODES.joiningReports, DB_NODES.joiningReportsDeptIndex);
  const byId: Record<string, JoiningReport> = {};
  for (const r of reports ?? []) byId[r.reportId] = r;
  return byId;
}

export interface RecordOfferInput {
  studentUid: string;
  department: Department;
  driveId: string;
  ctc: number;
  designation: string;
  offerLetterUrl: string;
}

/** offerId is `${studentUid}_${driveId}` — matches the deterministic-id
 * convention documented above DB_NODES in packages/types. */
export async function recordOffer(input: RecordOfferInput) {
  const offerId = `${input.studentUid}_${input.driveId}`;
  const offer: Record<string, unknown> = {
    offerId,
    studentId: input.studentUid,
    department: input.department,
    driveId: input.driveId,
    ctc: input.ctc,
    designation: input.designation,
    status: "received" as OfferStatus,
    createdAt: Date.now(),
  };
  if (input.offerLetterUrl) offer.offerLetterUrl = input.offerLetterUrl;
  await update(ref(db), {
    [`${DB_NODES.offers}/${offerId}`]: offer,
    [`${DB_NODES.offersDeptIndex}/${input.department}/${offerId}`]: true,
  });
}

export async function setJoiningReportStatus(reportId: string, status: JoiningReport["status"]) {
  await update(ref(db, `${DB_NODES.joiningReports}/${reportId}`), { status });
}

export interface UpdateOfferInput {
  ctc: number;
  designation: string;
  offerLetterUrl: string;
}

/** Partial update — deliberately NOT recordOffer() again. recordOffer sets
 * the whole node (status: "received", createdAt: now included), so reusing
 * it to "edit" an existing offer would silently reset status back to
 * received and createdAt to now, wiping out any progression the student
 * made (verified/accepted/declined) even though only the CTC/designation/
 * link needed fixing. This only ever touches those three fields. */
export async function updateOfferDetails(offerId: string, input: UpdateOfferInput) {
  await update(ref(db, `${DB_NODES.offers}/${offerId}`), {
    ctc: input.ctc,
    designation: input.designation,
    offerLetterUrl: input.offerLetterUrl || null,
  });
}

/** Removes the offer and, if one exists, its 1:1 joining report — reportId
 * === offerId (see JoiningReport doc comment), so leaving it behind would
 * be an orphaned record nothing else ever looks up again. Same cascading-
 * cleanup shape as deleteApplication in applicantsLib.ts. */
export async function deleteOffer(offerId: string, department: Department, hasJoiningReport: boolean) {
  const updates: Record<string, unknown> = {
    [`${DB_NODES.offers}/${offerId}`]: null,
    [`${DB_NODES.offersDeptIndex}/${department}/${offerId}`]: null,
  };
  if (hasJoiningReport) {
    updates[`${DB_NODES.joiningReports}/${offerId}`] = null;
    updates[`${DB_NODES.joiningReportsDeptIndex}/${department}/${offerId}`] = null;
  }
  await update(ref(db), updates);
}
