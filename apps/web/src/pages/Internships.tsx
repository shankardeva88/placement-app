import { Building2 } from "lucide-react";
import type { Internship, InternshipMode, InternshipStatus } from "@placement-app/types";
import { DB_NODES } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useIndexedList } from "../lib/mentorProgressLib";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { PageHeader } from "../components/ui/PageHeader";

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

function InternshipCard({ internship }: { internship: Internship }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{internship.companyName}</h3>
          <p className="text-sm text-slate-500">{internship.role}</p>
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

/** Read-only — internships are recorded by the coordinator/HOD (see
 * staff/Internships.tsx), same as offers. Deliberately separate from
 * Offers/Drives: no rounds, no CTC-as-LPA outcome, just a tracked
 * 3/6/12-month engagement (see the Internship doc comment in
 * packages/types for the full reasoning). */
export default function Internships() {
  const { student } = useAuth();
  const internships = useIndexedList<Internship>(student?.uid, DB_NODES.internships);

  if (!student) return null;

  return (
    <div>
      <PageHeader
        title="Internships"
        subtitle="Internships recorded for you by your placement coordinator."
        icon={Building2}
        gradient="from-cyan-500 to-blue-600"
      />

      {internships === null && (
        <div className="space-y-3">
          <Skeleton className="h-32" />
        </div>
      )}

      {internships !== null && internships.length === 0 && (
        <EmptyState icon={Building2} title="No internships recorded yet" subtitle="Your coordinator will add one here once you're placed for an internship." />
      )}

      <div className="space-y-4">
        {internships?.map((i) => (
          <InternshipCard key={i.internshipId} internship={i} />
        ))}
      </div>
    </div>
  );
}
