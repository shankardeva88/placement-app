import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { Department, Drive, DriveRole, DriveRound, DriveType, Gender, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { Button } from "../../components/ui/Button";
import { cgpaToPercent, percentToCgpa } from "../../lib/driveActions";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

const GENDER_OPTIONS: { value: Gender | "any"; label: string }[] = [
  { value: "any", label: "No restriction" },
  { value: "male", label: "Male only" },
  { value: "female", label: "Female only" },
];

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

function toDateInputValue(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

let roundCounter = 0;
function newRoundId() {
  roundCounter += 1;
  return `round-${Date.now()}-${roundCounter}`;
}

let roleCounter = 0;
function newRoleId() {
  roleCounter += 1;
  return `role-${Date.now()}-${roleCounter}`;
}

/** Filters here are just to help narrow a large roster down to a
 * manageable shortlist — they don't get saved anywhere; only the checked
 * students end up in selectedStudentIds. */
function SelectedStudentsPicker({
  students,
  selectedIds,
  onChange,
}: {
  students: Student[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [minCgpaFilter, setMinCgpaFilter] = useState<number | "">("");
  const [query, setQuery] = useState("");

  const batchYears = useMemo(
    () => Array.from(new Set(students.map((s) => s.batchYear))).sort((a, b) => a - b),
    [students]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => !deptFilter || s.department === deptFilter)
      .filter((s) => !batchFilter || s.batchYear === batchFilter)
      .filter((s) => minCgpaFilter === "" || s.cgpa >= minCgpaFilter)
      .filter((s) => !q || s.rollNo.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [students, deptFilter, batchFilter, minCgpaFilter, query]);

  function toggle(uid: string) {
    onChange(selectedIds.includes(uid) ? selectedIds.filter((x) => x !== uid) : [...selectedIds, uid]);
  }
  function selectAllFiltered() {
    const ids = new Set(selectedIds);
    filtered.forEach((s) => ids.add(s.uid));
    onChange(Array.from(ids));
  }
  function clearAll() {
    onChange([]);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | "")} className={inputClass}>
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={batchFilter}
          onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
          className={inputClass}
        >
          <option value="">All batches</option>
          {batchYears.map((y) => (
            <option key={y} value={y}>
              Batch {y}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          min={0}
          max={10}
          placeholder="Min CGPA"
          value={minCgpaFilter}
          onChange={(e) => setMinCgpaFilter(e.target.value ? Number(e.target.value) : "")}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Search roll no or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          className={inputClass}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>{selectedIds.length} selected</span>
        <div className="flex gap-3">
          <button type="button" onClick={selectAllFiltered} className="font-medium text-brand-700 hover:underline">
            Select all {filtered.length} filtered
          </button>
          {selectedIds.length > 0 && (
            <button type="button" onClick={clearAll} className="font-medium text-slate-500 hover:underline">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        {filtered.length === 0 && <p className="p-2 text-sm text-slate-400">No students match these filters.</p>}
        {filtered.map((s) => (
          <label key={s.studentId} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
            <input type="checkbox" checked={selectedIds.includes(s.uid)} onChange={() => toggle(s.uid)} />
            <span className="font-medium text-slate-700">{s.rollNo}</span>
            <span className="truncate">{s.name}</span>
            <span className="ml-auto shrink-0 text-xs text-slate-400">
              {s.department} · CGPA {s.cgpa}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export interface DriveFormValues {
  companyName: string;
  jobRole: string;
  type: DriveType;
  ctc: number;
  jdUrl: string;
  driveDate: number;
  minCgpa: number;
  maxBacklogsAllowed: number;
  departments: Department[];
  batchYears: number[];
  requiredSkills: string[];
  requiredTrainings: string[];
  gender: Gender | "any";
  selectedStudentIds: string[];
  roles: DriveRole[];
  rounds: DriveRound[];
}

export function DriveForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: Drive;
  onSubmit: (values: DriveFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const activeStudents = useMemo(() => (students ?? []).filter((s) => !s.isAlumni), [students]);

  const thisYear = new Date().getFullYear();
  const yearOptions = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];

  const [restrictToSelected, setRestrictToSelected] = useState(!!initial?.selectedStudentIds?.length);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(initial?.selectedStudentIds ?? []);

  // In hand-picked mode there's no eligibility batch-year picker shown at all
  // (see the restrictToSelected branch below — the whole criteria section is
  // hidden, "the criteria fields don't apply"), but eligibility.batchYears
  // was still being submitted anyway from whatever it happened to default
  // to (the current year) — silently tagging a hand-picked drive with the
  // wrong batch, with no UI to notice or fix it. Derived from the actual
  // picked students instead, so it's always correct and never a separate
  // field that can drift out of sync with who's really on the list.
  const selectedStudentsBatchYears = useMemo(
    () => Array.from(new Set(activeStudents.filter((s) => selectedStudentIds.includes(s.uid)).map((s) => s.batchYear))).sort((a, b) => a - b),
    [activeStudents, selectedStudentIds]
  );

  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [jobRole, setJobRole] = useState(initial?.jobRole ?? "");
  const [type, setType] = useState<DriveType>(initial?.type ?? "full_time");
  const [ctc, setCtc] = useState(initial?.ctc ?? 0);
  const [jdUrl, setJdUrl] = useState(initial?.jdUrl ?? "");
  const [driveDate, setDriveDate] = useState(toDateInputValue(initial?.driveDate));
  const [minCgpa, setMinCgpa] = useState(initial?.eligibility.minCgpa ?? 0);
  const [maxBacklogsAllowed, setMaxBacklogsAllowed] = useState(initial?.eligibility.maxBacklogsAllowed ?? 0);
  const [departments, setDepartments] = useState<Department[]>(initial?.eligibility.departments ?? []);
  const [batchYears, setBatchYears] = useState<number[]>(initial?.eligibility.batchYears ?? [thisYear]);
  const [skillsText, setSkillsText] = useState(initial?.eligibility.requiredSkills?.join(", ") ?? "");
  const [trainingsText, setTrainingsText] = useState(initial?.eligibility.requiredTrainings?.join(", ") ?? "");
  const [gender, setGender] = useState<Gender | "any">(initial?.eligibility.gender ?? "any");
  const [rounds, setRounds] = useState<DriveRound[]>(
    initial?.rounds ?? [{ roundId: newRoundId(), name: "Aptitude", status: "pending" }]
  );
  const [extraRoles, setExtraRoles] = useState<DriveRole[]>(initial?.roles ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDepartment(d: Department) {
    setDepartments((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function toggleYear(y: number) {
    setBatchYears((prev) => (prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]));
  }
  function addRound() {
    setRounds((prev) => [...prev, { roundId: newRoundId(), name: "", status: "pending" }]);
  }
  function removeRound(roundId: string) {
    setRounds((prev) => prev.filter((r) => r.roundId !== roundId));
  }
  function addExtraRole() {
    setExtraRoles((prev) => [...prev, { roleId: newRoleId(), jobRole: "", ctc: 0 }]);
  }
  function removeExtraRole(roleId: string) {
    setExtraRoles((prev) => prev.filter((r) => r.roleId !== roleId));
  }
  function updateExtraRole(roleId: string, patch: Partial<Pick<DriveRole, "jobRole" | "ctc">>) {
    setExtraRoles((prev) => prev.map((r) => (r.roleId === roleId ? { ...r, ...patch } : r)));
  }
  function updateRoundName(roundId: string, name: string) {
    setRounds((prev) => prev.map((r) => (r.roundId === roundId ? { ...r, name } : r)));
  }
  function updateRoundStatus(roundId: string, status: DriveRound["status"]) {
    setRounds((prev) => prev.map((r) => (r.roundId === roundId ? { ...r, status } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (restrictToSelected) {
      if (selectedStudentIds.length === 0) {
        setError("Select at least one student.");
        return;
      }
    } else {
      if (departments.length === 0) {
        setError("Select at least one eligible department.");
        return;
      }
      if (batchYears.length === 0) {
        setError("Select at least one eligible batch year.");
        return;
      }
    }
    if (extraRoles.some((r) => !r.jobRole.trim())) {
      setError("Give every additional role a name, or remove it.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        companyName,
        jobRole,
        type,
        ctc,
        jdUrl,
        driveDate: driveDate ? new Date(driveDate).getTime() : Date.now(),
        minCgpa,
        maxBacklogsAllowed,
        departments,
        batchYears: restrictToSelected ? selectedStudentsBatchYears : batchYears,
        requiredSkills: skillsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        requiredTrainings: trainingsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        gender,
        selectedStudentIds: restrictToSelected ? selectedStudentIds : [],
        roles: extraRoles,
        rounds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save drive");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Company name</label>
          <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{extraRoles.length > 0 ? "Job role (1st role)" : "Job role"}</label>
          <input type="text" required value={jobRole} onChange={(e) => setJobRole(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as DriveType)} className={inputClass}>
            <option value="full_time">Full time</option>
            <option value="internship">Internship</option>
            <option value="internship_plus_full_time">Internship + Full time</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>{extraRoles.length > 0 ? "CTC (1st role, LPA)" : "CTC (LPA)"}</label>
          <input type="number" step="0.1" min={0} required value={ctc} onChange={(e) => setCtc(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Drive date</label>
          <input type="date" required value={driveDate} onChange={(e) => setDriveDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Additional roles (optional)</label>
        <p className="mb-2 text-xs text-slate-400">
          For a company hiring for more than one role/package in this drive — students pick which role they're
          applying for.
        </p>
        <div className="space-y-2">
          {extraRoles.map((r) => (
            <div key={r.roleId} className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Role name"
                  value={r.jobRole}
                  onChange={(e) => updateExtraRole(r.roleId, { jobRole: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="w-32 shrink-0">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder="CTC (LPA)"
                  value={r.ctc}
                  onChange={(e) => updateExtraRole(r.roleId, { ctc: Number(e.target.value) })}
                  className={inputClass}
                />
              </div>
              <button type="button" onClick={() => removeExtraRole(r.roleId)} className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Remove role">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addExtraRole} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
          <Plus className="h-4 w-4" />
          Add another role
        </button>
      </div>

      <div>
        <label className={labelClass}>Job description link (optional)</label>
        <input type="url" placeholder="https://drive.google.com/..." value={jdUrl} onChange={(e) => setJdUrl(e.target.value)} className={inputClass} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Eligibility</h3>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={restrictToSelected}
              onChange={(e) => setRestrictToSelected(e.target.checked)}
            />
            Restrict to hand-picked students
          </label>
        </div>

        {restrictToSelected ? (
          <div>
            <p className="mb-2 text-xs text-slate-400">
              Only the students checked below can see or apply to this drive — the criteria fields don't apply.
            </p>
            {students === null ? (
              <p className="text-sm text-slate-400">Loading students…</p>
            ) : (
              <SelectedStudentsPicker students={activeStudents} selectedIds={selectedStudentIds} onChange={setSelectedStudentIds} />
            )}
            {selectedStudentsBatchYears.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                Recorded batch year(s) for filtering/reports: {selectedStudentsBatchYears.join(", ")} — taken from the
                students picked above, not editable separately.
              </p>
            )}
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Minimum CGPA</label>
            <input type="number" step="0.01" min={0} max={10} value={minCgpa} onChange={(e) => setMinCgpa(Number(e.target.value))} className={inputClass} />
            <p className="mt-1 text-xs text-slate-400">
              ≈ {cgpaToPercent(minCgpa)}% — or type the company's percentage cutoff directly:{" "}
              <input
                type="number"
                step="0.1"
                min={0}
                max={100}
                placeholder="e.g. 75"
                onChange={(e) => e.target.value && setMinCgpa(percentToCgpa(Number(e.target.value)))}
                className="ml-1 w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-brand-500 focus:outline-none"
              />
              %
            </p>
          </div>
          <div>
            <label className={labelClass}>Max backlogs allowed</label>
            <input type="number" min={0} value={maxBacklogsAllowed} onChange={(e) => setMaxBacklogsAllowed(Number(e.target.value))} className={inputClass} />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>Eligible departments</label>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENTS.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => toggleDepartment(d)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  departments.includes(d) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>Eligible batch years</label>
          <div className="flex flex-wrap gap-2">
            {yearOptions.map((y) => (
              <button
                type="button"
                key={y}
                onClick={() => toggleYear(y)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  batchYears.includes(y) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Required skills (optional, comma separated)</label>
            <input
              type="text"
              placeholder="Python, SQL"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender | "any")} className={inputClass}>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>Required trainings (optional, comma separated)</label>
          <input
            type="text"
            placeholder="Infosys, SAP"
            value={trainingsText}
            onChange={(e) => setTrainingsText(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">
            Must match a training name exactly as uploaded via Import Trainings — a student is eligible once they
            have that training recorded, regardless of which batch/group they were in.
          </p>
        </div>
        </>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rounds</h3>
        <div className="space-y-2">
          {rounds.map((r) => (
            <div key={r.roundId} className="flex items-center gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Round name"
                  value={r.name}
                  onChange={(e) => updateRoundName(r.roundId, e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="w-40 shrink-0">
                <select
                  value={r.status}
                  onChange={(e) => updateRoundStatus(r.roundId, e.target.value as DriveRound["status"])}
                  className={inputClass}
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <button type="button" onClick={() => removeRound(r.roundId)} className="shrink-0 text-slate-400 hover:text-red-600" aria-label="Remove round">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRound} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
          <Plus className="h-4 w-4" />
          Add round
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
