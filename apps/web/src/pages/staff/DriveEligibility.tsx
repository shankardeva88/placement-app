import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Copy, Download, ListChecks, Shuffle } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { checkEligibility } from "../../lib/driveActions";
import {
  useMentorDirectory,
  useDrivePrepAssignments,
  useDrivePrepLoad,
  assignDrivePrep,
  autoDistribute,
  DEFAULT_MAX_PREP_PER_MENTOR,
} from "../../lib/drivePrepLib";
import { useAllMockInterviews } from "../../lib/mentorToolsLib";
import { useMockEvaluations } from "../../lib/mockEvaluationLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function toCsv(rows: { rollNo: string; name: string; department: string; cgpa: number; activeBacklogs: number; skills: string; gender: string; email: string }[]) {
  const header = ["Roll No", "Name", "Department", "CGPA", "Backlogs", "Skills", "Gender", "Email"];
  const lines = rows.map((r) =>
    [r.rollNo, r.name, r.department, r.cgpa, r.activeBacklogs, r.skills, r.gender, r.email]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export default function DriveEligibility() {
  const { driveId } = useParams<{ driveId: string }>();
  const { appUser, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const [drive, setDrive] = useState<Drive | null | undefined>(undefined);
  const students = useStudentsDirectory(appUser);
  const mentors = useMentorDirectory(appUser);
  const assignments = useDrivePrepAssignments(appUser, driveId);
  const mentorLoad = useDrivePrepLoad(appUser);
  const mockInterviews = useAllMockInterviews(appUser);
  const mockEvaluations = useMockEvaluations(appUser);

  const [pending, setPending] = useState<Record<string, string>>({}); // studentId -> mentorId (unsaved edits)
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<"cgpa" | "rollNo">("cgpa");

  // MockEvaluation (Mock Interview Modules, e.g. "Infosys Mock") has no
  // driveId, unlike the older one-off MockInterview — a module isn't tied to
  // a specific Drive record, so an exact per-drive match isn't possible. Any
  // evaluation at all counts as readiness evidence, matching the same
  // relaxation in MentorTools.tsx's My Drive Prep section.
  const evaluatedStudentIds = useMemo(() => new Set((mockEvaluations ?? []).map((e) => e.studentId)), [mockEvaluations]);

  useEffect(() => {
    if (!driveId) return;
    return onValue(ref(db, `${DB_NODES.drives}/${driveId}`), (snap) => {
      setDrive(snap.exists() ? (snap.val() as Drive) : null);
    });
  }, [driveId]);

  const eligible = useMemo(() => {
    if (!drive || !students) return null;
    return students
      .filter((s) => checkEligibility(s, drive).eligible)
      .sort((a, b) => (sortBy === "rollNo" ? a.rollNo.localeCompare(b.rollNo) : b.cgpa - a.cgpa));
  }, [drive, students, sortBy]);

  // "Students in scope" for the header count below — narrowed to the
  // students who could possibly be eligible at all (right batch year/
  // department), not every student useStudentsDirectory hands back. Without
  // this, a drive open to only the current graduating batch still counted
  // every other batch year in the denominator too, so e.g. "244 of 565"
  // looked like most of the department was ineligible on CGPA/backlogs when
  // really ~320 of those 565 were a different batch year entirely, never in
  // the running to begin with. Hand-picked drives use the picked-list size
  // itself — criteria don't apply there (see checkEligibility).
  const inScopeCount = useMemo(() => {
    if (!drive || !students) return null;
    if (drive.selectedStudentIds && drive.selectedStudentIds.length > 0) return drive.selectedStudentIds.length;
    const departments = drive.eligibility.departments ?? [];
    const batchYears = drive.eligibility.batchYears ?? [];
    return students.filter(
      (s) =>
        !s.isAlumni &&
        (departments.length === 0 || departments.includes(s.department)) &&
        (batchYears.length === 0 || batchYears.includes(s.batchYear))
    ).length;
  }, [drive, students]);

  const assignedMentorFor = (studentId: string) =>
    pending[studentId] ?? assignments?.find((a) => a.studentId === studentId)?.mentorId ?? "";

  const isReady = (studentId: string) =>
    !!mockInterviews?.some((mi) => mi.studentId === studentId && mi.driveId === driveId) ||
    evaluatedStudentIds.has(studentId);

  function buildRows() {
    if (!eligible) return [];
    return eligible.map((s) => ({
      rollNo: s.rollNo,
      name: s.name,
      department: s.department,
      cgpa: s.cgpa,
      activeBacklogs: s.activeBacklogs,
      skills: (s.skills ?? []).join("; "),
      gender: s.gender ?? "",
      email: s.personalEmail || "",
    }));
  }

  function handleDownloadCsv() {
    const csv = toCsv(buildRows());
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${drive?.companyName ?? "drive"}-eligibility-list.csv`.replace(/\s+/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyText() {
    if (!eligible) return;
    const lines = eligible.map((s, i) => `${i + 1}. ${s.rollNo} — ${s.name} — ${s.department}, CGPA ${s.cgpa}`);
    const text = `Eligible students for ${drive?.companyName} (${eligible.length}):\n\n${lines.join("\n")}`;
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard");
  }

  function handleAutoDistribute() {
    if (!eligible || !mentors || mentors.length === 0) return;
    const pairs = autoDistribute(
      eligible.map((s) => ({ uid: s.uid, department: s.department })),
      mentors.map((m) => m.uid),
      mentorLoad ?? {},
      DEFAULT_MAX_PREP_PER_MENTOR
    );
    setPending(Object.fromEntries(pairs.map((p) => [p.studentId, p.mentorId])));
    const skipped = eligible.length - pairs.length;
    if (skipped > 0) {
      showToast(`${skipped} student(s) left unassigned — all mentors are at the ${DEFAULT_MAX_PREP_PER_MENTOR}-student prep cap`);
    }
  }

  async function handleSaveAssignments() {
    if (!driveId || !firebaseUser || !eligible) return;
    const pairs = eligible
      .map((s) => ({ studentId: s.uid, department: s.department, mentorId: assignedMentorFor(s.uid) }))
      .filter((p) => p.mentorId);
    if (pairs.length === 0) return;
    setSaving(true);
    try {
      await assignDrivePrep(driveId, pairs, firebaseUser.uid);
      showToast(`${pairs.length} assignment(s) saved`);
      setPending({});
    } finally {
      setSaving(false);
    }
  }

  const hasPendingChanges = Object.keys(pending).length > 0;

  return (
    <div>
      <Link
        to="/staff/drives"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to drives
      </Link>

      <PageHeader
        title={drive ? `${drive.companyName} — Eligibility List` : "Eligibility List"}
        subtitle={drive ? `${eligible?.length ?? "…"} of ${inScopeCount ?? "…"} students in scope are eligible` : undefined}
        icon={ListChecks}
        gradient="from-blue-500 to-indigo-600"
        action={
          eligible && eligible.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleCopyText}>
                <Copy className="h-4 w-4" />
                Copy list
              </Button>
              <Button onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      {drive && (
        <Card className="mb-4">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {drive.selectedStudentIds && drive.selectedStudentIds.length > 0 ? "Selected students" : "Criteria"}
          </h3>
          {drive.selectedStudentIds && drive.selectedStudentIds.length > 0 ? (
            <p className="text-sm text-slate-600">
              Restricted to {drive.selectedStudentIds.length} hand-picked student(s) — eligibility criteria below don't apply.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="neutral">CGPA ≥ {drive.eligibility.minCgpa}</Badge>
              <Badge variant="neutral">Backlogs ≤ {drive.eligibility.maxBacklogsAllowed}</Badge>
              <Badge variant="neutral">{(drive.eligibility.departments ?? []).join(", ") || "Any department"}</Badge>
              <Badge variant="neutral">Batch {(drive.eligibility.batchYears ?? []).join(", ")}</Badge>
              {drive.eligibility.requiredSkills && drive.eligibility.requiredSkills.length > 0 && (
                <Badge variant="neutral">Skills: {drive.eligibility.requiredSkills.join(", ")}</Badge>
              )}
              {drive.eligibility.gender && drive.eligibility.gender !== "any" && (
                <Badge variant="neutral">{drive.eligibility.gender} only</Badge>
              )}
            </div>
          )}
        </Card>
      )}

      {(drive === undefined || students === null) && <Skeleton className="h-40" />}

      {eligible !== null && (
        <Card className="mb-4">
          <div className="mb-3 flex items-center justify-end gap-2">
            <label htmlFor="eligibility-sort" className="text-xs font-medium text-slate-500">
              Sort by
            </label>
            <select
              id="eligibility-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "cgpa" | "rollNo")}
              className={inputClass}
            >
              <option value="cgpa">CGPA (high to low)</option>
              <option value="rollNo">Roll No</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">CGPA</th>
                  <th className="py-2 pr-4">Backlogs</th>
                  <th className="py-2 pr-4">Skills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligible.map((s) => (
                  <tr key={s.studentId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{s.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.cgpa}</td>
                    <td className="py-2 pr-4 text-slate-600">{s.activeBacklogs}</td>
                    <td className="py-2 pr-4 text-slate-600">{(s.skills ?? []).join(", ")}</td>
                  </tr>
                ))}
                {eligible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                      No students in scope currently meet this drive's criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {eligible !== null && eligible.length > 0 && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Drive prep — assign mentors</h3>
              <p className="text-xs text-slate-400">Each mentor sees their assigned students under Mentor Tools → My Drive Prep.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleAutoDistribute} disabled={!mentors || mentors.length === 0}>
                <Shuffle className="h-4 w-4" />
                Auto-distribute
              </Button>
              <Button onClick={handleSaveAssignments} loading={saving} disabled={!hasPendingChanges}>
                Save assignments
              </Button>
            </div>
          </div>

          {mentors !== null && mentors.length === 0 && (
            <p className="mb-3 text-sm text-slate-500">
              No faculty mentor accounts yet —{" "}
              <Link to="/staff/manage-staff" className="text-brand-700 underline">
                create one
              </Link>{" "}
              first.
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Mentor</th>
                  <th className="py-2 pr-4">Readiness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {eligible.map((s) => {
                  const currentMentor = assignedMentorFor(s.uid);
                  const ready = isReady(s.uid);
                  return (
                    <tr key={s.studentId}>
                      <td className="py-2 pr-4 font-medium text-slate-800">
                        {s.rollNo} — {s.name}
                      </td>
                      <td className="py-2 pr-4">
                        <select
                          value={currentMentor}
                          onChange={(e) => setPending((prev) => ({ ...prev, [s.uid]: e.target.value }))}
                          className={inputClass}
                        >
                          <option value="">Unassigned</option>
                          {mentors?.map((m) => (
                            <option key={m.uid} value={m.uid}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-4">
                        {!currentMentor ? (
                          <Badge variant="neutral">Not assigned</Badge>
                        ) : ready ? (
                          <Badge variant="success">
                            <CheckCircle2 className="mr-1 inline h-3 w-3" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="warning">Pending prep</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
