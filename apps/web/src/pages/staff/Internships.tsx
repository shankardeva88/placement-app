import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Briefcase, Check, Plus, Search, Trash2 } from "lucide-react";
import type { Internship, InternshipMode, InternshipStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllInternships, recordInternship, updateInternship, deleteInternship } from "../../lib/internshipsLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const MODE_OPTIONS: InternshipMode[] = ["remote", "in_office", "hybrid"];
const MODE_LABEL: Record<InternshipMode, string> = {
  remote: "Remote",
  in_office: "In office",
  hybrid: "Hybrid",
};
const STATUS_BADGE: Record<InternshipStatus, BadgeVariant> = {
  ongoing: "warning",
  completed: "success",
};

function durationLabel(months: number): string {
  return months === 1 ? "1 month" : `${months} months`;
}

function StudentSearchPicker({
  students,
  value,
  onChange,
}: {
  students: Student[];
  value: string;
  onChange: (uid: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.rollNo.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [students, query]);

  const selected = students.find((s) => s.uid === value);

  return (
    <div>
      <input
        type="text"
        placeholder="Search by roll no or name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        className={inputClass}
      />
      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
        {filtered.length === 0 && <p className="p-2 text-sm text-slate-400">No students match.</p>}
        {filtered.map((s) => (
          <button
            type="button"
            key={s.studentId}
            onClick={() => onChange(s.uid)}
            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
              value === s.uid ? "bg-brand-50 font-medium text-brand-700" : "text-slate-700"
            }`}
          >
            <span>
              <span className="font-medium">{s.rollNo}</span> — {s.name}
            </span>
            {value === s.uid && <Check className="h-3.5 w-3.5 text-brand-600" />}
          </button>
        ))}
      </div>
      {selected && (
        <p className="mt-1 text-xs text-slate-500">
          Selected: {selected.rollNo} — {selected.name}
        </p>
      )}
    </div>
  );
}

interface InternshipFormValues {
  companyName: string;
  role: string;
  durationMonths: number;
  startDate: string;
  stipend: string;
  mode: InternshipMode | "";
  status: InternshipStatus;
  offerLetterUrl: string;
  completionCertificateUrl: string;
}

function InternshipForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Internship;
  submitLabel: string;
  onSubmit: (values: InternshipFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [companyName, setCompanyName] = useState(initial?.companyName ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [durationMonths, setDurationMonths] = useState(initial?.durationMonths ?? 3);
  const [startDate, setStartDate] = useState(initial ? new Date(initial.startDate).toISOString().slice(0, 10) : "");
  const [stipend, setStipend] = useState(initial?.stipend != null ? String(initial.stipend) : "");
  const [mode, setMode] = useState<InternshipMode | "">(initial?.mode ?? "");
  const [status, setStatus] = useState<InternshipStatus>(initial?.status ?? "ongoing");
  const [offerLetterUrl, setOfferLetterUrl] = useState(initial?.offerLetterUrl ?? "");
  const [completionCertificateUrl, setCompletionCertificateUrl] = useState(initial?.completionCertificateUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !role.trim() || !startDate || durationMonths <= 0) {
      setError("Fill in company, role, duration, and start date.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        companyName: companyName.trim(),
        role: role.trim(),
        durationMonths,
        startDate,
        stipend,
        mode,
        status,
        offerLetterUrl: offerLetterUrl.trim(),
        completionCertificateUrl: completionCertificateUrl.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Company</label>
          <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <input required value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Duration (months)</label>
          <input
            type="number"
            min={1}
            required
            placeholder="e.g. 3, 6, 12"
            value={durationMonths}
            onChange={(e) => setDurationMonths(Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Start date</label>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Stipend per month (optional)</label>
          <input type="number" min={0} value={stipend} onChange={(e) => setStipend(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as InternshipMode | "")} className={inputClass}>
            <option value="">Not specified</option>
            {MODE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as InternshipStatus)} className={inputClass}>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Offer letter link (optional)</label>
        <input type="url" value={offerLetterUrl} onChange={(e) => setOfferLetterUrl(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Completion certificate / proof link (optional)</label>
        <input
          type="url"
          value={completionCertificateUrl}
          onChange={(e) => setCompletionCertificateUrl(e.target.value)}
          className={inputClass}
        />
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

function AddInternshipForm({ onDone }: { onDone: () => void }) {
  const { appUser, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const [studentUid, setStudentUid] = useState("");

  const selectedStudent = students?.find((s) => s.uid === studentUid) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Student</label>
        {students === null ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <StudentSearchPicker students={students} value={studentUid} onChange={setStudentUid} />
        )}
      </div>
      {selectedStudent && (
        <InternshipForm
          submitLabel="Record internship"
          onCancel={onDone}
          onSubmit={async (values) => {
            if (!firebaseUser) return;
            await recordInternship({
              studentId: selectedStudent.uid,
              department: selectedStudent.department,
              companyName: values.companyName,
              role: values.role,
              durationMonths: values.durationMonths,
              startDate: new Date(values.startDate).getTime(),
              stipend: values.stipend === "" ? undefined : Number(values.stipend),
              mode: values.mode || undefined,
              status: values.status,
              offerLetterUrl: values.offerLetterUrl || undefined,
              completionCertificateUrl: values.completionCertificateUrl || undefined,
              createdBy: firebaseUser.uid,
            });
            showToast("Internship recorded");
            onDone();
          }}
        />
      )}
    </div>
  );
}

function InternshipCard({ internship, student }: { internship: Internship; student: Student | null }) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleUpdate(values: InternshipFormValues) {
    await updateInternship(internship.internshipId, {
      companyName: values.companyName,
      role: values.role,
      durationMonths: values.durationMonths,
      startDate: new Date(values.startDate).getTime(),
      stipend: values.stipend === "" ? null : Number(values.stipend),
      mode: values.mode || null,
      status: values.status,
      offerLetterUrl: values.offerLetterUrl || null,
      completionCertificateUrl: values.completionCertificateUrl || null,
    });
    showToast("Internship updated");
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete this internship record for ${student?.name ?? internship.studentId}? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteInternship(internship.internshipId, internship.studentId, internship.department);
      showToast("Internship deleted");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not delete");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-900">Edit internship</h3>
        <InternshipForm initial={internship} submitLabel="Save changes" onCancel={() => setEditing(false)} onSubmit={handleUpdate} />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-slate-900">{student ? `${student.rollNo} — ${student.name}` : internship.studentId}</p>
          <p className="text-sm text-slate-500">
            {internship.companyName} — {internship.role}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[internship.status]}>{internship.status}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-500">Duration</dt>
          <dd className="font-medium text-slate-900">{durationLabel(internship.durationMonths)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Start date</dt>
          <dd className="font-medium text-slate-900">{new Date(internship.startDate).toLocaleDateString()}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Mode</dt>
          <dd className="font-medium text-slate-900">{internship.mode ? MODE_LABEL[internship.mode] : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Stipend</dt>
          <dd className="font-medium text-slate-900">{internship.stipend != null ? `₹${internship.stipend}/mo` : "—"}</dd>
        </div>
      </dl>

      {(internship.offerLetterUrl || internship.completionCertificateUrl) && (
        <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-sm">
          {internship.offerLetterUrl && (
            <a href={internship.offerLetterUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
              Offer letter
            </a>
          )}
          {internship.completionCertificateUrl && (
            <a href={internship.completionCertificateUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
              Completion certificate
            </a>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="danger" onClick={handleDelete} loading={deleting}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>
    </Card>
  );
}

export default function StaffInternships() {
  const { appUser } = useAuth();
  const internships = useAllInternships(appUser);
  const students = useStudentsDirectory(appUser);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InternshipStatus | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [durationFilter, setDurationFilter] = useState<number | "">("");

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const batchYears = useMemo(
    () => Array.from(new Set((students ?? []).map((s) => s.batchYear))).sort((a, b) => a - b),
    [students]
  );

  const durationOptions = useMemo(
    () => Array.from(new Set((internships ?? []).map((i) => i.durationMonths))).sort((a, b) => a - b),
    [internships]
  );

  const rows = useMemo(() => {
    if (!internships) return null;
    const term = search.trim().toLowerCase();
    return internships
      .map((i) => ({ internship: i, student: studentsByUid[i.studentId] ?? null }))
      .filter((r) => !statusFilter || r.internship.status === statusFilter)
      .filter((r) => !batchFilter || r.student?.batchYear === batchFilter)
      .filter((r) => !durationFilter || r.internship.durationMonths === durationFilter)
      .filter((r) => {
        if (!term) return true;
        return (
          r.internship.companyName.toLowerCase().includes(term) ||
          r.internship.role.toLowerCase().includes(term) ||
          (r.student?.name.toLowerCase().includes(term) ?? false) ||
          (r.student?.rollNo.toLowerCase().includes(term) ?? false)
        );
      })
      .sort((a, b) => b.internship.startDate - a.internship.startDate);
  }, [internships, studentsByUid, search, statusFilter, batchFilter, durationFilter]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const ongoing = rows.filter((r) => r.internship.status === "ongoing").length;
    return { total: rows.length, ongoing, completed: rows.length - ongoing };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Internships"
        subtitle={
          stats
            ? `${stats.total} internship(s) · ${stats.ongoing} ongoing · ${stats.completed} completed`
            : "Track student internships — separate from drive-based placements."
        }
        icon={Briefcase}
        gradient="from-cyan-500 to-blue-600"
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Record Internship
            </Button>
          )
        }
      />

      {creating && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Record internship</h3>
          <AddInternshipForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {internships !== null && internships.length > 0 && (
        <Card className="mb-4 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student, roll number, company, or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} py-2.5 pl-9`}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InternshipStatus | "")} className={inputClass}>
                <option value="">All statuses</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Batch</label>
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
            </div>
            <div>
              <label className={labelClass}>Duration</label>
              <select
                value={durationFilter}
                onChange={(e) => setDurationFilter(e.target.value ? Number(e.target.value) : "")}
                className={inputClass}
              >
                <option value="">All durations</option>
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {durationLabel(d)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>
      )}

      {internships === null && <Skeleton className="h-24" />}
      {internships !== null && internships.length === 0 && !creating && (
        <EmptyState
          icon={Briefcase}
          title="No internships recorded yet"
          subtitle="Track 3/6/12-month internships here, separate from drive-based placements."
        />
      )}
      {rows !== null && internships !== null && internships.length > 0 && rows.length === 0 && (
        <EmptyState icon={Search} title="No internships match your filters" />
      )}

      <div className="space-y-4">
        {rows?.map((r) => (
          <InternshipCard key={r.internship.internshipId} internship={r.internship} student={r.student} />
        ))}
      </div>
    </div>
  );
}
