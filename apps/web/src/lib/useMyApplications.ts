import { DB_NODES } from "@placement-app/types";
import type { Application } from "@placement-app/types";
import { useOwnedDriveRecords } from "./useOwnedDriveRecords";
import type { DriveWithRecord } from "./useOwnedDriveRecords";

export type DriveWithApplication = DriveWithRecord<Application>;

export function useMyApplications(studentUid: string | undefined): DriveWithApplication[] | null {
  return useOwnedDriveRecords<Application>(studentUid, DB_NODES.applications);
}
