import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, Search, Trash2, UserPlus, Users } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Application, ApplicationStatus, Drive, Gender, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useDriveApplicants, updateApplicationStatus, deleteApplication } from "../../lib/applicantsLib";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { applyToDrive, checkEligibility } from "../../lib/driveActions";
import { applicationRoleLabel, driveRoleSummary, isMultiRole } from "../../lib/driveRolesLib";
import { downloadCsv } from "../../lib/csv";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
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

// Same palette as Badge's own VARIANT_CLASSES (not exported from Badge.tsx),
// duplicated here because the summary chips below need to be actual
// <button>s (clickable, with an active-state ring), not the plain <span>
// Badge renders.
const CHIP_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-600 hover:bg-slate-200",
  brand: "bg-brand-100 text-brand-700 hover:bg-brand-200",
  success: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  warning: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  danger: "bg-red-100 text-red-700 hover:bg-red-200",
};
// Status chips skip "in_round" — it's broken out into one chip per actual
// round name instead (see roundCounts), which is the whole point: "in round"
// alone doesn't say which one, and that's the exact gap this summary closes.
const STATUS_CHIP_OPTIONS = STATUS_OPTIONS.filter((s) => s !== "in_round");

// Every column a company placement team's spreadsheet format asks for is
// already on the Student/Application record — this just lays it out in
// their exact order instead of retyping it by hand for every drive.
const COLLEGE_NAME = "Vishnu Institute of Technology";
const GENDER_LABEL: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};
const COMPANY_FORMAT_HEADERS = [
  "S.No",
  "Roll Number",
  "Full Name",
  "Gender",
  "Branch",
  "B.Tech CGPA",
  "Backlogs",
  "Year of Passedout",
  "Phone Number",
  "Date of Birth",
  "X Class Percentage %",
  "X Class Year of Passing",
  "XII Percentage %",
  "XII/Diploma Year of Passing",
  "Email Address (College Domain Mail ID)",
  "Personal Email",
  "Applied Role",
  "Resume Link",
  "College Name",
];

function companyFormatRow(index: number, student: Student, roleLabel: string): (string | number)[] {
  return [
    index + 1,
    student.rollNo,
    student.name,
    student.gender ? (GENDER_LABEL[student.gender] ?? student.gender) : "",
    student.department,
    student.cgpa,
    student.activeBacklogs,
    student.batchYear,
    student.studentPhone ?? "",
    student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "",
    student.tenthPercentage ?? "",
    student.tenthYearOfPassing ?? "",
    student.twelfthPercentage ?? "",
    student.twelfthYearOfPassing ?? "",
    student.email ?? "",
    student.personalEmail ?? "",
    roleLabel,
    student.resumeUrl ?? "",
    COLLEGE_NAME,
  ];
}

export default function DriveApplicants() {
  const { driveId } = useParams<{ driveId: string }>();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const [drive, setDrive] = useState<Drive | null | undefined>(undefined);
  const students = useStudentsDirectory(appUser);
  const rows = useDriveApplicants(appUser, driveId, students);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [sortBy, setSortBy] = useState<"default" | "rollNo" | "cgpa">("default");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");
  const [roundFilter, setRoundFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState<ApplicationStatus>("shortlisted");
  const [bulkRoundValue, setBulkRoundValue] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkUpdateProgress, setBulkUpdateProgress] = useState(0);
  const [extraColumns, setExtraColumns] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState(0);

  // A "details restricted" row (different department, see the empty-state
  // branch below) has no student record to search/filter on — search and
  // the status filter still apply (status/roll-no-search work off the
  // application itself where possible), but it can never match a name
  // search since there's no name to check.
  //
  // Split out from statusFilter/roundFilter (search-only base, below) so the
  // status/round summary chips can count "how many at each status/round"
  // against search alone — counting against the fully-filtered list would
  // make picking one status/round chip erase every other chip's count.
  const searchFilteredRows = useMemo(() => {
    if (!rows) return rows;
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.student && (r.student.rollNo.toLowerCase().includes(term) || r.student.name.toLowerCase().includes(term)));
  }, [rows, search]);

  const filteredRows = useMemo(() => {
    if (!searchFilteredRows) return searchFilteredRows;
    return searchFilteredRows.filter((r) => {
      if (statusFilter && r.application.status !== statusFilter) return false;
      if (roundFilter && r.application.currentRoundId !== roundFilter) return false;
      return true;
    });
  }, [searchFilteredRows, statusFilter, roundFilter]);

  // Counts behind the summary chips — round counts match whatever's
  // currently sitting at that round regardless of status (same semantics as
  // the Round filter dropdown itself: rejected-but-still-tagged applicants
  // included), not just "in_round" ones.
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<ApplicationStatus, number>> = {};
    for (const r of searchFilteredRows ?? []) counts[r.application.status] = (counts[r.application.status] ?? 0) + 1;
    return counts;
  }, [searchFilteredRows]);

  const roundCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of searchFilteredRows ?? []) {
      if (r.application.currentRoundId) counts[r.application.currentRoundId] = (counts[r.application.currentRoundId] ?? 0) + 1;
    }
    return counts;
  }, [searchFilteredRows]);

  function toggleStatusChip(status: ApplicationStatus) {
    setStatusFilter((prev) => (prev === status ? "" : status));
  }

  function toggleRoundChip(roundId: string) {
    setRoundFilter((prev) => (prev === roundId ? "" : roundId));
  }

  // "Details restricted" rows have no student record to sort by — pinned to
  // the end rather than left in whatever position the unsorted default
  // happened to place them, for both the rollNo and cgpa orderings.
  const sortedRows = useMemo(() => {
    if (!filteredRows || sortBy === "default") return filteredRows;
    const withStudent = filteredRows.filter((r) => r.student);
    const withoutStudent = filteredRows.filter((r) => !r.student);
    withStudent.sort((a, b) =>
      sortBy === "rollNo" ? a.student!.rollNo.localeCompare(b.student!.rollNo) : b.student!.cgpa - a.student!.cgpa
    );
    return [...withStudent, ...withoutStudent];
  }, [filteredRows, sortBy]);

  useEffect(() => {
    if (!driveId) return;
    return onValue(ref(db, `${DB_NODES.drives}/${driveId}`), (snap) => {
      setDrive(snap.exists() ? (snap.val() as Drive) : null);
    });
  }, [driveId]);

  async function handleUpdate(applicationId: string, studentUid: string, status: ApplicationStatus, currentRoundId: string) {
    setUpdatingId(applicationId);
    try {
      await updateApplicationStatus(
        applicationId,
        status,
        currentRoundId || undefined,
        appUser && drive
          ? {
              studentUid,
              companyName: drive.companyName,
              roundName: currentRoundId ? drive.rounds?.find((r) => r.roundId === currentRoundId)?.name : undefined,
              sentBy: appUser.uid,
            }
          : undefined
      );
      showToast("Status updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setUpdatingId(null);
    }
  }

  // Removes the application entirely, not just its status — e.g. a
  // student applied but never actually showed up, and "withdrawn" still
  // leaves them cluttering the applicant list/counts.
  async function handleDelete(applicationId: string, department: Application["department"], label: string) {
    if (!window.confirm(`Delete ${label}'s application? This removes the record entirely — this can't be undone.`)) return;
    setDeletingId(applicationId);
    try {
      await deleteApplication(applicationId, department);
      showToast("Application deleted");
      setSelectedIds((prev) => {
        if (!prev.has(applicationId)) return prev;
        const next = new Set(prev);
        next.delete(applicationId);
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete application");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(applicationId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) next.delete(applicationId);
      else next.add(applicationId);
      return next;
    });
  }

  const visibleIds = useMemo(() => new Set((sortedRows ?? []).map((r) => r.application.applicationId)), [sortedRows]);
  const allVisibleSelected = visibleIds.size > 0 && [...visibleIds].every((id) => selectedIds.has(id));

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  // Same chunked-concurrency approach as handleBulkApply below — sequential
  // one-at-a-time updates for 229 selected applicants would take minutes;
  // chunking bounds it to roughly (selection size / CONCURRENCY) round trips.
  async function handleBulkStatusUpdate() {
    if (selectedIds.size === 0 || !rows) return;
    const ids = Array.from(selectedIds);
    const studentUidByAppId = new Map(rows.map((r) => [r.application.applicationId, r.application.studentId]));
    const roundName = bulkRoundValue ? drive?.rounds?.find((r) => r.roundId === bulkRoundValue)?.name : undefined;
    setBulkUpdating(true);
    setBulkUpdateProgress(0);
    const CONCURRENCY = 20;
    let failed = 0;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((id) => {
          const studentUid = studentUidByAppId.get(id);
          return Promise.race([
            updateApplicationStatus(
              id,
              bulkStatusValue,
              bulkRoundValue || undefined,
              appUser && drive && studentUid
                ? { studentUid, companyName: drive.companyName, roundName, sentBy: appUser.uid }
                : undefined
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 10000)),
          ]);
        })
      );
      failed += results.filter((r) => r.status === "rejected").length;
      setBulkUpdateProgress((p) => p + chunk.length);
    }
    setBulkUpdating(false);
    const updated = ids.length - failed;
    showToast(
      failed > 0
        ? `${updated} updated, ${failed} didn't finish in time — click again to retry (still selected)`
        : `${updated} applicant(s) updated to ${bulkStatusValue.replace("_", " ")}`
    );
    if (failed === 0) setSelectedIds(new Set());
  }

  // Same chunked-concurrency approach as the bulk status update above —
  // department comes from the application record itself (denormalized),
  // not the student, so this works even for "details restricted" rows.
  async function handleBulkDelete() {
    if (selectedIds.size === 0 || !rows) return;
    if (!window.confirm(`Delete ${selectedIds.size} application(s)? This removes the records entirely — this can't be undone.`)) return;
    const departmentById = new Map(rows.map((r) => [r.application.applicationId, r.application.department]));
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    setBulkDeleteProgress(0);
    let failed = 0;
    const CONCURRENCY = 20;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((id) => {
          const department = departmentById.get(id);
          if (!department) return Promise.reject(new Error("missing department"));
          return Promise.race([
            deleteApplication(id, department),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 10000)),
          ]);
        })
      );
      failed += results.filter((r) => r.status === "rejected").length;
      setBulkDeleteProgress((p) => p + chunk.length);
    }
    setBulkDeleting(false);
    const deleted = ids.length - failed;
    showToast(
      failed > 0
        ? `${deleted} deleted, ${failed} didn't finish in time — click again to retry (still selected)`
        : `${deleted} application(s) deleted`
    );
    if (failed === 0) setSelectedIds(new Set());
  }

  // Exports whatever's selected, or every currently-shown row if nothing is
  // checked — same selection Set the bulk status update above already uses.
  // Rows with no student record ("details restricted", a different
  // department) are skipped since there's nothing to export for them.
  function handleExportCompanyFormat() {
    if (!sortedRows) return;
    const targetRows = selectedIds.size > 0 ? sortedRows.filter((r) => selectedIds.has(r.application.applicationId)) : sortedRows;
    const withStudent = targetRows.filter(
      (r): r is { application: Application; student: Student } => r.student !== null
    );
    if (withStudent.length === 0) {
      showToast("No exportable students in this selection");
      return;
    }
    const extraCols = extraColumns
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const headers = [...COMPANY_FORMAT_HEADERS, ...extraCols];
    const rows = withStudent.map((r, i) => [
      ...companyFormatRow(i, r.student, drive ? applicationRoleLabel(drive, r.application) : ""),
      ...extraCols.map(() => ""),
    ]);
    downloadCsv(`${drive?.companyName ?? "drive"}-applicants.csv`.replace(/\s+/g, "-"), headers, rows);
  }

  // Eligible students the coordinator picked (hand-picked list, or criteria
  // match) who haven't clicked Apply themselves yet — e.g. when a company
  // hands the college an already-shortlisted roll number list and the
  // coordinator adds them via "Restrict to hand-picked students" rather than
  // waiting for each student to self-apply. Only covers students within this
  // coordinator/hod's own department scope (useStudentsDirectory) — DB rules
  // deny creating an application for a student outside it (see applications
  // .write in database.rules.json), so a drive open to multiple departments
  // needs each department's own coordinator to run this once.
  const notYetApplied = useMemo(() => {
    if (!drive || !students || !rows) return [];
    const appliedIds = new Set(rows.map((r) => r.application.studentId));
    return students.filter((s) => !s.isAlumni && !appliedIds.has(s.uid) && checkEligibility(s, drive).eligible);
  }, [drive, students, rows]);

  async function handleBulkApply() {
    if (!drive || notYetApplied.length === 0) return;
    if (!window.confirm(`Create "applied" records for ${notYetApplied.length} student(s) who haven't applied yet?`)) return;
    // Snapshot the list up front — notYetApplied itself shrinks as each write
    // lands (rows is a live listener, so it re-renders mid-batch), but that's
    // just the source recomputing; this closure keeps iterating the original
    // batch. Fired in parallel chunks rather than one at a time: sequential
    // awaits meant one slow/stuck write (or a run of permission-denied
    // rejections for students outside this coordinator's department) added up
    // to minutes of wall-clock time — and since this is plain client-side JS,
    // closing the tab killed whatever hadn't landed yet, which is why only
    // one showed up on reopen. Chunking bounds total time to roughly
    // (batch size / CONCURRENCY) round trips instead of the full batch size.
    const CONCURRENCY = 20;
    const batch = notYetApplied;
    setBulkApplying(true);
    setBulkProgress(0);
    setBulkTotal(batch.length);
    let failed = 0;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((student) =>
          Promise.race([
            applyToDrive(student, drive),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), 10000)),
          ])
        )
      );
      failed += results.filter((r) => r.status === "rejected").length;
      setBulkProgress((p) => p + chunk.length);
    }
    setBulkApplying(false);
    // A "timed out" student here isn't necessarily lost — the underlying
    // Firebase write may still land after our client-side timeout gives up
    // on it. Either way it's safe: notYetApplied only ever lists students
    // without an application yet, so re-running the button never double-
    // applies, it just picks up whoever's still missing.
    const created = batch.length - failed;
    showToast(
      failed > 0
        ? `${created} applied, ${failed} didn't finish in time — click again to retry just those, it's safe to re-run`
        : `${created} student(s) marked applied`
    );
  }

  return (
    <div>
      <Link to="/staff/drives" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to drives
      </Link>

      <PageHeader
        title={drive ? `${drive.companyName} — Applicants` : "Applicants"}
        subtitle={
          drive
            ? `${driveRoleSummary(drive)} · ${
                sortedRows && rows && sortedRows.length !== rows.length
                  ? `${sortedRows.length} of ${rows.length} applicant(s)`
                  : `${rows?.length ?? 0} applicant(s)`
              }`
            : undefined
        }
        icon={Users}
        gradient="from-blue-500 to-indigo-600"
        action={
          notYetApplied.length > 0 ? (
            <Button onClick={handleBulkApply} loading={bulkApplying}>
              <UserPlus className="h-4 w-4" />
              {bulkApplying ? `Applying ${bulkProgress}/${bulkTotal}…` : `Mark ${notYetApplied.length} as applied`}
            </Button>
          ) : undefined
        }
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

      {/* Summary — status/round counts you'd otherwise have to click through
          the filters below one at a time to piece together. Click a chip to
          filter the list to exactly that status/round; click it again to
          clear. Zero-count chips are hidden rather than shown grey — a drive
          just starting out shouldn't show five empty buckets. */}
      {rows !== null && rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {STATUS_CHIP_OPTIONS.map((s) => {
            const count = statusCounts[s] ?? 0;
            if (count === 0) return null;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatusChip(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${CHIP_CLASSES[STATUS_BADGE[s]]} ${
                  active ? "ring-2 ring-offset-1 ring-brand-500" : ""
                }`}
              >
                {s.replace("_", " ")} ({count})
              </button>
            );
          })}
          {drive?.rounds?.map((r) => {
            const count = roundCounts[r.roundId] ?? 0;
            if (count === 0) return null;
            const active = roundFilter === r.roundId;
            return (
              <button
                key={r.roundId}
                type="button"
                onClick={() => toggleRoundChip(r.roundId)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${CHIP_CLASSES.warning} ${
                  active ? "ring-2 ring-offset-1 ring-brand-500" : ""
                }`}
              >
                At {r.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search roll no or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="applicants-status-filter" className="text-xs font-medium text-slate-500">
              Status
            </label>
            <select
              id="applicants-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "")}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            {drive && (drive.rounds ?? []).length > 0 && (
              <>
                <label htmlFor="applicants-round-filter" className="text-xs font-medium text-slate-500">
                  Round
                </label>
                <select
                  id="applicants-round-filter"
                  value={roundFilter}
                  onChange={(e) => setRoundFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">All rounds</option>
                  {drive.rounds.map((r) => (
                    <option key={r.roundId} value={r.roundId}>
                      At {r.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="applicants-sort" className="text-xs font-medium text-slate-500">
              Sort by
            </label>
            <select
              id="applicants-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "default" | "rollNo" | "cgpa")}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="default">Application order</option>
              <option value="rollNo">Roll No</option>
              <option value="cgpa">CGPA (high to low)</option>
            </select>
          </div>
        </div>
      )}

      {rows !== null && rows.length > 0 && sortedRows?.length === 0 && (
        <EmptyState icon={Search} title="No applicants match this search/filter" />
      )}

      {sortedRows && sortedRows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all ${sortedRows.length} shown`}
          </label>
          {selectedIds.size > 0 && (
            <>
              <span className="text-xs text-slate-400">Set status to</span>
              <select
                value={bulkStatusValue}
                onChange={(e) => setBulkStatusValue(e.target.value as ApplicationStatus)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              {drive && (drive.rounds ?? []).length > 0 && (
                <select
                  value={bulkRoundValue}
                  onChange={(e) => setBulkRoundValue(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">No round</option>
                  {drive.rounds.map((r) => (
                    <option key={r.roundId} value={r.roundId}>
                      At {r.name}
                    </option>
                  ))}
                </select>
              )}
              <Button onClick={handleBulkStatusUpdate} loading={bulkUpdating} disabled={bulkDeleting}>
                {bulkUpdating ? `Updating ${bulkUpdateProgress}/${selectedIds.size}…` : `Apply to ${selectedIds.size}`}
              </Button>
              <Button variant="danger" onClick={handleBulkDelete} loading={bulkDeleting} disabled={bulkUpdating}>
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? `Deleting ${bulkDeleteProgress}/${selectedIds.size}…` : `Delete ${selectedIds.size}`}
              </Button>
              <Button variant="secondary" onClick={() => setSelectedIds(new Set())} disabled={bulkUpdating || bulkDeleting}>
                Clear
              </Button>
            </>
          )}
        </div>
      )}

      {sortedRows && sortedRows.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <input
            type="text"
            placeholder="Extra columns this company wants (comma-separated, optional)"
            value={extraColumns}
            onChange={(e) => setExtraColumns(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Button variant="secondary" onClick={handleExportCompanyFormat} className="shrink-0">
            <Download className="h-4 w-4" />
            Export {selectedIds.size > 0 ? `${selectedIds.size} selected` : `all ${sortedRows.length} shown`} — Company Format
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {sortedRows?.map(({ application, student }) => (
          <Card key={application.applicationId} className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(application.applicationId)}
                onChange={() => toggleSelect(application.applicationId)}
                className="shrink-0"
              />
              {student && <Avatar photoUrl={student.photoUrl} name={student.name} />}
              <div className="min-w-0">
                {student ? (
                  <>
                    <p className="font-medium text-slate-900">
                      {student.rollNo} — {student.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {student.department} · CGPA {student.cgpa}
                      {drive && isMultiRole(drive) && ` · Applied for ${applicationRoleLabel(drive, application)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Details restricted (different department)</p>
                )}
                {drive && (drive.rounds ?? []).length > 0 && (
                  <div className="mt-2">
                    <RoundProgress rounds={drive.rounds} application={application} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Badge variant={STATUS_BADGE[application.status]}>{application.status.replace("_", " ")}</Badge>
              <select
                value={application.status}
                disabled={updatingId === application.applicationId}
                onChange={(e) =>
                  handleUpdate(
                    application.applicationId,
                    application.studentId,
                    e.target.value as ApplicationStatus,
                    application.currentRoundId ?? ""
                  )
                }
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
              {drive && (drive.rounds ?? []).length > 0 && (
                <select
                  value={application.currentRoundId ?? ""}
                  disabled={updatingId === application.applicationId}
                  onChange={(e) => handleUpdate(application.applicationId, application.studentId, application.status, e.target.value)}
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
              <Button
                variant="danger"
                onClick={() =>
                  handleDelete(application.applicationId, application.department, student ? `${student.rollNo} — ${student.name}` : "this")
                }
                loading={deletingId === application.applicationId}
                className="!px-2 !py-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
