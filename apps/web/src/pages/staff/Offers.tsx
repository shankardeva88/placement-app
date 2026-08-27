import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, ChevronDown, ChevronUp, FileText, Plus, Search } from "lucide-react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, JoiningReport, Offer, OfferStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllApplications } from "../../lib/applicantsLib";
import { useAllOffers, useAllJoiningReports, recordOffer, setJoiningReportStatus } from "../../lib/offersManagementLib";
import { driveRoleSummary } from "../../lib/driveRolesLib";
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

const OFFER_STATUS_OPTIONS: OfferStatus[] = ["received", "verified", "accepted", "declined"];
const OFFER_STATUS_BADGE: Record<OfferStatus, BadgeVariant> = {
  received: "brand",
  verified: "brand",
  accepted: "success",
  declined: "danger",
};

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
      {selected && <p className="mt-1 text-xs text-slate-500">Selected: {selected.rollNo} — {selected.name}</p>}
    </div>
  );
}

function RecordOfferForm({ onDone }: { onDone: () => void }) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const applications = useAllApplications(appUser);
  const offers = useAllOffers(appUser);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [studentUid, setStudentUid] = useState("");
  const [driveId, setDriveId] = useState("");
  const [ctc, setCtc] = useState(0);
  const [designation, setDesignation] = useState("");
  const [offerLetterUrl, setOfferLetterUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  const batchYearOptions = useMemo(
    () => Array.from(new Set((students ?? []).map((s) => s.batchYear))).sort((a, b) => a - b),
    [students]
  );

  // Narrows the drive list to whichever ones could actually involve this
  // batch — a hand-picked drive counts if any of its picked students are in
  // that batch; an ordinary criteria-based drive counts if it's open to
  // every batch (empty batchYears, same "no restriction" convention as
  // isDriveVisibleToStudent) or explicitly includes this one.
  const drivesForBatch = useMemo(() => {
    if (!batchFilter) return drives;
    return drives.filter((d) => {
      if (d.selectedStudentIds && d.selectedStudentIds.length > 0) {
        return d.selectedStudentIds.some((uid) => students?.find((s) => s.uid === uid)?.batchYear === batchFilter);
      }
      const years = d.eligibility?.batchYears ?? [];
      return years.length === 0 || years.includes(batchFilter);
    });
  }, [drives, batchFilter, students]);

  // The actual point of this reshuffle: an offer only ever makes sense for
  // a student the drive's own process marked "selected" — searching the
  // whole roster to record an offer was easy to mis-click a student who
  // never even reached that stage. Scoped to the chosen batch too, once set.
  const selectedApplicants = useMemo(() => {
    if (!driveId || !applications || !students) return [];
    const selectedIds = new Set(
      applications.filter((a) => a.driveId === driveId && a.status === "selected").map((a) => a.studentId)
    );
    return students
      .filter((s) => selectedIds.has(s.uid) && (!batchFilter || s.batchYear === batchFilter))
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [driveId, applications, students, batchFilter]);

  // A student picked here may already have an offer on record for this
  // drive (offerId is deterministic — studentUid_driveId) — prefill the
  // form from it instead of showing blanks the coordinator would overwrite.
  const existingOffer = useMemo(() => {
    if (!studentUid || !driveId || !offers) return null;
    return offers.find((o) => o.studentId === studentUid && o.driveId === driveId) ?? null;
  }, [studentUid, driveId, offers]);

  useEffect(() => {
    if (existingOffer) {
      setCtc(existingOffer.ctc);
      setDesignation(existingOffer.designation);
      setOfferLetterUrl(existingOffer.offerLetterUrl ?? "");
    } else {
      setCtc(0);
      setDesignation("");
      setOfferLetterUrl("");
    }
  }, [existingOffer]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!studentUid || !driveId) {
      setError("Pick a student and a drive.");
      return;
    }
    const selectedStudent = students?.find((s) => s.uid === studentUid);
    if (!selectedStudent) {
      setError("Selected student not found.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await recordOffer({ studentUid, department: selectedStudent.department, driveId, ctc, designation, offerLetterUrl });
      showToast("Offer recorded");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record offer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Batch (optional, narrows Drive below)</label>
          <select
            value={batchFilter}
            onChange={(e) => {
              const y = e.target.value ? Number(e.target.value) : "";
              setBatchFilter(y);
              setDriveId("");
              setStudentUid("");
            }}
            className={inputClass}
          >
            <option value="">All batches</option>
            {batchYearOptions.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Drive</label>
          <select
            required
            value={driveId}
            onChange={(e) => {
              setDriveId(e.target.value);
              setStudentUid("");
            }}
            className={inputClass}
          >
            <option value="">Select a drive</option>
            {drivesForBatch.map((d) => (
              <option key={d.driveId} value={d.driveId}>
                {d.companyName} — {driveRoleSummary(d)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Student — selected for this drive</label>
        {!driveId ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">Pick a drive above first.</p>
        ) : students === null || applications === null ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : selectedApplicants.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
            No student is marked "selected" for this drive{batchFilter ? ` in batch ${batchFilter}` : ""} yet — update
            their application status on the drive's Applicants page first.
          </p>
        ) : (
          <StudentSearchPicker students={selectedApplicants} value={studentUid} onChange={setStudentUid} />
        )}
        {existingOffer && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            This student already has an offer recorded for this drive — the fields below are prefilled from it.
            Submitting will update that offer.
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Designation</label>
          <input type="text" required value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>CTC (LPA)</label>
          <input type="number" step="0.1" min={0} required value={ctc} onChange={(e) => setCtc(Number(e.target.value))} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Offer letter link (optional)</label>
        <input type="url" value={offerLetterUrl} onChange={(e) => setOfferLetterUrl(e.target.value)} className={inputClass} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          Record offer
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Company-first, click-to-expand — a flat list of every offer got unwieldy
// once a company had 5+ students on it; this groups by drive so the default
// view is "which companies", and the student-by-student detail (including
// joining proof) only renders once a coordinator actually opens one.
function CompanyOffersGroup({
  companyName,
  roleSummary,
  offers,
  students,
  joiningReports,
  onVerifyJoining,
}: {
  companyName: string;
  roleSummary: string;
  offers: Offer[];
  students: Record<string, Student | null>;
  joiningReports: Record<string, JoiningReport>;
  onVerifyJoining: (offerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const acceptedCount = offers.filter((o) => o.status === "accepted").length;

  return (
    <Card>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{companyName}</h3>
          <p className="text-sm text-slate-500">{roleSummary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="brand">
            {offers.length} student{offers.length === 1 ? "" : "s"}
          </Badge>
          {acceptedCount > 0 && <Badge variant="success">{acceptedCount} accepted</Badge>}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {offers.map((o) => {
            const student = students[o.studentId];
            const report = joiningReports[o.offerId];
            return (
              <div key={o.offerId} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {student ? `${student.rollNo} — ${student.name}` : o.studentId}
                    </p>
                    <p className="text-sm text-slate-500">
                      {o.designation} · {o.ctc} LPA
                    </p>
                  </div>
                  <Badge variant={OFFER_STATUS_BADGE[o.status]}>{o.status}</Badge>
                </div>
                {report && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-slate-600">
                      <span>Joining: {new Date(report.joiningDate).toLocaleDateString()}</span>
                      <Badge variant={report.status === "verified" ? "success" : "warning"}>{report.status}</Badge>
                      <a
                        href={report.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-600 hover:underline"
                      >
                        View joining letter / ID card
                      </a>
                    </div>
                    {report.status === "submitted" && (
                      <Button variant="secondary" onClick={() => onVerifyJoining(o.offerId)}>
                        Verify joining
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function StaffOffers() {
  const { appUser } = useAuth();
  const offers = useAllOffers(appUser);
  const joiningReports = useAllJoiningReports(appUser);
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [students, setStudents] = useState<Record<string, Student | null>>({});

  const [search, setSearch] = useState("");
  const [driveFilter, setDriveFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<OfferStatus | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  useEffect(() => {
    if (!offers) return;
    const uniqueUids = Array.from(new Set(offers.map((o) => o.studentId))).filter((uid) => !(uid in students));
    uniqueUids.forEach((uid) => {
      get(ref(db, `${DB_NODES.students}/${uid}`))
        .then((snap) => setStudents((prev) => ({ ...prev, [uid]: snap.exists() ? (snap.val() as Student) : null })))
        .catch(() => setStudents((prev) => ({ ...prev, [uid]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  // Which drives actually have an offer recorded — narrower and more
  // useful than every drive ever created.
  const driveOptions = useMemo(() => {
    if (!offers) return [];
    const ids = Array.from(new Set(offers.map((o) => o.driveId)));
    return ids
      .map((id) => ({ id, name: drives[id]?.companyName ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [offers, drives]);

  // Batch years actually present among students an offer was recorded for
  // — built from loaded data, same as driveOptions above, rather than a
  // hardcoded year list.
  const batchYearOptions = useMemo(() => {
    const years = new Set<number>();
    for (const s of Object.values(students)) if (s) years.add(s.batchYear);
    return Array.from(years).sort((a, b) => a - b);
  }, [students]);

  const filteredOffers = useMemo(() => {
    if (!offers) return null;
    const term = search.trim().toLowerCase();
    return offers
      .filter((o) => !driveFilter || o.driveId === driveFilter)
      .filter((o) => !statusFilter || o.status === statusFilter)
      .filter((o) => !batchFilter || students[o.studentId]?.batchYear === batchFilter)
      .filter((o) => {
        if (!term) return true;
        const student = students[o.studentId];
        return !!student && (student.rollNo.toLowerCase().includes(term) || student.name.toLowerCase().includes(term));
      })
      .sort((a, b) => (students[a.studentId]?.rollNo ?? "").localeCompare(students[b.studentId]?.rollNo ?? ""));
  }, [offers, driveFilter, statusFilter, batchFilter, search, students]);

  const groupedByDrive = useMemo(() => {
    if (!filteredOffers) return null;
    const map = new Map<string, Offer[]>();
    for (const o of filteredOffers) {
      if (!map.has(o.driveId)) map.set(o.driveId, []);
      map.get(o.driveId)!.push(o);
    }
    return Array.from(map.entries())
      .map(([driveId, offersForDrive]) => ({
        driveId,
        offers: offersForDrive.sort((a, b) => (students[a.studentId]?.rollNo ?? "").localeCompare(students[b.studentId]?.rollNo ?? "")),
      }))
      .sort((a, b) => (drives[a.driveId]?.companyName ?? a.driveId).localeCompare(drives[b.driveId]?.companyName ?? b.driveId));
  }, [filteredOffers, drives, students]);

  async function handleVerifyJoining(offerId: string) {
    await setJoiningReportStatus(offerId, "verified");
    showToast("Joining report verified");
  }

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle={
          offers
            ? `${
                filteredOffers && filteredOffers.length !== offers.length
                  ? `${filteredOffers.length} of ${offers.length} offer(s)`
                  : `${offers.length} offer(s) recorded`
              } — record offers and verify joining reports.`
            : "Record offers and verify joining reports."
        }
        icon={FileText}
        gradient="from-emerald-500 to-teal-600"
        action={
          !creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              Record Offer
            </Button>
          )
        }
      />

      {creating && (
        <Card className="mb-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900">Record offer</h3>
          <RecordOfferForm onDone={() => setCreating(false)} />
        </Card>
      )}

      {offers !== null && offers.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by roll number or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={driveFilter} onChange={(e) => setDriveFilter(e.target.value)} className={`${inputClass} sm:w-56`}>
            <option value="">All drives</option>
            {driveOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OfferStatus | "")} className={`${inputClass} sm:w-40`}>
            <option value="">All statuses</option>
            {OFFER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {batchYearOptions.length > 0 && (
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
              className={`${inputClass} sm:w-40`}
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

      {offers === null && <Skeleton className="h-24" />}
      {offers !== null && offers.length === 0 && <EmptyState icon={FileText} title="No offers recorded yet" />}
      {filteredOffers !== null && offers !== null && offers.length > 0 && filteredOffers.length === 0 && (
        <EmptyState icon={Search} title="No offers match your filters" />
      )}

      <div className="space-y-4">
        {groupedByDrive?.map((g) => (
          <CompanyOffersGroup
            key={g.driveId}
            companyName={drives[g.driveId]?.companyName ?? g.driveId}
            roleSummary={drives[g.driveId] ? driveRoleSummary(drives[g.driveId]) : ""}
            offers={g.offers}
            students={students}
            joiningReports={joiningReports}
            onVerifyJoining={handleVerifyJoining}
          />
        ))}
      </div>
    </div>
  );
}
