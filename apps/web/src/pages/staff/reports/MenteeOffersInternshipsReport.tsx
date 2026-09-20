import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Download } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Drive, Internship, Offer, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useStudentsDirectory } from "../../../lib/studentsDirectoryLib";
import { useMyMentees } from "../../../lib/menteeFollowUpLib";
import { useAllOffers } from "../../../lib/offersManagementLib";
import { useAllInternships } from "../../../lib/internshipsLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

type RecordType = "offer" | "internship";

const TYPE_BADGE: Record<RecordType, BadgeVariant> = {
  offer: "brand",
  internship: "neutral",
};

const STATUS_BADGE: Record<string, BadgeVariant> = {
  received: "brand",
  verified: "brand",
  accepted: "success",
  declined: "danger",
  ongoing: "warning",
  completed: "success",
};

function durationLabel(months: number): string {
  return months === 1 ? "1 month" : `${months} months`;
}

interface CombinedRow {
  key: string;
  type: RecordType;
  studentId: string;
  companyName: string;
  roleLabel: string;
  amountLabel: string;
  status: string;
  linkUrl?: string;
  sortDate: number;
}

/** Mentee-scoped equivalent of OffersInternshipsReport — same combined
 * offer+internship "where did this student end up" view, filtered down to
 * this mentor's own mentees first. */
export default function MenteeOffersInternshipsReport() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const offers = useAllOffers(appUser);
  const internships = useAllInternships(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});

  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState<RecordType | "">("");

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const menteeUids = useMemo(() => new Set((mentees ?? []).map((m) => m.studentId)), [mentees]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees.map((m) => studentsByUid[m.studentId]).filter((s): s is Student => s !== undefined);
  }, [mentees, studentsByUid]);

  const rows = useMemo(() => {
    if (!offers || !internships) return null;
    const offerRows: CombinedRow[] = offers
      .filter((o) => menteeUids.has(o.studentId))
      .map((o: Offer) => ({
        key: `offer_${o.offerId}`,
        type: "offer",
        studentId: o.studentId,
        companyName: drives[o.driveId]?.companyName ?? o.driveId,
        roleLabel: o.designation,
        amountLabel: `${o.ctc} LPA`,
        status: o.status,
        linkUrl: o.offerLetterUrl || undefined,
        sortDate: o.createdAt,
      }));
    const internshipRows: CombinedRow[] = internships
      .filter((i) => menteeUids.has(i.studentId))
      .map((i: Internship) => ({
        key: `internship_${i.internshipId}`,
        type: "internship",
        studentId: i.studentId,
        companyName: i.companyName,
        roleLabel: i.role,
        amountLabel: i.stipend != null ? `₹${i.stipend}/mo · ${durationLabel(i.durationMonths)}` : durationLabel(i.durationMonths),
        status: i.status,
        linkUrl: i.offerLetterUrl || i.completionCertificateUrl || undefined,
        sortDate: i.createdAt,
      }));
    return [...offerRows, ...internshipRows];
  }, [offers, internships, drives, menteeUids]);

  const batchYears = useMemo(
    () => Array.from(new Set(menteeStudents.map((s) => s.batchYear))).sort((a, b) => b - a),
    [menteeStudents]
  );

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !typeFilter || r.type === typeFilter)
      .filter((r) => !batchFilter || studentsByUid[r.studentId]?.batchYear === batchFilter)
      .filter((r) => {
        if (!term) return true;
        const student = studentsByUid[r.studentId];
        return (
          r.companyName.toLowerCase().includes(term) ||
          (student?.rollNo.toLowerCase().includes(term) ?? false) ||
          (student?.name.toLowerCase().includes(term) ?? false)
        );
      })
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [rows, typeFilter, batchFilter, search, studentsByUid]);

  const stats = useMemo(() => {
    if (!filteredRows) return null;
    const offerCount = filteredRows.filter((r) => r.type === "offer").length;
    const internshipCount = filteredRows.filter((r) => r.type === "internship").length;
    return { total: filteredRows.length, offerCount, internshipCount };
  }, [filteredRows]);

  const loading = mentees === null || students === null || rows === null;

  function handleDownload() {
    if (!filteredRows) return;
    downloadCsv(
      "mentee-offers-internships-report.csv",
      ["Roll No", "Name", "Batch", "Type", "Company", "Role", "Amount", "Status", "Offer Letter Link"],
      filteredRows.map((r) => {
        const student = studentsByUid[r.studentId];
        return [
          student?.rollNo ?? "",
          student?.name ?? r.studentId,
          student?.batchYear ?? "",
          r.type,
          r.companyName,
          r.roleLabel,
          r.amountLabel,
          r.status,
          r.linkUrl ?? "",
        ];
      })
    );
  }

  return (
    <div>
      <Link to="/staff/mentor-reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Mentee Offers & Internships Report"
        subtitle={
          stats ? `${stats.total} record(s) — ${stats.offerCount} offer(s), ${stats.internshipCount} internship(s)` : undefined
        }
        icon={Building2}
        gradient="from-cyan-500 to-blue-600"
        action={
          filteredRows && filteredRows.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 space-y-4">
        <input
          type="text"
          placeholder="Search by roll number, name, or company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as RecordType | "")} className={inputClass}>
              <option value="">All types</option>
              <option value="offer">Offers</option>
              <option value="internship">Internships</option>
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
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}
      {!loading && menteeStudents.length === 0 && <EmptyState icon={Building2} title="No mentees assigned to you yet" />}
      {!loading && menteeStudents.length > 0 && filteredRows !== null && filteredRows.length === 0 && (
        <EmptyState icon={Building2} title="No offers or internships match these filters" />
      )}

      {!loading && filteredRows !== null && filteredRows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Batch</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Offer Letter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r) => {
                  const student = studentsByUid[r.studentId];
                  return (
                    <tr key={r.key}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{student?.rollNo ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{student?.name ?? r.studentId}</td>
                      <td className="py-2 pr-4 text-slate-600">{student?.batchYear ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={TYPE_BADGE[r.type]}>{r.type}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{r.companyName}</td>
                      <td className="py-2 pr-4 text-slate-600">{r.roleLabel}</td>
                      <td className="py-2 pr-4 text-slate-600">{r.amountLabel}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_BADGE[r.status] ?? "neutral"}>{r.status}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {r.linkUrl ? (
                          <a
                            href={r.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-brand-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
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
