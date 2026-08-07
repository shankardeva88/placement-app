import { ref, update, serverTimestamp } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department } from "@placement-app/types";

export async function respondToOffer(offerId: string, status: "accepted" | "declined") {
  await update(ref(db, `${DB_NODES.offers}/${offerId}`), { status });
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
