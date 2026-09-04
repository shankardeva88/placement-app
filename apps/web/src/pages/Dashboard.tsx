import { useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  IdCard,
  Briefcase,
  FileText,
  Users,
  BookOpen,
  Bell,
  Gauge,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DB_NODES } from "@placement-app/types";
import type { Offer, PlacementStatus, Student } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { useMyApplications } from "../lib/useMyApplications";
import { useOwnedDriveRecords } from "../lib/useOwnedDriveRecords";
import { useRelevantNotifications } from "../lib/notificationsLib";
import { requestProfileVerification } from "../lib/studentsDirectoryLib";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import type { BadgeVariant } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

const PLACEMENT_BADGE: Record<PlacementStatus, BadgeVariant> = {
  not_placed: "neutral",
  placed: "success",
  multiple_offers: "success",
  opted_higher_studies: "brand",
  opted_out: "neutral",
};

const QUICK_LINKS: { to: string; label: string; icon: LucideIcon; description: string; gradient: string }[] = [
  {
    to: "/personal-details",
    label: "Student Info",
    icon: IdCard,
    description: "Contact info & address",
    gradient: "from-fuchsia-500 to-pink-600",
  },
  {
    to: "/academic-record",
    label: "Academic Record",
    icon: GraduationCap,
    description: "Update SGPA & backlogs",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    to: "/drives",
    label: "Drives",
    icon: Briefcase,
    description: "Browse & apply",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    to: "/offers",
    label: "Offers",
    icon: FileText,
    description: "Accept & submit joining proof",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    to: "/training",
    label: "Training",
    icon: BookOpen,
    description: "Batches & attendance",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    to: "/mentor-progress",
    label: "Mentor Progress",
    icon: Users,
    description: "Mock interviews & reviews",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    description: "Announcements",
    gradient: "from-sky-500 to-cyan-600",
  },
];

function StatTile({
  label,
  value,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  gradient: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// The one place a student is alerted their profile isn't verified yet, and
// can do something about it — a red "not verified" state, and a softer
// amber "already asked, waiting on mentor/coordinator" state once they've
// clicked through. See Student.verificationRequestedAt doc comment.
function VerificationBanner({ student }: { student: Student }) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const pending = !!student.verificationRequestedAt;

  async function handleRequest() {
    setSubmitting(true);
    try {
      await requestProfileVerification(student.uid);
      showToast("Sent — your mentor or coordinator will review it");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className={`mt-6 border ${pending ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${pending ? "text-amber-800" : "text-red-800"}`}>
            {pending ? "Verification requested — awaiting review" : "Your profile is not verified"}
          </p>
          <p className={`mt-0.5 text-sm ${pending ? "text-amber-700" : "text-red-700"}`}>
            {pending ? (
              "Your mentor or coordinator hasn't reviewed it yet — you can still update your details in the meantime."
            ) : (
              <>
                Review your{" "}
                <Link to="/personal-details" className="underline">
                  Student Info
                </Link>{" "}
                and{" "}
                <Link to="/academic-record" className="underline">
                  Academic Record
                </Link>
                , then submit for your mentor/coordinator to verify.
              </>
            )}
          </p>
        </div>
        <Button variant={pending ? "secondary" : "primary"} onClick={handleRequest} loading={submitting}>
          {pending ? "Request again" : "Submit for verification"}
        </Button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const { appUser, student } = useAuth();
  const applications = useMyApplications(student?.uid);
  const offers = useOwnedDriveRecords<Offer>(student?.uid, DB_NODES.offers);
  const notifications = useRelevantNotifications(student);

  const applicationCount = applications?.filter((a) => a.record !== null).length;
  const offerCount = offers?.filter((o) => o.record !== null).length;
  const unreadCount = notifications?.filter((n) => !n.readBy?.[student?.uid ?? ""]).length;

  const name = student?.name ?? appUser?.name;

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 p-6 text-white shadow-lg shadow-brand-200 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-purple-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
          {student && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{student.department}</Badge>
              <Badge variant="neutral">Batch {student.batchYear}</Badge>
              <Badge variant={PLACEMENT_BADGE[student.placementStatus]}>
                {student.placementStatus.replace("_", " ")}
              </Badge>
            </div>
          )}
        </div>
      </div>

      <Card className="mt-6">
        <h2 className="text-base font-semibold text-slate-900">Profile</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Roll number</dt>
            <dd className="font-medium text-slate-900">{student?.rollNo || "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Department</dt>
            <dd className="font-medium text-slate-900">{student?.department}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Graduating year</dt>
            <dd className="font-medium text-slate-900">{student?.batchYear}</dd>
          </div>
          <div>
            <dt className="text-slate-500">CGPA</dt>
            <dd className="font-medium text-slate-900">{student?.cgpa}</dd>
          </div>
        </dl>
      </Card>

      {student && !student.verifiedByFaculty && <VerificationBanner student={student} />}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Applications"
          value={applicationCount != null ? String(applicationCount) : "…"}
          icon={Briefcase}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatTile
          label="Offers"
          value={offerCount != null ? String(offerCount) : "…"}
          icon={FileText}
          gradient="from-emerald-500 to-teal-600"
        />
        <StatTile
          label="Unread notifications"
          value={unreadCount != null ? String(unreadCount) : "…"}
          icon={Bell}
          gradient="from-sky-500 to-cyan-600"
        />
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-300 to-slate-400 text-white">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Not yet available</p>
              <p className="text-xs text-slate-400">Readiness Index</p>
            </div>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Quick links
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map(({ to, label, icon: Icon, description, gradient }) => (
          <Link key={to} to={to}>
            <Card className="flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{label}</p>
                <p className="truncate text-xs text-slate-500">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
