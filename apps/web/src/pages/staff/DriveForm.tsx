import { useState } from "react";
import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { Department, Drive, DriveRound, DriveType, Gender } from "@placement-app/types";
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
  const thisYear = new Date().getFullYear();
  const yearOptions = [thisYear, thisYear + 1, thisYear + 2, thisYear + 3];

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
  function updateRoundName(roundId: string, name: string) {
    setRounds((prev) => prev.map((r) => (r.roundId === roundId ? { ...r, name } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (departments.length === 0) {
      setError("Select at least one eligible department.");
      return;
    }
    if (batchYears.length === 0) {
      setError("Select at least one eligible batch year.");
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
        batchYears,
        requiredSkills: skillsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        requiredTrainings: trainingsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        gender,
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
          <label className={labelClass}>Job role</label>
          <input type="text" required value={jobRole} onChange={(e) => setJobRole(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as DriveType)} className={inputClass}>
            <option value="full_time">Full time</option>
            <option value="internship">Internship</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>CTC (LPA)</label>
          <input type="number" step="0.1" min={0} required value={ctc} onChange={(e) => setCtc(Number(e.target.value))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Drive date</label>
          <input type="date" required value={driveDate} onChange={(e) => setDriveDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Job description link (optional)</label>
        <input type="url" placeholder="https://drive.google.com/..." value={jdUrl} onChange={(e) => setJdUrl(e.target.value)} className={inputClass} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Eligibility</h3>
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
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Rounds</h3>
        <div className="space-y-2">
          {rounds.map((r) => (
            <div key={r.roundId} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Round name"
                value={r.name}
                onChange={(e) => updateRoundName(r.roundId, e.target.value)}
                className={inputClass}
              />
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
