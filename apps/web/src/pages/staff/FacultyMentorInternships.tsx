import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import type { Internship, InternshipMode, InternshipStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useMyMentees } from "../../lib/menteeFollowUpLib";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllInternships } from "../../lib/internshipsLib";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

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

function InternshipCard({ internship, student }: { internship: Internship; student: Student | undefined }) {
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
    </Card>
  );
}

/** Read-only — internship operations (create/edit/delete) stay coordinator/
 * hod-tier, same split as FacultyMentorDrives.tsx vs the full Drives page.
 * Scoped to this mentor's own mentees, not the whole department. */
export default function FacultyMentorInternships() {
  const { appUser, firebaseUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<InternshipStatus | "">("");

  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);
  const internships = useAllInternships(appUser);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);
  const menteeUids = useMemo(() => new Set((mentees ?? []).map((m) => m.studentId)), [mentees]);

  const rows = useMemo(() => {
    if (!internships || !mentees) return null;
    return internships
      .filter((i) => menteeUids.has(i.studentId))
      .filter((i) => !statusFilter || i.status === statusFilter)
      .sort((a, b) => b.startDate - a.startDate);
  }, [internships, mentees, menteeUids, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Internships"
        subtitle="Internships recorded for your mentees — read-only, same records your coordinator manages."
        icon={Building2}
        gradient="from-cyan-500 to-blue-600"
      />

      {rows !== null && rows.length > 0 && (
        <div className="mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InternshipStatus | "")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-48"
          >
            <option value="">All statuses</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      )}

      {rows === null && (
        <div className="space-y-3">
          <Skeleton className="h-32" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <EmptyState icon={Building2} title="No internships recorded for your mentees yet" />
      )}

      <div className="space-y-4">
        {rows?.map((i) => (
          <InternshipCard key={i.internshipId} internship={i} student={studentsByUid[i.studentId]} />
        ))}
      </div>
    </div>
  );
}
