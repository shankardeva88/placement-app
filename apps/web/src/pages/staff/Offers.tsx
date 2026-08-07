import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { FileText, Plus } from "lucide-react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllOffers, useAllJoiningReports, recordOffer, setJoiningReportStatus } from "../../lib/offersManagementLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

function RecordOfferForm({ onDone }: { onDone: () => void }) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  // Plain string compare, not numeric — roll numbers are fixed-width per
  // segment, same reasoning as the Students list sort (see Students.tsx).
  const sortedStudents = useMemo(
    () => (students ?? []).slice().sort((a, b) => a.rollNo.localeCompare(b.rollNo)),
    [students]
  );
  const [drives, setDrives] = useState<Drive[]>([]);
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
          <label className={labelClass}>Student</label>
          <select required value={studentUid} onChange={(e) => setStudentUid(e.target.value)} className={inputClass}>
            <option value="">{students === null ? "Loading…" : "Select a student"}</option>
            {sortedStudents.map((s) => (
              <option key={s.studentId} value={s.uid}>
                {s.rollNo} — {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Drive</label>
          <select required value={driveId} onChange={(e) => setDriveId(e.target.value)} className={inputClass}>
            <option value="">Select a drive</option>
            {drives.map((d) => (
              <option key={d.driveId} value={d.driveId}>
                {d.companyName} — {d.jobRole}
              </option>
            ))}
          </select>
        </div>
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

export default function StaffOffers() {
  const { appUser } = useAuth();
  const offers = useAllOffers(appUser);
  const joiningReports = useAllJoiningReports(appUser);
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [students, setStudents] = useState<Record<string, Student | null>>({});

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

  async function handleVerifyJoining(offerId: string) {
    await setJoiningReportStatus(offerId, "verified");
    showToast("Joining report verified");
  }

  return (
    <div>
      <PageHeader
        title="Offers"
        subtitle="Record offers and verify joining reports."
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

      {offers === null && <Skeleton className="h-24" />}
      {offers !== null && offers.length === 0 && <EmptyState icon={FileText} title="No offers recorded yet" />}

      <div className="space-y-3">
        {offers?.map((o) => {
          const student = students[o.studentId];
          const report = joiningReports[o.offerId];
          return (
            <Card key={o.offerId}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {student ? `${student.rollNo} — ${student.name}` : o.studentId}
                  </p>
                  <p className="text-sm text-slate-500">
                    {drives[o.driveId]?.companyName ?? o.driveId} — {o.designation} · {o.ctc} LPA
                  </p>
                </div>
                <Badge variant={o.status === "accepted" ? "success" : o.status === "declined" ? "danger" : "brand"}>
                  {o.status}
                </Badge>
              </div>
              {report && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-600">
                    Joining proof: <Badge variant={report.status === "verified" ? "success" : "warning"}>{report.status}</Badge>
                  </span>
                  {report.status === "submitted" && (
                    <Button variant="secondary" onClick={() => handleVerifyJoining(o.offerId)}>
                      Verify joining
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
