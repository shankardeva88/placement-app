import { ref, get, update, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, PlacementStatus } from "@placement-app/types";

/** Student.placementStatus is otherwise never touched after account
 * creation (it's hardcoded "not_placed" at signup/bulk-import) - accepting
 * an offer is the one moment that should flip it, so the dashboard's
 * "placed" counts and every report reading this field stay accurate
 * without a coordinator having to separately go edit each student record. */
export async function respondToOffer(offerId: string, studentId: string, status: "accepted" | "declined") {
  const updates: Record<string, unknown> = {
    [`${DB_NODES.offers}/${offerId}/status`]: status,
  };
  if (status === "accepted") {
    const snap = await get(ref(db, `${DB_NODES.students}/${studentId}/placementStatus`));
    const current = snap.val() as PlacementStatus | null;
    updates[`${DB_NODES.students}/${studentId}/placementStatus`] =
      current === "placed" || current === "multiple_offers" ? "multiple_offers" : "placed";
  }
  await update(ref(db), updates);
}

export async function setOfferLetterUrl(offerId: string, url: string) {
  await update(ref(db, `${DB_NODES.offers}/${offerId}`), { offerLetterUrl: url });
}

export interface JoiningReportInput {
  studentId: string;
  department: Department;
  offerId: string;
  joiningDate: number;
  proofUrl: string;
}

/** joiningReports/{offerId} — offerId doubles as the reportId (1:1), see the
 * ID-convention comment above DB_NODES in packages/types. */
export async function submitJoiningReport(input: JoiningReportInput) {
  await update(ref(db), {
    [`${DB_NODES.joiningReports}/${input.offerId}`]: {
      reportId: input.offerId,
      studentId: input.studentId,
      department: input.department,
      offerId: input.offerId,
      joiningDate: input.joiningDate,
      proofUrl: input.proofUrl,
      status: "submitted",
      submittedAt: serverTimestamp(),
    },
    [`${DB_NODES.joiningReportsDeptIndex}/${input.department}/${input.offerId}`]: true,
  });
}
