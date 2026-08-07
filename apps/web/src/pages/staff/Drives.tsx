import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, ListChecks, Plus, Users } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, DriveStatus } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { createDrive, updateDrive, updateDriveStatus } from "../../lib/staffDriveActions";
import { driveRoleSummary, driveCtcSummary } from "../../lib/driveRolesLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { DriveForm } from "./DriveForm";
import type { DriveFormValues } from "./DriveForm";

const DRIVE_BADGE: Record<DriveStatus, BadgeVariant> = {
  upcoming: "brand",
  ongoing: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const STATUS_OPTIONS: DriveStatus[] = ["upcoming", "ongoing", "completed", "cancelled"];

function toEligibility(values: DriveFormValues) {
  return {
    minCgpa: values.minCgpa,
    maxBacklogsAllowed: values.maxBacklogsAllowed,
    departments: values.departments,
    batchYears: values.batchYears,
    requiredSkills: values.requiredSkills,
    requiredTrainings: values.requiredTrainings,
    gender: values.gender,
  };
}

function DriveCard({ drive }: { drive: Drive }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  async function handleUpdate(values: DriveFormValues) {
    await updateDrive(drive.driveId, {
      companyName: values.companyName,
      jobRole: values.jobRole,
      type: values.type,
      ctc: values.ctc,
      jdUrl: values.jdUrl,
      driveDate: values.driveDate,
      eligibility: toEligibility(values),
      selectedStudentIds: values.selectedStudentIds,
      roles: values.roles,
      rounds: values.rounds,
    });
    showToast("Drive updated");
    setEditing(false);
  }

  async function handleStatusChange(status: DriveStatus) {
    setChangingStatus(true);
    try {
      await updateDriveStatus(drive.driveId, status);
      showToast(`Marked ${status}`);
    } finally {
      setChangingStatus(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-900">Edit drive</h3>
        <DriveForm
          initial={drive}
          submitLabel="Save changes"
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{drive.companyName}</h3>
          <p className="text-sm text-slate-500">{driveRoleSummary(drive)}</p>
        </div>
        <Badge variant={DRIVE_BADGE[drive.status]}>{drive.status}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">CTC</dt>
          <dd className="font-medium text-slate-900">{driveCtcSummary(drive)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Eligible depts</dt>
          <dd className="font-medium text-slate-900">{drive.eligibility.departments.join(", ")}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Drive date</dt>
          <dd className="font-medium text-slate-900">{new Date(drive.driveDate).toLocaleDateString()}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <Link to={`/staff/drives/${drive.driveId}`}>
          <Button variant="secondary">
            <Users className="h-4 w-4" />
            Applicants
          </Button>
        </Link>
        <Link to={`/staff/drives/${drive.driveId}/eligibility`}>
          <Button variant="secondary">
            <ListChecks className="h-4 w-4" />
            Eligibility List
          </Button>
        </Link>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <select
          value={drive.status}
          disabled={changingStatus}
          onChange={(e) => handleStatusChange(e.target.value as DriveStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}

export default function StaffDrives() {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      const list = val ? Object.values(val) : [];
      list.sort((a, b) => b.createdAt - a.createdAt);
      setDrives(list);
    });
  }, []);

  async function handleCreate(values: DriveFormValues) {
    if (!firebaseUser) return;
    await createDrive(
      {
        companyName: values.companyName,
        jobRole: values.jobRole,
        type: values.type,
        ctc: values.ctc,
        jdUrl: values.jdUrl,
        driveDate: values.driveDate,
        eligibility: toEligibility(values),
        selectedStudentIds: values.selectedStudentIds,
        roles: values.roles,
        rounds: values.rounds,
      },
      firebaseUser.uid
    );
    showToast("Drive created");
    setCreating(false);
  }

  return (
    <div>
      <PageHeader
        title="Drives"
        subtitle="Create and manage placement drives."
        icon={Briefcase}
        gradient="from-blue-500 to-indigo-600"
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New Drive
            </Button>
          )
        }
      />

      {creating && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">New drive</h3>
          <DriveForm submitLabel="Create drive" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </Card>
      )}

      {drives === null && (
        <div className="space-y-4">
          <Skeleton className="h-40" />
        </div>
      )}

      {drives !== null && drives.length === 0 && !creating && (
        <EmptyState icon={Briefcase} title="No drives yet" subtitle="Create your first placement drive." />
      )}

      <div className="space-y-4">
        {drives?.map((drive) => (
          <DriveCard key={drive.driveId} drive={drive} />
        ))}
      </div>
    </div>
  );
}
