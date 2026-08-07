import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Briefcase, Download } from "lucide-react";
import { ref, onValue, get } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, Drive, OfferStatus, Student } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useAllOffers, useAllJoiningReports } from "../../../lib/offersManagementLib";
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

const OFFER_BADGE: Record<OfferStatus, BadgeVariant> = {
  received: "brand",
  verified: "brand",
  accepted: "success",
  declined: "danger",
};

export default function PlacementReport() {
  const { appUser } = useAuth();
  const offers = useAllOffers(appUser);
  const joiningReports = useAllJoiningReports(appUser);
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [students, setStudents] = useState<Record<string, Student | null>>({});
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
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

  const batchYears = useMemo(() => {
    const years = Object.values(students)
      .filter((s): s is Student => s != null)
      .map((s) => s.batchYear);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [students]);

  const rows = useMemo(() => {
    if (!offers) return null;
    return offers
      .map((o) => ({ offer: o, student: students[o.studentId], drive: drives[o.driveId], report: joiningReports[o.offerId] }))
      .filter((r) => !deptFilter || r.student?.department === deptFilter)
      .filter((r) => !statusFilter || r.offer.status === statusFilter)
      .filter((r) => !batchFilter || r.student?.batchYear === batchFilter)
      .sort((a, b) => b.offer.ctc - a.offer.ctc);
  }, [offers, students, drives, joiningReports, deptFilter, statusFilter, batchFilter]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const accepted = rows.filter((r) => r.offer.status === "accepted").length;
    const ctcs = rows.map((r) => r.offer.ctc);
    const avgCtc = ctcs.length > 0 ? Math.round((ctcs.reduce((a, b) => a + b, 0) / ctcs.length) * 10) / 10 : 0;
    const maxCtc = ctcs.length > 0 ? Math.max(...ctcs) : 0;
    return { total: rows.length, accepted, avgCtc, maxCtc };
  }, [rows]);

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "placement-report.csv",
      ["Roll No", "Name", "Department", "Company", "Designation", "CTC", "Offer Status", "Joining Status"],
      rows.map((r) => [
        r.student?.rollNo ?? "",
        r.student?.name ?? r.offer.studentId,
        r.student?.department ?? "",
        r.drive?.companyName ?? r.offer.driveId,
        r.offer.designation,
        r.offer.ctc,
        r.offer.status,
        r.report?.status ?? "not submitted",
      ])
    );
  }

  return (
    <div>
      <Link to="/staff/reports" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Link>

      <PageHeader
        title="Placement / Offers Report"
        subtitle={stats ? `${stats.total} offers · ${stats.accepted} accepted · avg ${stats.avgCtc} LPA · highest ${stats.maxCtc} LPA` : undefined}
        icon={Briefcase}
        gradient="from-blue-500 to-indigo-600"
        action={
          rows && rows.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <div>
            <label className={labelClass}>Offer status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OfferStatus | "")} className={inputClass}>
              <option value="">All statuses</option>
              <option value="received">Received</option>
              <option value="verified">Verified</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>
        </div>
      </Card>

      {rows === null && <Skeleton className="h-40" />}
      {rows !== null && rows.length === 0 && <EmptyState icon={Briefcase} title="No offers match these filters" />}

      {rows !== null && rows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Roll No</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Designation</th>
                  <th className="py-2 pr-4">CTC</th>
                  <th className="py-2 pr-4">Offer</th>
                  <th className="py-2 pr-4">Joining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.offer.offerId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.student?.rollNo ?? "—"}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.student?.name ?? r.offer.studentId}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.drive?.companyName ?? r.offer.driveId}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.offer.designation}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.offer.ctc} LPA</td>
                    <td className="py-2 pr-4">
                      <Badge variant={OFFER_BADGE[r.offer.status]}>{r.offer.status}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{r.report?.status ?? "—"}</td>
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
