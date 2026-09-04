import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Application, Drive } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { applyToDrive, checkEligibility, isDriveVisibleToStudent } from "../lib/driveActions";
import { allDriveRoles, applicationRoleLabel, driveCtcSummary, driveRoleSummary, isMultiRole, DRIVE_TYPE_LABEL } from "../lib/driveRolesLib";
import { useMyApplications } from "../lib/useMyApplications";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { RoundProgress } from "../components/RoundProgress";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";

const APPLICATION_BADGE: Record<Application["status"], BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

const DRIVE_BADGE: Record<Drive["status"], BadgeVariant> = {
  upcoming: "brand",
  ongoing: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const STATUS_LABEL: Record<Application["status"], string> = {
  applied: "Applied",
  shortlisted: "Shortlisted",
  in_round: "In round",
  selected: "Selected",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const DRIVE_STATUS_OPTIONS: Drive["status"][] = ["upcoming", "ongoing", "completed", "cancelled"];

// Round names are free text per drive, not a fixed enum, so "current round"
// means whichever one is actually marked in_progress right now — same
// helper as the coordinator Drives page.
function currentRoundName(drive: Drive): string | null {
  return drive.rounds?.find((r) => r.status === "in_progress")?.name ?? null;
}

function DriveCard({ drive, application }: { drive: Drive; application: Application | null }) {
  const { student } = useAuth();
  const { showToast } = useToast();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roles = allDriveRoles(drive);
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.roleId ?? "primary");
  // Collapsed by default — same fix as the coordinator Drives page: with
  // 20+ drives, every card's full info and apply/status section dumped
  // open at once was a lot to scroll past. Application status stays visible
  // in the header even collapsed, since that's the one thing worth seeing
  // at a glance.
  const [expanded, setExpanded] = useState(false);

  if (!student) return null;

  const { eligible, reasons } = checkEligibility(student, drive);
  const isOpen = drive.status === "upcoming" || drive.status === "ongoing";
  const hasResume = Boolean(student.resumeUrl);

  async function handleApply() {
    if (!student) return;
    setError(null);
    setApplying(true);
    try {
      await applyToDrive(student, drive, selectedRoleId);
      showToast(`Applied to ${drive.companyName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{drive.companyName}</h3>
          <p className="text-sm text-slate-500">{driveRoleSummary(drive)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {application && <Badge variant={APPLICATION_BADGE[application.status]}>{STATUS_LABEL[application.status]}</Badge>}
          <Badge variant={DRIVE_BADGE[drive.status]}>{drive.status}</Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-900">{DRIVE_TYPE_LABEL[drive.type]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">CTC</dt>
              <dd className="font-medium text-slate-900">{driveCtcSummary(drive)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Drive date</dt>
              <dd className="font-medium text-slate-900">{new Date(drive.driveDate).toLocaleDateString()}</dd>
            </div>
          </dl>

          {drive.jdUrl && (
            <a
              href={drive.jdUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              View job description
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4">
            {application ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={APPLICATION_BADGE[application.status]}>{STATUS_LABEL[application.status]}</Badge>
                  {isMultiRole(drive) && <span className="text-xs text-slate-500">{applicationRoleLabel(drive, application)}</span>}
                </div>
                <RoundProgress rounds={drive.rounds} application={application} />
              </div>
            ) : !eligible ? (
              <div>
                <Badge variant="warning">Not eligible</Badge>
                <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : !isOpen ? (
              <Badge variant="neutral">Applications closed</Badge>
            ) : !hasResume ? (
              <p className="text-sm text-slate-500">
                Add a resume link on your{" "}
                <Link to="/personal-details" className="font-medium text-brand-700 underline">
                  profile
                </Link>{" "}
                before applying.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {isMultiRole(drive) && (
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.jobRole} — {r.ctc} LPA
                      </option>
                    ))}
                  </select>
                )}
                <Button onClick={handleApply} loading={applying}>
                  {applying ? "Applying…" : "Apply"}
                </Button>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </>
      )}
    </Card>
  );
}

export default function Drives() {
  const { student } = useAuth();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [statusFilter, setStatusFilter] = useState<Drive["status"] | "">("");
  const [roundFilter, setRoundFilter] = useState("");
  const results = useMyApplications(student?.uid);

  // Already-applied drives always stay visible under "My Applications"
  // regardless of visibility rules (see isDriveVisibleToStudent).
  const baseVisible = useMemo(() => {
    return results?.filter((r) => {
      if (tab === "mine") return r.record !== null;
      if (!student) return true;
      return isDriveVisibleToStudent(student, r.drive);
    });
  }, [results, tab, student]);

  const roundNameOptions = useMemo(() => {
    if (!baseVisible) return [];
    const names = new Set<string>();
    for (const r of baseVisible) for (const round of r.drive.rounds ?? []) names.add(round.name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [baseVisible]);

  const visible = useMemo(() => {
    if (!baseVisible) return baseVisible;
    return baseVisible.filter((r) => {
      if (statusFilter && r.drive.status !== statusFilter) return false;
      if (roundFilter && currentRoundName(r.drive) !== roundFilter) return false;
      return true;
    });
  }, [baseVisible, statusFilter, roundFilter]);

  return (
    <div>
      <PageHeader
        title="Placement drives"
        subtitle="Browse open drives and track your applications."
        icon={Briefcase}
        gradient="from-blue-500 to-indigo-600"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          {(["all", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "all" ? "All Drives" : "My Applications"}
            </button>
          ))}
        </div>
        {baseVisible && baseVisible.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Drive["status"] | "")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All statuses</option>
              {DRIVE_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {roundNameOptions.length > 0 && (
              <select
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Currently at any round</option>
                {roundNameOptions.map((name) => (
                  <option key={name} value={name}>
                    Currently at {name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {results === null && (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      {results !== null && baseVisible?.length === 0 && tab === "all" && (
        <EmptyState icon={Briefcase} title="No drives have been posted yet" />
      )}

      {results !== null && baseVisible?.length === 0 && tab === "mine" && (
        <EmptyState
          icon={Briefcase}
          title="No applications yet"
          subtitle="Switch to All Drives to browse and apply."
        />
      )}

      {results !== null && baseVisible && baseVisible.length > 0 && visible?.length === 0 && (
        <EmptyState icon={Briefcase} title="No drives match your filters" />
      )}

      <div className="space-y-4">
        {visible?.map(({ drive, record }) => (
          <DriveCard key={drive.driveId} drive={drive} application={record} />
        ))}
      </div>
    </div>
  );
}
