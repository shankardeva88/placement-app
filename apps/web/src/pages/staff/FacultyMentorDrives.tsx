import { useEffect, useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, DriveStatus } from "@placement-app/types";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const DRIVE_BADGE: Record<DriveStatus, BadgeVariant> = {
  upcoming: "brand",
  ongoing: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const DRIVE_TYPE_LABEL: Record<Drive["type"], string> = { full_time: "Full-time", internship: "Internship" };

const STATUS_FILTERS: { value: DriveStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Read-only — every field a coordinator enters when creating/editing a
 * drive (see DriveForm.tsx), but no create/edit/status-change/applicants
 * actions here. Drive operations stay coordinator/hod-tier; this page is
 * just visibility so a mentor can see what's coming up (or already ran)
 * without needing the full Drives management screen. */
function DriveDetailCard({ drive }: { drive: Drive }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{drive.companyName}</h3>
          <p className="text-sm text-slate-500">
            {drive.jobRole} · {DRIVE_TYPE_LABEL[drive.type]}
          </p>
        </div>
        <Badge variant={DRIVE_BADGE[drive.status]}>{drive.status}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">CTC</dt>
          <dd className="font-medium text-slate-900">{drive.ctc} LPA</dd>
        </div>
        <div>
          <dt className="text-slate-500">Drive date</dt>
          <dd className="font-medium text-slate-900">{new Date(drive.driveDate).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Job description</dt>
          <dd className="font-medium text-slate-900">
            {drive.jdUrl ? (
              <a href={drive.jdUrl} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                View
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Eligibility</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="neutral">CGPA ≥ {drive.eligibility.minCgpa}</Badge>
          <Badge variant="neutral">Backlogs ≤ {drive.eligibility.maxBacklogsAllowed}</Badge>
          <Badge variant="neutral">{drive.eligibility.departments.join(", ") || "Any department"}</Badge>
          <Badge variant="neutral">Batch {drive.eligibility.batchYears.join(", ")}</Badge>
          {drive.eligibility.requiredSkills && drive.eligibility.requiredSkills.length > 0 && (
            <Badge variant="neutral">Skills: {drive.eligibility.requiredSkills.join(", ")}</Badge>
          )}
          {drive.eligibility.requiredTrainings && drive.eligibility.requiredTrainings.length > 0 && (
            <Badge variant="neutral">Trainings: {drive.eligibility.requiredTrainings.join(", ")}</Badge>
          )}
          {drive.eligibility.gender && drive.eligibility.gender !== "any" && (
            <Badge variant="neutral">{drive.eligibility.gender} only</Badge>
          )}
        </div>
      </div>

      {drive.rounds.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rounds</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {drive.rounds.map((r) => (
              <Badge key={r.roundId} variant={r.status === "completed" ? "success" : r.status === "in_progress" ? "warning" : "neutral"}>
                {r.name} — {r.status.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function FacultyMentorDrives() {
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<DriveStatus | "">("");

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      const list = val ? Object.values(val) : [];
      list.sort((a, b) => b.driveDate - a.driveDate);
      setDrives(list);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!drives) return null;
    return statusFilter ? drives.filter((d) => d.status === statusFilter) : drives;
  }, [drives, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Drives"
        subtitle="Every placement drive — completed and upcoming — with the full details your coordinator entered."
        icon={Briefcase}
        gradient="from-blue-500 to-indigo-600"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as DriveStatus | "")} className={inputClass}>
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {filtered === null && (
        <div className="space-y-4">
          <Skeleton className="h-40" />
        </div>
      )}

      {filtered !== null && filtered.length === 0 && (
        <EmptyState icon={Briefcase} title="No drives match this filter" />
      )}

      <div className="space-y-4">
        {filtered?.map((drive) => (
          <DriveDetailCard key={drive.driveId} drive={drive} />
        ))}
      </div>
    </div>
  );
}
