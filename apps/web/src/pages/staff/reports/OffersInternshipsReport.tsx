import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Building2, Download } from "lucide-react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, Drive, Internship, Offer, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
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

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

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
  driveId?: string;
  sortDate: number;
}

/** Both offers (drive-based placements) and internships (standalone, often
 * self-sourced) count as "where did this student end up" — combined here so
 * a coordinator doesn't have to cross-reference two separate reports for
 * that question. Each is still recorded and managed on its own page
 * (Offers / Internships) — this is read-only, reporting-only. */
export default function OffersInternshipsReport() {
  const { appUser } = useAuth();
  const offers = useAllOffers(appUser);
  const internships = useAllInternships(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [students, setStudents] = useState<Record<string, Student | null>>({});

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [batchFilter, setBatchFilter] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState<RecordType | "">("");

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  useEffect(() => {
    const uids = new Set<string>();
    for (const o of offers ?? []) uids.add(o.studentId);
    for (const i of internships ?? []) uids.add(i.studentId);
    const missing = Array.from(uids).filter((uid) => !(uid in students));
    missing.forEach((uid) => {
      get(ref(db, `${DB_NODES.students}/${uid}`))
        .then((snap) => setStudents((prev) => ({ ...prev, [uid]: snap.exists() ? (snap.val() as Student) : null })))
        .catch(() => setStudents((prev) => ({ ...prev, [uid]: null })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers, internships]);

  const rows = useMemo(() => {
    if (!offers || !internships) return null;
    const offerRows: CombinedRow[] = offers.map((o: Offer) => ({
      key: `offer_${o.offerId}`,
      type: "offer",
      studentId: o.studentId,
      companyName: drives[o.driveId]?.companyName ?? o.driveId,
      roleLabel: o.designation,
      amountLabel: `${o.ctc} LPA`,
      status: o.status,
      driveId: o.driveId,
      sortDate: o.createdAt,
    }));
    const internshipRows: CombinedRow[] = internships.map((i: Internship) => ({
      key: `internship_${i.internshipId}`,
      type: "internship",
      studentId: i.studentId,
      companyName: i.companyName,
      roleLabel: i.role,
      amountLabel: i.stipend != null ? `₹${i.stipend}/mo · ${durationLabel(i.durationMonths)}` : durationLabel(i.durationMonths),
      status: i.status,
      sortDate: i.createdAt,
    }));
    return [...offerRows, ...internshipRows];
  }, [offers, internships, drives]);

  const batchYears = useMemo(() => {
    const years = Object.values(students)
      .filter((s): s is Student => s != null)
      .map((s) => s.batchYear);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [students]);

  const filteredRows = useMemo(() => {
    if (!rows) return null;
    const term = search.trim().toLowerCase();
    return rows
      .filter((r) => !typeFilter || r.type === typeFilter)
      .filter((r) => !deptFilter || students[r.studentId]?.department === deptFilter)
      .filter((r) => !batchFilter || students[r.studentId]?.batchYear === batchFilter)
      .filter((r) => {
        if (!term) return true;
        const student = students[r.studentId];
        return (
          r.companyName.toLowerCase().includes(term) ||
          (student?.rollNo.toLowerCase().includes(term) ?? false) ||
          (student?.name.toLowerCase().includes(term) ?? false)
        );
      })
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [rows, typeFilter, deptFilter, batchFilter, search, students]);

  const stats = useMemo(() => {
    if (!filteredRows) return null;
    const offerCount = filteredRows.filter((r) => r.type === "offer").length;
    const internshipCount = filteredRows.filter((r) => r.type === "internship").length;
    return { total: filteredRows.length, offerCount, internshipCount };
  }, [filteredRows]);

  function handleDownload() {
    if (!filteredRows) return;
    downloadCsv(
      "offers-internships-report.csv",
      ["Roll No", "Name", "Department", "Batch", "Type", "Company", "Role", "Amount", "Status", "Drive Link"],
      filteredRows.map((r) => {
        const student = students[r.studentId];
        return [
          student?.rollNo ?? "",
          student?.name ?? r.studentId,
          student?.department ?? "",
          student?.batchYear ?? "",
          r.type,
          r.companyName,
          r.roleLabel,
          r.amountLabel,
          r.status,
          r.driveId ? `${window.location.origin}/staff/drives/${r.driveId}` : "",
        ];
      })
    );
  }

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Offers & Internships Report"
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as RecordType | "")} className={inputClass}>
              <option value="">All types</option>
              <option value="offer">Offers</option>
              <option value="internship">Internships</option>
            </select>
          </div>
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

      {filteredRows === null && <Skeleton className="h-40" />}
      {filteredRows !== null && filteredRows.length === 0 && (
        <EmptyState icon={Building2} title="No offers or internships match these filters" />
      )}

      {filteredRows !== null && filteredRows.length > 0 && (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r) => {
                  const student = students[r.studentId];
                  return (
                    <tr key={r.key}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{student?.rollNo ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">{student?.name ?? r.studentId}</td>
                      <td className="py-2 pr-4 text-slate-600">{student?.batchYear ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={TYPE_BADGE[r.type]}>{r.type}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {r.driveId ? (
                          <Link
                            to={`/staff/drives/${r.driveId}`}
                            className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                          >
                            {r.companyName}
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          r.companyName
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{r.roleLabel}</td>
                      <td className="py-2 pr-4 text-slate-600">{r.amountLabel}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_BADGE[r.status] ?? "neutral"}>{r.status}</Badge>
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
