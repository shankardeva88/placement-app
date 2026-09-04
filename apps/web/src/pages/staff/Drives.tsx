import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, ChevronDown, ChevronUp, ListChecks, Plus, Search, Trash2, Users } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, DriveStatus, DriveType } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { createDrive, updateDrive, updateDriveStatus, deleteDrive } from "../../lib/staffDriveActions";
import { useAllApplications } from "../../lib/applicantsLib";
import { driveRoleSummary, driveCtcSummary, DRIVE_TYPE_LABEL } from "../../lib/driveRolesLib";
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
const DRIVE_TYPE_OPTIONS: DriveType[] = ["full_time", "internship", "internship_plus_full_time"];

// Round names are free text per drive (see the DriveRound.name doc comment
// — "Aptitude", "GD", "Technical Interview", "HR", or whatever a coordinator
// types), not a fixed enum, so "current round" means whichever one is
// actually marked in_progress right now, not a position in a numbered list.
function currentRoundName(drive: Drive): string | null {
  return drive.rounds?.find((r) => r.status === "in_progress")?.name ?? null;
}

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

function DriveCard({ drive, applicantCount }: { drive: Drive; applicantCount: number | null }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Collapsed by default — a coordinator running 20+ drives at once had
  // every card's full info grid and action row dumped open at all times,
  // same fix already applied to Offers/Internships/Training. Click a card
  // to see its details and actions.
  const [expanded, setExpanded] = useState(false);

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

  async function handleDelete() {
    if (!window.confirm(`Are you sure you want to delete "${drive.companyName}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDrive(drive.driveId);
      showToast("Drive deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete drive");
      setDeleting(false);
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
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{drive.companyName}</h3>
          <p className="text-sm text-slate-500">{driveRoleSummary(drive)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="brand">{driveCtcSummary(drive)}</Badge>
          <Badge variant={DRIVE_BADGE[drive.status]}>{drive.status}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-900">{DRIVE_TYPE_LABEL[drive.type]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">CTC</dt>
              <dd className="font-medium text-slate-900">{driveCtcSummary(drive)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Eligible depts</dt>
              <dd className="font-medium text-slate-900">{(drive.eligibility.departments ?? []).join(", ") || "Any department"}</dd>
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
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={applicantCount === null || applicantCount > 0}
              title={
                applicantCount === null
                  ? "Loading applicant count…"
                  : applicantCount > 0
                    ? `Can't delete — ${applicantCount} student(s) have already applied. Mark it cancelled instead.`
                    : "Delete this drive"
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function StaffDrives() {
  const { firebaseUser, appUser } = useAuth();
  const { showToast } = useToast();
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DriveType | "">("");
  const [statusFilter, setStatusFilter] = useState<DriveStatus | "">("");
  const [roundFilter, setRoundFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const applications = useAllApplications(appUser);

  // Every distinct round name in use across drives, for the filter dropdown
  // — built from actual data since round names are free text per drive, not
  // a fixed set.
  const roundNameOptions = useMemo(() => {
    if (!drives) return [];
    const names = new Set<string>();
    for (const d of drives) for (const r of d.rounds ?? []) names.add(r.name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [drives]);

  // Same for batch years actually used in eligibility.batchYears — added
  // ahead of upcoming drives that will target next year's graduating batch
  // (2029, 2030, ...), so the dropdown grows with new drives rather than
  // needing a hardcoded year list maintained here.
  const batchYearOptions = useMemo(() => {
    if (!drives) return [];
    const years = new Set<number>();
    for (const d of drives) for (const y of d.eligibility?.batchYears ?? []) years.add(y);
    return Array.from(years).sort((a, b) => a - b);
  }, [drives]);

  const filteredDrives = useMemo(() => {
    if (!drives) return drives;
    const term = search.trim().toLowerCase();
    return drives.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      if (roundFilter && currentRoundName(d) !== roundFilter) return false;
      // Empty batchYears means "no batch restriction" everywhere else in the
      // app (see isDriveVisibleToStudent in driveActions.ts) — a drive open
      // to every batch should still show up under any specific batch filter,
      // not just when batchYears happens to be empty.
      if (batchFilter) {
        const batchYears = d.eligibility?.batchYears ?? [];
        if (batchYears.length > 0 && !batchYears.includes(batchFilter)) return false;
      }
      if (!term) return true;
      return d.companyName.toLowerCase().includes(term) || driveRoleSummary(d).toLowerCase().includes(term);
    });
  }, [drives, search, typeFilter, statusFilter, roundFilter, batchFilter]);

  // Only counts applicants within the coordinator/hod's own department scope
  // (applicationsDeptIndex, see the doc comment on useDriveApplicants in
  // applicantsLib.ts) — same limitation the Applicants page already has for
  // a drive open to multiple departments. Institution roles see everyone, so
  // their delete-safety check is exact.
  const applicantCountByDrive = useMemo(() => {
    if (!applications) return null;
    const counts: Record<string, number> = {};
    for (const a of applications) counts[a.driveId] = (counts[a.driveId] ?? 0) + 1;
    return counts;
  }, [applications]);

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
        subtitle={
          drives && filteredDrives && filteredDrives.length !== drives.length
            ? `${filteredDrives.length} of ${drives.length} drive(s)`
            : "Create and manage placement drives."
        }
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

      {drives !== null && drives.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by company or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DriveType | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-48"
          >
            <option value="">All types</option>
            {DRIVE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {DRIVE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DriveStatus | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-48"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {roundNameOptions.length > 0 && (
            <select
              value={roundFilter}
              onChange={(e) => setRoundFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-48"
            >
              <option value="">Currently at any round</option>
              {roundNameOptions.map((name) => (
                <option key={name} value={name}>
                  Currently at {name}
                </option>
              ))}
            </select>
          )}
          {batchYearOptions.length > 0 && (
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-40"
            >
              <option value="">All batches</option>
              {batchYearOptions.map((y) => (
                <option key={y} value={y}>
                  Batch {y}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {drives !== null && drives.length > 0 && filteredDrives?.length === 0 && (
        <EmptyState icon={Search} title="No drives match this search/filter" />
      )}

      <div className="space-y-4">
        {filteredDrives?.map((drive) => (
          <DriveCard
            key={drive.driveId}
            drive={drive}
            applicantCount={applicantCountByDrive ? (applicantCountByDrive[drive.driveId] ?? 0) : null}
          />
        ))}
      </div>
    </div>
  );
}
