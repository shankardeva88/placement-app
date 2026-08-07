import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { ApplicationStatus, Drive } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useDriveApplicants, updateApplicationStatus } from "../../lib/applicantsLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { RoundProgress } from "../../components/RoundProgress";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "applied",
  "shortlisted",
  "in_round",
  "selected",
  "rejected",
  "withdrawn",
];

const STATUS_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

export default function DriveApplicants() {
  const { driveId } = useParams<{ driveId: string }>();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [drive, setDrive] = useState<Drive | null | undefined>(undefined);
  const rows = useDriveApplicants(appUser, driveId);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!driveId) return;
    return onValue(ref(db, `${DB_NODES.drives}/${driveId}`), (snap) => {
      setDrive(snap.exists() ? (snap.val() as Drive) : null);
    });
  }, [driveId]);

  async function handleUpdate(applicationId: string, status: ApplicationStatus, currentRoundId: string) {
    setUpdatingId(applicationId);
    try {
      await updateApplicationStatus(applicationId, status, currentRoundId || undefined);
      showToast("Status updated");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <Link to="/staff/drives" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to drives
      </Link>

      <PageHeader
        title={drive ? `${drive.companyName} — Applicants` : "Applicants"}
        subtitle={drive ? `${drive.jobRole} · ${rows?.length ?? 0} applicant(s)` : undefined}
        icon={Users}
        gradient="from-blue-500 to-indigo-600"
      />

      {rows === null && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <EmptyState icon={Users} title="No applicants yet" />
      )}

      <div className="space-y-3">
        {rows?.map(({ application, student }) => (
          <Card key={application.applicationId} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              {student ? (
                <>
                  <p className="font-medium text-slate-900">
                    {student.rollNo} — {student.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {student.department} · CGPA {student.cgpa}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Details restricted (different department)</p>
              )}
              {drive && drive.rounds.length > 0 && (
                <div className="mt-2">
                  <RoundProgress rounds={drive.rounds} application={application} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Badge variant={STATUS_BADGE[application.status]}>{application.status.replace("_", " ")}</Badge>
              <select
                value={application.status}
                disabled={updatingId === application.applicationId}
                onChange={(e) =>
                  handleUpdate(application.applicationId, e.target.value as ApplicationStatus, application.currentRoundId ?? "")
                }
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              {drive && drive.rounds.length > 0 && (
                <select
                  value={application.currentRoundId ?? ""}
                  disabled={updatingId === application.applicationId}
                  onChange={(e) => handleUpdate(application.applicationId, application.status, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">No round yet</option>
                  {drive.rounds.map((r) => (
                    <option key={r.roundId} value={r.roundId}>
                      {application.status === "rejected" ? "Rejected at" : "At"} {r.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
