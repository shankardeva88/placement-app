import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Download, GraduationCap, Plus, Trash2, Upload, Users2 } from "lucide-react";
import type { AlumniPlacementStatus, AlumniRecord, Department } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import {
  useAllAlumni,
  createAlumniRecord,
  updateAlumniRecord,
  deleteAlumniRecord,
  bulkImportAlumni,
  parseAlumniCsv,
  ALUMNI_CSV_HEADERS,
} from "../../lib/alumniLib";
import type { AlumniInput, ParsedAlumniRow } from "../../lib/alumniLib";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllOffers } from "../../lib/offersManagementLib";
import { useDrivesById, buildGraduateBatchCandidates, graduateBatch, PLACEMENT_STATUS_MAP } from "../../lib/graduateBatchLib";
import { downloadCsv } from "../../lib/csv";
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

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];
const STATUSES: AlumniPlacementStatus[] = ["placed", "unplaced", "entrepreneur", "higher_studies"];

const STATUS_BADGE: Record<AlumniPlacementStatus, BadgeVariant> = {
  placed: "success",
  unplaced: "neutral",
  entrepreneur: "brand",
  higher_studies: "warning",
};

const STATUS_LABEL: Record<AlumniPlacementStatus, string> = {
  placed: "Placed",
  unplaced: "Unplaced",
  entrepreneur: "Entrepreneur",
  higher_studies: "Higher Studies",
};

const emptyForm: AlumniInput = {
  rollNo: "",
  name: "",
  department: "CSE",
  batchYear: new Date().getFullYear() - 1,
  placementStatus: "placed",
};

function AlumniForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: AlumniRecord;
  onSubmit: (input: AlumniInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AlumniInput>(
    initial
      ? {
          rollNo: initial.rollNo,
          name: initial.name,
          department: initial.department,
          batchYear: initial.batchYear,
          cgpa: initial.cgpa,
          placementStatus: initial.placementStatus,
          companyName: initial.companyName,
          designation: initial.designation,
          ctc: initial.ctc,
          offerLetterUrl: initial.offerLetterUrl,
          higherStudiesDetails: initial.higherStudiesDetails,
          contactPhone: initial.contactPhone,
          contactEmail: initial.contactEmail,
          notes: initial.notes,
        }
      : emptyForm
  );
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof AlumniInput>(key: K, value: AlumniInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  }

  const isPlaced = form.placementStatus === "placed";
  const isHigherStudies = form.placementStatus === "higher_studies";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Roll No</label>
          <input type="text" required value={form.rollNo} onChange={(e) => set("rollNo", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Name</label>
          <input type="text" required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Department</label>
          <select value={form.department} onChange={(e) => set("department", e.target.value as Department)} className={inputClass}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Batch year</label>
          <input type="number" required value={form.batchYear} onChange={(e) => set("batchYear", Number(e.target.value))} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>CGPA (optional)</label>
          <input
            type="number"
            step="0.01"
            value={form.cgpa ?? ""}
            onChange={(e) => set("cgpa", e.target.value ? Number(e.target.value) : undefined)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Placement status</label>
          <select value={form.placementStatus} onChange={(e) => set("placementStatus", e.target.value as AlumniPlacementStatus)} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPlaced && (
        <div className="grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Company</label>
            <input type="text" value={form.companyName ?? ""} onChange={(e) => set("companyName", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Designation</label>
            <input type="text" value={form.designation ?? ""} onChange={(e) => set("designation", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>CTC (LPA)</label>
            <input
              type="number"
              step="0.1"
              value={form.ctc ?? ""}
              onChange={(e) => set("ctc", e.target.value ? Number(e.target.value) : undefined)}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-3">
            <label className={labelClass}>Offer letter link</label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={form.offerLetterUrl ?? ""}
              onChange={(e) => set("offerLetterUrl", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {isHigherStudies && (
        <div className="rounded-lg bg-slate-50 p-3">
          <label className={labelClass}>Higher studies details</label>
          <input
            type="text"
            placeholder="e.g. MS Computer Science, Arizona State University"
            value={form.higherStudiesDetails ?? ""}
            onChange={(e) => set("higherStudiesDetails", e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Contact phone (optional)</label>
          <input type="tel" value={form.contactPhone ?? ""} onChange={(e) => set("contactPhone", e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Contact email (optional)</label>
          <input type="email" value={form.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes (optional)</label>
        <input type="text" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className={inputClass} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          {initial ? "Save changes" : "Add alumnus"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function BulkImport({ onDone }: { onDone: () => void }) {
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedAlumniRow[] | null>(null);
  const [importing, setImporting] = useState(false);

  function handleDownloadTemplate() {
    downloadCsv(
      "alumni-import-template.csv",
      ALUMNI_CSV_HEADERS,
      [["20A91A0501", "Jane Doe", "CSE", "2022", "8.2", "placed", "Acme Corp", "SDE-1", "6.5", "", "", "9999999999", "jane@example.com", ""]]
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setParsed(parseAlumniCsv(String(reader.result)));
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || !firebaseUser) return;
    const validInputs = parsed.filter((r) => r.input).map((r) => r.input as NonNullable<ParsedAlumniRow["input"]>);
    if (validInputs.length === 0) return;
    setImporting(true);
    try {
      const count = await bulkImportAlumni(validInputs, firebaseUser.uid);
      showToast(`Imported ${count} alumni record(s)`);
      setParsed(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onDone();
    } finally {
      setImporting(false);
    }
  }

  const validCount = parsed?.filter((r) => r.input).length ?? 0;
  const errorRows = parsed?.filter((r) => r.errors.length > 0) ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        For adding a whole past batch at once. Download the template, fill it in a spreadsheet, then upload it here.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4" />
          Download template
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Upload CSV
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </div>

      {parsed && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-700">
            {validCount} row(s) ready to import{errorRows.length > 0 ? `, ${errorRows.length} row(s) with errors (skipped)` : ""}
          </p>
          {errorRows.length > 0 && (
            <ul className="mt-2 max-h-32 list-inside list-disc overflow-y-auto text-xs text-red-600">
              {errorRows.map((r) => (
                <li key={r.row}>
                  Row {r.row}: {r.errors.join("; ")}
                </li>
              ))}
            </ul>
          )}
          {validCount > 0 && (
            <Button className="mt-3" onClick={handleImport} loading={importing}>
              Import {validCount} record(s)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Matches the `alumni` node's write rule exactly (coordinator/hod/dean/cpo/
// admin — not principal, not faculty_mentor) so this section never offers an
// action the backend would then deny.
const GRADUATE_ROLES = ["coordinator", "hod", "dean", "cpo", "admin"];
const DEPT_LOCKED_ROLES = new Set(["coordinator", "hod"]);

function GraduateBatchSection({ onDone }: { onDone: () => void }) {
  const { appUser, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const offers = useAllOffers(appUser);
  const drivesById = useDrivesById();

  const isDeptLocked = !!appUser && DEPT_LOCKED_ROLES.has(appUser.role);
  const ownDepartment = appUser && "department" in appUser ? appUser.department : undefined;

  const [department, setDepartment] = useState<Department | "">(isDeptLocked ? (ownDepartment as Department) : "");
  const [batchYear, setBatchYear] = useState<number | "">("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeYears = useMemo(() => {
    if (!students || !department) return [];
    return Array.from(
      new Set(students.filter((s) => s.department === department && !s.isAlumni).map((s) => s.batchYear))
    ).sort((a, b) => a - b);
  }, [students, department]);

  const candidates = useMemo(() => {
    if (!students || !department || !batchYear) return [];
    return buildGraduateBatchCandidates(students, department, batchYear, offers ?? [], drivesById ?? {});
  }, [students, department, batchYear, offers, drivesById]);

  async function handleConfirm() {
    if (!firebaseUser || candidates.length === 0) return;
    setSubmitting(true);
    try {
      const count = await graduateBatch(candidates, firebaseUser.uid);
      showToast(`Moved ${count} student(s) to Alumni`);
      setBatchYear("");
      setConfirming(false);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Archive a completed batch: each student gets an Alumni record (prefilled from their profile and, if placed,
        their accepted offer), and they stop showing up in active student lists, mentor assignment, and training
        rosters. Their history (attendance, mentoring, evaluations) stays intact — this only sets them aside as
        graduated, it doesn't delete anything.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Department</label>
          {isDeptLocked ? (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{ownDepartment}</p>
          ) : (
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value as Department | "");
                setBatchYear("");
              }}
              className={inputClass}
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass}>Batch year (graduating)</label>
          <select
            value={batchYear}
            onChange={(e) => setBatchYear(e.target.value ? Number(e.target.value) : "")}
            className={inputClass}
            disabled={!department}
          >
            <option value="">Select batch year</option>
            {activeYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {department && batchYear && (
        <div className="rounded-lg border border-slate-200">
          {candidates.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">
              No active (non-alumni) students found for {department} · {batchYear}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pl-3 pr-4">Roll No</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">CGPA</th>
                    <th className="py-2 pr-4">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((c) => (
                    <tr key={c.student.uid}>
                      <td className="py-2 pl-3 pr-4 font-medium text-slate-800">{c.student.rollNo}</td>
                      <td className="py-2 pr-4 text-slate-600">{c.student.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{c.student.cgpa}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {c.offer ? `${c.drive?.companyName ?? "Placed"} · ${c.offer.ctc} LPA` : STATUS_LABEL[PLACEMENT_STATUS_MAP[c.student.placementStatus]]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {candidates.length > 0 && !confirming && (
        <Button variant="danger" onClick={() => setConfirming(true)}>
          <GraduationCap className="h-4 w-4" />
          Graduate {candidates.length} student(s)
        </Button>
      )}

      {confirming && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-800">
            Move all {candidates.length} students in {department} · {batchYear} to Alumni? They'll stop appearing in
            active student lists, mentor assignment, and training rosters. This can't be undone from here.
          </p>
          <div className="mt-2 flex gap-2">
            <Button variant="danger" onClick={handleConfirm} loading={submitting}>
              Confirm — graduate batch
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Button variant="secondary" onClick={onDone}>
        Close
      </Button>
    </div>
  );
}

export default function Alumni() {
  const { firebaseUser, appUser } = useAuth();
  const { showToast } = useToast();
  const alumni = useAllAlumni();
  const [mode, setMode] = useState<"none" | "add" | "import" | "graduate">("none");
  const [editingId, setEditingId] = useState<string | null>(null);
  const canGraduate = !!appUser && GRADUATE_ROLES.includes(appUser.role);

  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [yearFilter, setYearFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<AlumniPlacementStatus | "">("");

  const filtered = useMemo(() => {
    if (!alumni) return null;
    return alumni
      .filter((a) => !deptFilter || a.department === deptFilter)
      .filter((a) => !yearFilter || a.batchYear === yearFilter)
      .filter((a) => !statusFilter || a.placementStatus === statusFilter)
      .sort((a, b) => b.batchYear - a.batchYear || a.rollNo.localeCompare(b.rollNo));
  }, [alumni, deptFilter, yearFilter, statusFilter]);

  const years = useMemo(
    () => Array.from(new Set((alumni ?? []).map((a) => a.batchYear))).sort((a, b) => b - a),
    [alumni]
  );

  // AlumniRecord has no uid — rollNo is the only real identity a person has
  // here. Manual entry / bulk import for someone with multiple offers has
  // sometimes produced one row per offer/company instead of one row per
  // person, which silently inflated "placed" (and total) since the stats
  // below used to just count rows. Deduped to one record per rollNo — the
  // most recently updated one, on the assumption that's the accurate/final
  // outcome — so the summary always reflects unique people regardless of
  // how many rows exist underneath. duplicateRollNos (below) surfaces the
  // underlying data problem itself, not just papering over it in the stats.
  const dedupedByRollNo = useMemo(() => {
    if (!filtered) return null;
    const byRollNo = new Map<string, AlumniRecord>();
    for (const a of filtered) {
      const existing = byRollNo.get(a.rollNo);
      if (!existing || a.updatedAt > existing.updatedAt) byRollNo.set(a.rollNo, a);
    }
    return Array.from(byRollNo.values());
  }, [filtered]);

  const duplicateRollNos = useMemo(() => {
    if (!filtered) return [];
    const counts = new Map<string, number>();
    for (const a of filtered) counts.set(a.rollNo, (counts.get(a.rollNo) ?? 0) + 1);
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const stats = useMemo(() => {
    if (!dedupedByRollNo) return null;
    return {
      total: dedupedByRollNo.length,
      placed: dedupedByRollNo.filter((a) => a.placementStatus === "placed").length,
      unplaced: dedupedByRollNo.filter((a) => a.placementStatus === "unplaced").length,
      entrepreneur: dedupedByRollNo.filter((a) => a.placementStatus === "entrepreneur").length,
      higherStudies: dedupedByRollNo.filter((a) => a.placementStatus === "higher_studies").length,
    };
  }, [dedupedByRollNo]);

  async function handleAdd(input: AlumniInput) {
    if (!firebaseUser) return;
    await createAlumniRecord(input, firebaseUser.uid);
    showToast("Alumnus added");
    setMode("none");
  }

  async function handleEdit(input: AlumniInput) {
    if (!editingId) return;
    await updateAlumniRecord(editingId, input);
    showToast("Alumnus updated");
    setEditingId(null);
  }

  async function handleDelete(alumniId: string) {
    await deleteAlumniRecord(alumniId);
    showToast("Record removed");
  }

  function handleDownload() {
    if (!filtered) return;
    downloadCsv(
      "alumni-report.csv",
      ALUMNI_CSV_HEADERS,
      filtered.map((a) => [
        a.rollNo,
        a.name,
        a.department,
        a.batchYear,
        a.cgpa ?? "",
        a.placementStatus,
        a.companyName ?? "",
        a.designation ?? "",
        a.ctc ?? "",
        a.offerLetterUrl ?? "",
        a.higherStudiesDetails ?? "",
        a.contactPhone ?? "",
        a.contactEmail ?? "",
        a.notes ?? "",
      ])
    );
  }

  const editingRecord = editingId ? alumni?.find((a) => a.alumniId === editingId) : undefined;

  return (
    <div>
      <PageHeader
        title="Alumni"
        subtitle={stats ? `${stats.total} alumni · ${stats.placed} placed · ${stats.entrepreneur} entrepreneur · ${stats.higherStudies} higher studies` : undefined}
        icon={Users2}
        gradient="from-slate-500 to-slate-700"
        action={
          mode === "none" && (
            <div className="flex flex-wrap gap-2">
              {canGraduate && (
                <Button variant="secondary" onClick={() => setMode("graduate")}>
                  <GraduationCap className="h-4 w-4" />
                  Graduate a Batch
                </Button>
              )}
              <Button variant="secondary" onClick={() => setMode("import")}>
                <Upload className="h-4 w-4" />
                Bulk Import
              </Button>
              <Button onClick={() => setMode("add")}>
                <Plus className="h-4 w-4" />
                Add Alumnus
              </Button>
            </div>
          )
        }
      />

      {mode === "graduate" && canGraduate && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Graduate a batch</h3>
          <GraduateBatchSection onDone={() => setMode("none")} />
        </Card>
      )}

      {mode === "add" && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Add alumnus</h3>
          <AlumniForm onSubmit={handleAdd} onCancel={() => setMode("none")} />
        </Card>
      )}

      {mode === "import" && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Bulk import a batch</h3>
          <BulkImport onDone={() => setMode("none")} />
          <Button variant="secondary" className="mt-3" onClick={() => setMode("none")}>
            Done
          </Button>
        </Card>
      )}

      {editingRecord && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Edit alumnus</h3>
          <AlumniForm initial={editingRecord} onSubmit={handleEdit} onCancel={() => setEditingId(null)} />
        </Card>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Department</label>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as Department | "")} className={inputClass}>
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Batch year</label>
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : "")} className={inputClass}>
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Placement status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AlumniPlacementStatus | "")} className={inputClass}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {filtered && filtered.length > 0 && (
              <Button variant="secondary" onClick={handleDownload} className="w-full">
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            )}
          </div>
        </div>
      </Card>

      {filtered === null && <Skeleton className="h-40" />}
      {filtered !== null && filtered.length === 0 && (
        <EmptyState icon={Users2} title="No alumni records yet" subtitle="Add one, or bulk import a whole batch." />
      )}

      {duplicateRollNos.length > 0 && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {duplicateRollNos.length} roll number{duplicateRollNos.length === 1 ? " has" : "s have"} more than one alumni
          record — often from adding a separate row per offer for someone with multiple offers, instead of one row
          per person. The counts above already count each roll number once (using its most recently updated record),
          but the table below still lists every row — edit or delete the extras to clean it up:{" "}
          {duplicateRollNos.map(([rollNo, count]) => `${rollNo} (${count})`).join(", ")}
        </p>
      )}

      {filtered !== null && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Dept</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Company / Details</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((a) => (
                  <tr key={a.alumniId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{a.rollNo}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.name}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.department}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.batchYear}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={STATUS_BADGE[a.placementStatus]}>{STATUS_LABEL[a.placementStatus]}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {a.placementStatus === "placed" && (a.companyName ? `${a.companyName}${a.ctc ? ` · ${a.ctc} LPA` : ""}` : "—")}
                      {a.placementStatus === "higher_studies" && (a.higherStudiesDetails || "—")}
                      {(a.placementStatus === "unplaced" || a.placementStatus === "entrepreneur") && (a.notes || "—")}
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingId(a.alumniId)} className="text-xs font-medium text-brand-700 hover:underline">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(a.alumniId)} className="text-slate-400 hover:text-red-600" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
