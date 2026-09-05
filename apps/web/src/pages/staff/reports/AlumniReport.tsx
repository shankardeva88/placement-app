import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, GraduationCap, Search } from "lucide-react";
import type { AlumniRecord, Department } from "@placement-app/types";
import { useAllAlumni } from "../../../lib/alumniLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";
import { TrendLineChart } from "../../../components/charts/TrendLineChart";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-xs font-medium text-slate-500";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

const STATUS_LABEL: Record<AlumniRecord["placementStatus"], string> = {
  placed: "Placed",
  unplaced: "Unplaced",
  entrepreneur: "Entrepreneur",
  higher_studies: "Higher Studies",
};
const STATUS_BADGE: Record<AlumniRecord["placementStatus"], BadgeVariant> = {
  placed: "success",
  unplaced: "neutral",
  entrepreneur: "brand",
  higher_studies: "warning",
};

export default function AlumniReport() {
  const alumni = useAllAlumni();
  const [deptFilter, setDeptFilter] = useState<Department | "">("");
  const [search, setSearch] = useState("");

  // AlumniRecord has no uid — rollNo is the only real identity a person has.
  // Someone with multiple offers entered as one row per offer would
  // otherwise double-count in every stat below, same issue fixed on the
  // Alumni management page itself: one record per rollNo, the most recently
  // updated one, treated as the accurate/final outcome. Keeping this dedup
  // logic consistent between the two pages matters — a coordinator
  // cross-checking a number here against the Alumni page should get the
  // same answer, not a second, differently-derived one.
  const deduped = useMemo(() => {
    if (!alumni) return null;
    const byRollNo = new Map<string, AlumniRecord>();
    for (const a of alumni) {
      if (!deptFilter || a.department === deptFilter) {
        const existing = byRollNo.get(a.rollNo);
        if (!existing || a.updatedAt > existing.updatedAt) byRollNo.set(a.rollNo, a);
      }
    }
    return Array.from(byRollNo.values());
  }, [alumni, deptFilter]);

  const batchStats = useMemo(() => {
    if (!deduped) return null;
    const byYear = new Map<number, AlumniRecord[]>();
    for (const a of deduped) {
      if (!byYear.has(a.batchYear)) byYear.set(a.batchYear, []);
      byYear.get(a.batchYear)!.push(a);
    }
    return Array.from(byYear.entries())
      .map(([batchYear, records]) => {
        const placed = records.filter((a) => a.placementStatus === "placed");
        const withCtc = placed.filter((a) => a.ctc != null);
        const avgCtc = withCtc.length > 0 ? withCtc.reduce((sum, a) => sum + (a.ctc ?? 0), 0) / withCtc.length : null;
        const top = withCtc.reduce((best, a) => (best === null || (a.ctc ?? 0) > (best.ctc ?? 0) ? a : best), null as AlumniRecord | null);
        return {
          batchYear,
          total: records.length,
          placedCount: placed.length,
          placedPct: records.length > 0 ? Math.round((placed.length / records.length) * 100) : 0,
          avgCtc,
          top,
        };
      })
      .sort((a, b) => a.batchYear - b.batchYear);
  }, [deduped]);

  const ctcTrend = useMemo(() => {
    if (!batchStats) return [];
    return batchStats
      .filter((b) => b.avgCtc != null)
      .map((b) => ({ key: String(b.batchYear), label: String(b.batchYear), value: Math.round((b.avgCtc ?? 0) * 100) / 100 }));
  }, [batchStats]);

  const topCompanies = useMemo(() => {
    if (!deduped) return null;
    const byCompany = new Map<string, AlumniRecord[]>();
    for (const a of deduped) {
      if (a.placementStatus !== "placed" || !a.companyName) continue;
      const key = a.companyName.trim();
      if (!byCompany.has(key)) byCompany.set(key, []);
      byCompany.get(key)!.push(a);
    }
    return Array.from(byCompany.entries())
      .map(([companyName, records]) => {
        const withCtc = records.filter((a) => a.ctc != null);
        const avgCtc = withCtc.length > 0 ? withCtc.reduce((sum, a) => sum + (a.ctc ?? 0), 0) / withCtc.length : null;
        return { companyName, count: records.length, avgCtc };
      })
      .sort((a, b) => b.count - a.count || a.companyName.localeCompare(b.companyName));
  }, [deduped]);

  // The batch-year/top-company stats above deliberately collapse a person
  // with multiple offers to one record (their final outcome) — right for
  // "how many unique people got placed", wrong for a reference list, which
  // used to silently drop every offer but the most recently updated one. A
  // student who had 2 offers should still show 2 offers here, not just
  // whichever one happened to be saved/edited last.
  const fullListRows = useMemo(() => {
    if (!alumni) return null;
    const scoped = alumni.filter((a) => !deptFilter || a.department === deptFilter);
    const byRollNo = new Map<string, AlumniRecord[]>();
    for (const a of scoped) {
      if (!byRollNo.has(a.rollNo)) byRollNo.set(a.rollNo, []);
      byRollNo.get(a.rollNo)!.push(a);
    }
    return Array.from(byRollNo.entries()).map(([rollNo, records]) => {
      const canonical = records.reduce((best, r) => (r.updatedAt > best.updatedAt ? r : best), records[0]);
      const offers = records.filter((r) => r.placementStatus === "placed" && r.companyName);
      return {
        rollNo,
        name: canonical.name,
        department: canonical.department,
        batchYear: canonical.batchYear,
        placementStatus: canonical.placementStatus,
        offerCount: offers.length,
        companiesLabel: offers.map((o) => `${o.companyName}${o.ctc != null ? ` (${o.ctc} LPA)` : ""}`).join("; "),
        higherStudiesDetails: canonical.higherStudiesDetails,
        notes: canonical.notes,
      };
    });
  }, [alumni, deptFilter]);

  const filteredList = useMemo(() => {
    if (!fullListRows) return null;
    const term = search.trim().toLowerCase();
    return fullListRows
      .filter((a) => !term || a.rollNo.toLowerCase().includes(term) || a.name.toLowerCase().includes(term))
      .sort((a, b) => b.batchYear - a.batchYear || a.rollNo.localeCompare(b.rollNo));
  }, [fullListRows, search]);

  const loading = deduped === null;

  function handleDownload() {
    if (!filteredList) return;
    downloadCsv(
      "alumni-report.csv",
      ["Roll No", "Name", "Department", "Batch", "Status", "No. of Offers", "Companies (Package)"],
      filteredList.map((a) => [
        a.rollNo,
        a.name,
        a.department,
        a.batchYear,
        STATUS_LABEL[a.placementStatus],
        a.offerCount,
        a.companiesLabel,
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
        title="Alumni Report"
        subtitle={loading ? undefined : `${deduped.length} alumnus/alumnae (unique) across ${batchStats?.length ?? 0} batch year(s)`}
        icon={GraduationCap}
        gradient="from-slate-500 to-slate-700"
        action={
          filteredList && filteredList.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <label className={labelClass}>Department</label>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value as Department | "")}
          className={`${inputClass} max-w-xs`}
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Card>

      {loading && <Skeleton className="h-40" />}

      {!loading && (
        <>
          <Card className="mb-4">
            <h3 className="mb-3 text-base font-semibold text-slate-900">Placement by batch year</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">Batch</th>
                    <th className="py-2 pr-4">Total Alumni</th>
                    <th className="py-2 pr-4">Placed</th>
                    <th className="py-2 pr-4">Average CTC</th>
                    <th className="py-2 pr-4">Highest CTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchStats?.map((b) => (
                    <tr key={b.batchYear}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{b.batchYear}</td>
                      <td className="py-2 pr-4 text-slate-600">{b.total}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {b.placedCount} ({b.placedPct}%)
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{b.avgCtc != null ? `${b.avgCtc.toFixed(1)} LPA` : "—"}</td>
                      <td className="py-2 pr-4 text-slate-600">
                        {b.top ? `${b.top.ctc} LPA — ${b.top.name} (${b.top.companyName ?? "—"})` : "—"}
                      </td>
                    </tr>
                  ))}
                  {batchStats?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                        No alumni records{deptFilter ? ` for ${deptFilter}` : ""} yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {ctcTrend.length >= 2 && (
            <Card className="mb-4">
              <h3 className="mb-3 text-base font-semibold text-slate-900">Average CTC trend</h3>
              <TrendLineChart data={ctcTrend} height={160} />
            </Card>
          )}

          {topCompanies && topCompanies.length > 0 && (
            <Card className="mb-4">
              <h3 className="mb-3 text-base font-semibold text-slate-900">Top recruiting companies</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Company</th>
                      <th className="py-2 pr-4">Alumni Hired</th>
                      <th className="py-2 pr-4">Average CTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topCompanies.slice(0, 20).map((c) => (
                      <tr key={c.companyName}>
                        <td className="py-2 pr-4 font-medium text-slate-800">{c.companyName}</td>
                        <td className="py-2 pr-4 text-slate-600">{c.count}</td>
                        <td className="py-2 pr-4 text-slate-600">{c.avgCtc != null ? `${c.avgCtc.toFixed(1)} LPA` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {topCompanies.length > 20 && (
                  <p className="mt-2 text-xs text-slate-400">+{topCompanies.length - 20} more companies not shown.</p>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Full list</h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search roll no or name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass} py-1.5 pl-8 text-xs sm:w-56`}
                />
              </div>
            </div>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList?.map((a) => (
                    <tr key={a.rollNo}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{a.rollNo}</td>
                      <td className="py-2 pr-4 text-slate-600">{a.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{a.department}</td>
                      <td className="py-2 pr-4 text-slate-600">{a.batchYear}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={STATUS_BADGE[a.placementStatus]}>{STATUS_LABEL[a.placementStatus]}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        {a.placementStatus === "placed" &&
                          (a.companiesLabel
                            ? `${a.offerCount > 1 ? `${a.offerCount} offers: ` : ""}${a.companiesLabel}`
                            : "—")}
                        {a.placementStatus === "higher_studies" && (a.higherStudiesDetails || "—")}
                        {(a.placementStatus === "unplaced" || a.placementStatus === "entrepreneur") && (a.notes || "—")}
                      </td>
                    </tr>
                  ))}
                  {filteredList?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                        No alumni match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
