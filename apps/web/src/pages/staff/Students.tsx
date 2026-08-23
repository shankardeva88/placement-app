import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Users, Search, Upload, UserPlus, GraduationCap, RefreshCw } from "lucide-react";
import type { Department, Gender, PlacementStatus } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { createBulkStudent } from "../../lib/bulkImportLib";
import { useAllTrainingBatches } from "../../lib/trainingManagementLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { Avatar } from "../../components/ui/Avatar";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];
const GENDERS: Gender[] = ["male", "female", "other", "prefer_not_to_say"];
const CAN_BULK_IMPORT_ROLES = ["coordinator", "hod", "dean", "principal", "cpo", "admin"];
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const PLACEMENT_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function AddStudentForm({ onDone }: { onDone: () => void }) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const myDept = appUser && "department" in appUser ? appUser.department : undefined;
  const [rollNo, setRollNo] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("prefer_not_to_say");
  const [department, setDepartment] = useState<Department>(myDept ?? "CSE");
  const [cgpa, setCgpa] = useState(0);
  const [activeBacklogs, setActiveBacklogs] = useState(0);
  const [batchYear, setBatchYear] = useState(new Date().getFullYear());
  const [studentPhone, setStudentPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [tenthPercentage, setTenthPercentage] = useState("");
  const [tenthYearOfPassing, setTenthYearOfPassing] = useState("");
  const [twelfthPercentage, setTwelfthPercentage] = useState("");
  const [twelfthYearOfPassing, setTwelfthYearOfPassing] = useState("");
  const [email, setEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rollNo.trim().length < 6) {
      setError("Roll number must be 6+ characters — it's used as the temporary password.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await createBulkStudent({
        rowIndex: 1,
        rollNo: rollNo.trim(),
        name: name.trim(),
        gender,
        department,
        cgpa,
        activeBacklogs,
        batchYear,
        studentPhone: studentPhone.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : undefined,
        tenthPercentage: tenthPercentage === "" ? undefined : Number(tenthPercentage),
        tenthYearOfPassing: tenthYearOfPassing === "" ? undefined : Number(tenthYearOfPassing),
        twelfthPercentage: twelfthPercentage === "" ? undefined : Number(twelfthPercentage),
        twelfthYearOfPassing: twelfthYearOfPassing === "" ? undefined : Number(twelfthYearOfPassing),
        email: email.trim(),
        personalEmail: personalEmail.trim(),
        resumeUrl: resumeUrl.trim(),
        warnings: [],
        errors: [],
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      showToast("Student added");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Add student</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Roll number</label>
            <input required value={rollNo} onChange={(e) => setRollNo(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={inputClass}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Batch year</label>
            <input type="number" value={batchYear} onChange={(e) => setBatchYear(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>CGPA</label>
            <input type="number" step="0.01" min={0} max={10} value={cgpa} onChange={(e) => setCgpa(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Active backlogs</label>
            <input type="number" min={0} value={activeBacklogs} onChange={(e) => setActiveBacklogs(Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Date of birth</label>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>10th %</label>
            <input type="number" step="0.01" value={tenthPercentage} onChange={(e) => setTenthPercentage(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>10th year</label>
            <input type="number" value={tenthYearOfPassing} onChange={(e) => setTenthYearOfPassing(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>12th %</label>
            <input type="number" step="0.01" value={twelfthPercentage} onChange={(e) => setTwelfthPercentage(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>12th year</label>
            <input type="number" value={twelfthYearOfPassing} onChange={(e) => setTwelfthYearOfPassing(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>College email (login)</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Personal email</label>
            <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Resume link</label>
            <input type="url" value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} className={inputClass} />
          </div>
        </div>

        <p className="text-xs text-slate-500">Login password is set to the roll number above.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" loading={submitting}>
            Add student
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function Students() {
  const { appUser } = useAuth();
  const students = useStudentsDirectory(appUser);
  const trainingBatches = useAllTrainingBatches();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [trainingFilter, setTrainingFilter] = useState("");
  const [recentlyUpdatedOnly, setRecentlyUpdatedOnly] = useState(false);
  const [showAlumni, setShowAlumni] = useState(false);
  const [sortBy, setSortBy] = useState<"rollNo" | "recentlyUpdated">("rollNo");
  const [adding, setAdding] = useState(false);
  const canBulkImport = !!appUser && CAN_BULK_IMPORT_ROLES.includes(appUser.role);

  const batchYears = useMemo(() => {
    if (!students) return [];
    return Array.from(new Set(students.map((s) => s.batchYear))).sort((a, b) => a - b);
  }, [students]);

  // Two unrelated "training" concepts share this page: s.trainings is
  // completion records from the Import Trainings CSV upload; TrainingBatch
  // is the live scheduled batch from Training.tsx (attendance/sessions).
  // Prefixing option values keeps them distinguishable even if a batch and
  // an imported record happen to share a name.
  const trainingNames = useMemo(() => {
    if (!students) return [];
    const names = new Set<string>();
    for (const s of students) for (const name of Object.keys(s.trainings ?? {})) names.add(name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const trainingBatchOptions = useMemo(() => {
    if (!trainingBatches) return [];
    return Array.from(new Set(trainingBatches.map((b) => b.name))).sort((a, b) => a.localeCompare(b));
  }, [trainingBatches]);

  const studentIdsByBatchName = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const b of trainingBatches ?? []) {
      if (!map.has(b.name)) map.set(b.name, new Set());
      for (const uid of b.studentIds) map.get(b.name)!.add(uid);
    }
    return map;
  }, [trainingBatches]);

  const filtered = useMemo(() => {
    if (!students) return null;
    const term = search.trim().toLowerCase();
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return students
      .filter((s) => {
        if (!showAlumni && s.isAlumni) return false;
        if (deptFilter && s.department !== deptFilter) return false;
        if (batchFilter && s.batchYear !== batchFilter) return false;
        if (trainingFilter.startsWith("batch:")) {
          if (!studentIdsByBatchName.get(trainingFilter.slice(6))?.has(s.uid)) return false;
        } else if (trainingFilter.startsWith("import:")) {
          if (!(s.trainings ?? {})[trainingFilter.slice(7)]) return false;
        }
        if (recentlyUpdatedOnly && (!s.lastSignificantUpdateAt || s.lastSignificantUpdateAt < cutoff)) return false;
        if (!term) return true;
        return (
          s.name.toLowerCase().includes(term) ||
          s.rollNo.toLowerCase().includes(term) ||
          (s.skills ?? []).some((skill) => skill.toLowerCase().includes(term)) ||
          Object.keys(s.trainings ?? {}).some((training) => training.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => {
        if (sortBy === "recentlyUpdated") {
          return (b.lastSignificantUpdateAt ?? 0) - (a.lastSignificantUpdateAt ?? 0);
        }
        // Plain lexicographic compare, NOT { numeric: true } — this college's
        // roll numbers are fixed-width per segment (...0501-0599, then a
        // lettered lateral-entry series A0-A9, B0-B9, ...), and numeric mode
        // tokenizes digit runs as integers, which sorts "05A0" (run "05" = 5)
        // before "0501" (run "0501" = 501) — backwards. Plain string
        // comparison sorts '0'-'9' before 'A'-'Z' character-by-character,
        // which is exactly the order this fixed-width format needs.
        return a.rollNo.localeCompare(b.rollNo);
      });
  }, [students, search, deptFilter, batchFilter, trainingFilter, studentIdsByBatchName, recentlyUpdatedOnly, showAlumni, sortBy]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={
          appUser && "department" in appUser && appUser.department
            ? `Department: ${appUser.department}`
            : "All departments"
        }
        icon={Users}
        gradient="from-emerald-500 to-teal-600"
        action={
          canBulkImport ? (
            <div className="flex flex-wrap gap-2">
              {!adding && (
                <Button onClick={() => setAdding(true)}>
                  <UserPlus className="h-4 w-4" />
                  Add Student
                </Button>
              )}
              <Link to="/staff/bulk-import-students">
                <Button variant="secondary">
                  <Upload className="h-4 w-4" />
                  Bulk Import
                </Button>
              </Link>
              <Link to="/staff/bulk-update-students">
                <Button variant="secondary">
                  <RefreshCw className="h-4 w-4" />
                  Bulk Update
                </Button>
              </Link>
              <Link to="/staff/import-trainings">
                <Button variant="secondary">
                  <GraduationCap className="h-4 w-4" />
                  Import Trainings
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {adding && <AddStudentForm onDone={() => setAdding(false)} />}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, roll number, skill, or training"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | "")} className={`${inputClass} sm:w-48`}>
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
          className={`${inputClass} sm:w-40`}
        >
          <option value="">All batches</option>
          {batchYears.map((y) => (
            <option key={y} value={y}>
              Batch {y}
            </option>
          ))}
        </select>
        <select value={trainingFilter} onChange={(e) => setTrainingFilter(e.target.value)} className={`${inputClass} sm:w-48`}>
          <option value="">All trainings</option>
          {trainingBatchOptions.length > 0 && (
            <optgroup label="Scheduled batches">
              {trainingBatchOptions.map((t) => (
                <option key={`batch:${t}`} value={`batch:${t}`}>
                  {t}
                </option>
              ))}
            </optgroup>
          )}
          {trainingNames.length > 0 && (
            <optgroup label="Imported trainings">
              {trainingNames.map((t) => (
                <option key={`import:${t}`} value={`import:${t}`}>
                  {t}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={recentlyUpdatedOnly} onChange={(e) => setRecentlyUpdatedOnly(e.target.checked)} />
          Recently updated only (last 7 days)
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showAlumni} onChange={(e) => setShowAlumni(e.target.checked)} />
          Show graduated (alumni)
        </label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={`${inputClass} sm:w-56`}>
          <option value="rollNo">Sort: Roll No</option>
          <option value="recentlyUpdated">Sort: Recently updated first</option>
        </select>
      </div>

      {filtered === null && (
        <div className="space-y-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      {filtered !== null && filtered.length === 0 && (
        <EmptyState icon={Users} title="No students found" />
      )}

      <div className="space-y-3">
        {filtered?.map((s) => (
          <Link key={s.studentId} to={`/staff/students/${s.studentId}`}>
            <Card className="flex items-center justify-between gap-4 transition-shadow hover:shadow-md">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar photoUrl={s.photoUrl} name={s.name} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {s.rollNo} — {s.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {s.department} · Batch {s.batchYear} · CGPA {s.cgpa}
                  </p>
                  {(s.skills ?? []).length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">{(s.skills ?? []).join(", ")}</p>
                  )}
                  {Object.keys(s.trainings ?? {}).length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      Training: {Object.keys(s.trainings ?? {}).join(", ")}
                    </p>
                  )}
                  {s.lastSignificantUpdateAt && (
                    <p className="mt-0.5 text-xs text-slate-400">Profile updated {formatRelativeTime(s.lastSignificantUpdateAt)}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.lastSignificantUpdateAt && Date.now() - s.lastSignificantUpdateAt < RECENT_WINDOW_MS && (
                  <Badge variant="brand">Recently updated</Badge>
                )}
                {s.verifiedByFaculty && <Badge variant="success">Verified</Badge>}
                {s.isAlumni && <Badge variant="neutral">Alumni</Badge>}
                <Badge variant={PLACEMENT_BADGE[s.placementStatus]}>{s.placementStatus.replace("_", " ")}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
