import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, GraduationCap } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { ApplicationStatus, Drive } from "@placement-app/types";
import { useAuth } from "../../../auth/AuthContext";
import { useAllApplications } from "../../../lib/applicantsLib";
import { driveRoleSummary } from "../../../lib/driveRolesLib";
import { downloadCsv } from "../../../lib/csv";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import type { BadgeVariant } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Skeleton } from "../../../components/ui/Skeleton";
import { PageHeader } from "../../../components/ui/PageHeader";

const DRIVE_BADGE: Record<Drive["status"], BadgeVariant> = {
  upcoming: "brand",
  ongoing: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const STATUS_KEYS: ApplicationStatus[] = ["applied", "shortlisted", "in_round", "selected", "rejected", "withdrawn"];

export default function DriveSummaryReport() {
  const { appUser } = useAuth();
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const applications = useAllApplications(appUser);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  const rows = useMemo(() => {
    if (!drives || !applications) return null;
    return drives
      .map((drive) => {
        const apps = applications.filter((a) => a.driveId === drive.driveId);
        const counts = Object.fromEntries(STATUS_KEYS.map((k) => [k, apps.filter((a) => a.status === k).length])) as Record<
          ApplicationStatus,
          number
        >;
        return { drive, total: apps.length, counts };
      })
      .sort((a, b) => b.drive.createdAt - a.drive.createdAt);
  }, [drives, applications]);

  function handleDownload() {
    if (!rows) return;
    downloadCsv(
      "drive-summary-report.csv",
      ["Company", "Role", "Status", "Total Applied", "Shortlisted", "In Round", "Selected", "Rejected", "Withdrawn"],
      rows.map((r) => [
        r.drive.companyName,
        driveRoleSummary(r.drive),
        r.drive.status,
        r.total,
        r.counts.shortlisted,
        r.counts.in_round,
        r.counts.selected,
        r.counts.rejected,
        r.counts.withdrawn,
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
        title="Drive-wise Summary"
        subtitle="Application funnel per drive."
        icon={GraduationCap}
        gradient="from-violet-500 to-purple-600"
        action={
          rows && rows.length > 0 ? (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          ) : undefined
        }
      />

      {rows === null && <Skeleton className="h-40" />}
      {rows !== null && rows.length === 0 && <EmptyState icon={GraduationCap} title="No drives yet" />}

      {rows !== null && rows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Applied</th>
                  <th className="py-2 pr-4">Shortlisted</th>
                  <th className="py-2 pr-4">In round</th>
                  <th className="py-2 pr-4">Selected</th>
                  <th className="py-2 pr-4">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.drive.driveId}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{r.drive.companyName}</td>
                    <td className="py-2 pr-4 text-slate-600">{driveRoleSummary(r.drive)}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={DRIVE_BADGE[r.drive.status]}>{r.drive.status}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{r.total}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.counts.shortlisted}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.counts.in_round}</td>
                    <td className="py-2 pr-4 font-medium text-emerald-700">{r.counts.selected}</td>
                    <td className="py-2 pr-4 text-slate-600">{r.counts.rejected}</td>
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
