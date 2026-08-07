import { ref, push, set, update } from "firebase/database";
import { db } from "../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, DriveRound, DriveStatus, DriveType, EligibilityCriteria } from "@placement-app/types";

export interface DriveFormInput {
  companyName: string;
  jobRole: string;
  type: DriveType;
  ctc: number;
  jdUrl: string;
  driveDate: number;
  eligibility: EligibilityCriteria;
  selectedStudentIds: string[];
  rounds: DriveRound[];
}

export async function createDrive(input: DriveFormInput, createdByUid: string) {
  const newRef = push(ref(db, DB_NODES.drives));
  const driveId = newRef.key as string;
  const drive: Drive = {
    driveId,
    campusId: "main",
    companyName: input.companyName,
    jobRole: input.jobRole,
    type: input.type,
    ctc: input.ctc,
    eligibility: input.eligibility,
    rounds: input.rounds,
    driveDate: input.driveDate,
    status: "upcoming",
    createdBy: createdByUid,
    createdAt: Date.now(),
  };
  // set() rejects `undefined` values outright — omit the key instead when empty.
  if (input.jdUrl) drive.jdUrl = input.jdUrl;
  if (input.selectedStudentIds.length > 0) drive.selectedStudentIds = input.selectedStudentIds;
  await set(newRef, drive);
  return driveId;
}

export async function updateDrive(driveId: string, input: DriveFormInput) {
  await update(ref(db, `${DB_NODES.drives}/${driveId}`), {
    companyName: input.companyName,
    jobRole: input.jobRole,
    type: input.type,
    ctc: input.ctc,
    jdUrl: input.jdUrl || null,
    eligibility: input.eligibility,
    selectedStudentIds: input.selectedStudentIds.length > 0 ? input.selectedStudentIds : null,
    rounds: input.rounds,
  });
}

export async function updateDriveStatus(driveId: string, status: DriveStatus) {
  await update(ref(db, `${DB_NODES.drives}/${driveId}`), { status });
}
