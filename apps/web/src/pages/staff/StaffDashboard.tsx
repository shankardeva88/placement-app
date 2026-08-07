import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase,
  Users,
  FileText,
  Bell,
  BookOpen,
  GraduationCap,
  FileBarChart,
  Users2,
  TrendingUp,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  Award,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { Department, Drive, DriveStatus, DriveType, PlacementStatus, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { useAllApplications } from "../../lib/applicantsLib";
import { useAllOffers } from "../../lib/offersManagementLib";
import { useAllAlumni } from "../../lib/alumniLib";
import { useAllTrainingBatches, useAllTrainingSessions } from "../../lib/trainingManagementLib";
import { useMyMentees } from "../../lib/menteeFollowUpLib";
import { MenteeRow } from "./MenteeInfo";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { CATEGORICAL, SEQUENTIAL_BLUE } from "../../components/charts/chartTokens";
import { SimpleBarChart } from "../../components/charts/SimpleBarChart";
import { StackedShareBar } from "../../components/charts/StackedShareBar";
import { StackedColumnChart } from "../../components/charts/StackedColumnChart";
import { TrendLineChart } from "../../components/charts/TrendLineChart";

const INSTITUTION_ROLES = new Set(["dean", "principal", "cpo", "admin"]);

const DRIVE_TYPE_LABEL: Record<DriveType, string> = { full_time: "Full-time", internship: "Internship" };
const DRIVE_STATUS_BADGE: Record<DriveStatus, BadgeVariant> = {
  upcoming: "brand",
  ongoing: "warning",
  completed: "neutral",
  cancelled: "danger",
};

const QUICK_LINKS: { to: string; label: string; icon: LucideIcon; description: string; gradient: string }[] = [
  { to: "/staff/drives", label: "Drives", icon: Briefcase, description: "Create & manage drives", gradient: "from-blue-500 to-indigo-600" },
  { to: "/staff/students", label: "Students", icon: Users, description: "Directory & verification", gradient: "from-emerald-500 to-teal-600" },
  { to: "/staff/alumni", label: "Alumni", icon: Users2, description: "Passed-out batches archive", gradient: "from-slate-500 to-slate-700" },
  { to: "/staff/offers", label: "Offers", icon: FileText, description: "Record & track offers", gradient: "from-emerald-500 to-teal-600" },
  { to: "/staff/training", label: "Training", icon: BookOpen, description: "Batches & attendance", gradient: "from-amber-500 to-orange-600" },
  { to: "/staff/mentor-tools", label: "Mentor Tools", icon: GraduationCap, description: "Mock interviews & reviews", gradient: "from-pink-500 to-rose-600" },
  { to: "/staff/reports", label: "Reports", icon: FileBarChart, description: "Master, placement & drive reports", gradient: "from-amber-500 to-orange-600" },
  { to: "/staff/notifications", label: "Notifications", icon: Bell, description: "Send announcements", gradient: "from-sky-500 to-cyan-600" },
];

const PLACEMENT_STATUS_ORDER: PlacementStatus[] = ["not_placed", "placed", "multiple_offers", "opted_higher_studies", "opted_out"];
const PLACEMENT_STATUS_LABEL: Record<PlacementStatus, string> = {
  not_placed: "Not placed",
  placed: "Placed",
  multiple_offers: "Multiple offers",
  opted_higher_studies: "Higher studies",
  opted_out: "Opted out",
};

const ALUMNI_STATUS_ORDER = ["placed", "unplaced", "entrepreneur", "higher_studies"] as const;
const ALUMNI_STATUS_LABEL: Record<(typeof ALUMNI_STATUS_ORDER)[number], string> = {
  placed: "Placed",
  unplaced: "Unplaced",
  entrepreneur: "Entrepreneur",
  higher_studies: "Higher studies",
};

function StatTile({ label, value, icon: Icon, gradient }: { label: string; value: string; icon: LucideIcon; gradient: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}>
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

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </Card>
  );
}

/** faculty_mentor gets an entirely different dashboard (see
 * FacultyMentorDashboard below), not a filtered version of this one — this
 * component keeps the coordinator/hod/institution department-wide
 * operational view (drives, applications, alumni, training batches), none
 * of which is faculty_mentor's job (see the nav comment in StaffShell.tsx). */
function CoordinatorDashboard() {
  const { appUser } = useAuth();
  const quickLinks = QUICK_LINKS;
  const isInstitution = !!appUser && INSTITUTION_ROLES.has(appUser.role);
  const myDept = appUser && "department" in appUser ? appUser.department : undefined;

  const allStudents = useStudentsDirectory(appUser);
  const allAlumni = useAllAlumni();
  const [drives, setDrives] = useState<Drive[] | null>(null);
  const allApplications = useAllApplications(appUser);
  const allOffers = useAllOffers(appUser);
  const allBatches = useAllTrainingBatches();
  const sessions = useAllTrainingSessions();

  const [batchFilter, setBatchFilter] = useState<number | "">("");

  // Alumni never belong on a "current students" dashboard — see the
  // Graduate a Batch feature. Batch years offered here come from the
  // remaining active roster only, same reasoning as Students.tsx.
  const activeStudents = useMemo(() => (allStudents ?? []).filter((s) => !s.isAlumni), [allStudents]);
  const batchYears = useMemo(
    () => Array.from(new Set(activeStudents.map((s) => s.batchYear))).sort((a, b) => a - b),
    [activeStudents]
  );

  const students = useMemo(
    () => (allStudents === null ? null : activeStudents.filter((s) => !batchFilter || s.batchYear === batchFilter)),
    [allStudents, activeStudents, batchFilter]
  );

  // Applications/offers don't carry batchYear directly — cross-reference via
  // the (already batch-filtered) students list so "Applicants"/"Offers"
  // stay in sync with whichever batch the Students/Placed tiles reflect.
  const scopedStudentUids = useMemo(() => (students ? new Set(students.map((s) => s.uid)) : null), [students]);
  const applications = useMemo(
    () => (allApplications === null || scopedStudentUids === null ? allApplications : allApplications.filter((a) => scopedStudentUids.has(a.studentId))),
    [allApplications, scopedStudentUids]
  );
  const offers = useMemo(
    () => (allOffers === null || scopedStudentUids === null ? allOffers : allOffers.filter((o) => scopedStudentUids.has(o.studentId))),
    [allOffers, scopedStudentUids]
  );

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      const val = snap.val() as Record<string, Drive> | null;
      setDrives(val ? Object.values(val) : []);
    });
  }, []);

  // Drives are readable staff-wide with no department restriction (students
  // need to browse them too — see database.rules.json), so "which drives are
  // actually relevant to my department" has to be filtered client-side: open
  // to everyone (empty eligibility.departments) or explicitly includes mine.
  const scopedDrives = useMemo(() => {
    if (!drives) return null;
    if (isInstitution || !myDept) return drives;
    return drives.filter((d) => d.eligibility.departments.length === 0 || d.eligibility.departments.includes(myDept));
  }, [drives, isInstitution, myDept]);

  const upcomingDrives = useMemo(() => {
    if (!scopedDrives) return null;
    return scopedDrives
      .filter((d) => d.status === "upcoming" || d.status === "ongoing")
      .sort((a, b) => a.driveDate - b.driveDate)
      .slice(0, 6);
  }, [scopedDrives]);

  const alumni = useMemo(() => {
    if (!allAlumni) return null;
    if (isInstitution || !myDept) return allAlumni;
    return allAlumni.filter((a) => a.department === myDept);
  }, [allAlumni, isInstitution, myDept]);

  const scopedBatches = useMemo(() => {
    if (!allBatches) return null;
    if (isInstitution || !myDept) return allBatches;
    return allBatches.filter((b) => b.department === myDept);
  }, [allBatches, isInstitution, myDept]);

  const upcomingSessions = useMemo(() => {
    if (!scopedBatches || !sessions) return null;
    const batchIds = new Set(scopedBatches.map((b) => b.batchId));
    const batchById = new Map(scopedBatches.map((b) => [b.batchId, b]));
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const weekAhead = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return sessions
      .filter((s) => batchIds.has(s.batchId) && s.date >= dayAgo && s.date <= weekAhead)
      .sort((a, b) => a.date - b.date)
      .slice(0, 6)
      .map((s) => ({ session: s, batch: batchById.get(s.batchId) }));
  }, [scopedBatches, sessions]);

  const activeDrives = scopedDrives?.filter((d) => d.status === "upcoming" || d.status === "ongoing").length;
  const placedCount = students?.filter((s) => s.placementStatus === "placed" || s.placementStatus === "multiple_offers").length;
  const placementRate =
    students && students.length > 0 && placedCount != null ? Math.round((placedCount / students.length) * 100) : null;

  const byDepartment = useMemo(() => {
    if (!students) return null;
    const counts = new Map<Department, number>();
    for (const s of students) counts.set(s.department, (counts.get(s.department) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([dept, count]) => ({ key: dept, label: dept, value: count }));
  }, [students]);

  const placementShare = useMemo(() => {
    if (!students) return null;
    return PLACEMENT_STATUS_ORDER.map((status, i) => ({
      key: status,
      label: PLACEMENT_STATUS_LABEL[status],
      value: students.filter((s) => s.placementStatus === status).length,
      color: CATEGORICAL[i],
    }));
  }, [students]);

  const applicationsTrend = useMemo(() => {
    if (!applications) return null;
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const buckets = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = now - i * weekMs;
      const weekEnd = weekStart + weekMs;
      const count = applications.filter((a) => a.appliedAt >= weekStart && a.appliedAt < weekEnd).length;
      buckets.push({
        key: String(i),
        label: new Date(weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: count,
      });
    }
    return buckets;
  }, [applications]);

  const alumniLegend = ALUMNI_STATUS_ORDER.map((status, i) => ({
    key: status,
    label: ALUMNI_STATUS_LABEL[status],
    color: CATEGORICAL[i],
  }));

  const alumniByYear = useMemo(() => {
    if (!alumni) return null;
    const years = Array.from(new Set(alumni.map((a) => a.batchYear))).sort((a, b) => a - b);
    return years.map((year) => ({
      key: String(year),
      label: String(year),
      segments: ALUMNI_STATUS_ORDER.map((status, i) => ({
        key: status,
        label: ALUMNI_STATUS_LABEL[status],
        value: alumni.filter((a) => a.batchYear === year && a.placementStatus === status).length,
        color: CATEGORICAL[i],
      })),
    }));
  }, [alumni]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 p-6 text-white shadow-lg shadow-brand-200 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-purple-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold">{appUser?.name}</h1>
          <p className="mt-2 text-sm text-white/70">
            {appUser && "department" in appUser && appUser.department
              ? `${appUser.department} department`
              : "Institution-wide access"}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {batchFilter ? `Batch ${batchFilter}` : "All batches"}
        </h2>
        {batchYears.length > 0 && (
          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : "")}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All batches</option>
            {batchYears.map((y) => (
              <option key={y} value={y}>
                Batch {y}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Students" value={students != null ? String(students.length) : "…"} icon={Users} gradient="from-emerald-500 to-teal-600" />
        <StatTile label="Active drives" value={activeDrives != null ? String(activeDrives) : "…"} icon={Briefcase} gradient="from-blue-500 to-indigo-600" />
        <StatTile label="Applicants" value={applications != null ? String(applications.length) : "…"} icon={FileText} gradient="from-sky-500 to-cyan-600" />
        <StatTile label="Offers" value={offers != null ? String(offers.length) : "…"} icon={Award} gradient="from-pink-500 to-rose-600" />
        <StatTile label="Placement rate" value={placementRate != null ? `${placementRate}%` : "…"} icon={TrendingUp} gradient="from-amber-500 to-orange-600" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Overview</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Students by department" subtitle="Current students in your scope.">
          {byDepartment ? <SimpleBarChart data={byDepartment} hue={SEQUENTIAL_BLUE} /> : <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
        </ChartCard>

        <ChartCard title="Placement status" subtitle="Share of current students by outcome so far.">
          {placementShare ? <StackedShareBar segments={placementShare} /> : <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
        </ChartCard>

        <ChartCard title="Applications, last 8 weeks" subtitle="Weekly volume across all drives.">
          {applicationsTrend ? <TrendLineChart data={applicationsTrend} /> : <p className="py-8 text-center text-sm text-slate-400">Loading…</p>}
        </ChartCard>

        <ChartCard title="Alumni outcomes by batch" subtitle="From the Alumni archive — passed-out batches.">
          {alumniByYear ? (
            alumniByYear.length > 0 ? (
              <StackedColumnChart columns={alumniByYear} legend={alumniLegend} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                No alumni records yet —{" "}
                <Link to="/staff/alumni" className="text-brand-700 underline">
                  add some
                </Link>
                .
              </p>
            )
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          )}
        </ChartCard>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {isInstitution || !myDept ? "What's happening" : `What's happening in ${myDept}`}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Briefcase className="h-4 w-4 text-brand-600" />
            Upcoming & ongoing drives
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            {isInstitution || !myDept ? "Across every department." : "Open to your department (or open to all)."}
          </p>
          {upcomingDrives === null ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
          ) : upcomingDrives.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No upcoming or ongoing drives right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingDrives.map((d) => (
                <li key={d.driveId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{d.companyName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {d.jobRole} · {DRIVE_TYPE_LABEL[d.type]} · {new Date(d.driveDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={DRIVE_STATUS_BADGE[d.status]}>{d.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarClock className="h-4 w-4 text-brand-600" />
            Training this week
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            {isInstitution || !myDept ? "Sessions across every batch." : "Sessions in your department's batches."}
          </p>
          {upcomingSessions === null ? (
            <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
          ) : upcomingSessions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No sessions in the next 7 days.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcomingSessions.map(({ session, batch }) => (
                <li key={session.sessionId} className="py-2 text-sm">
                  <p className="font-medium text-slate-800">{session.topic}</p>
                  <p className="text-xs text-slate-500">
                    {batch?.name ?? session.batchId} · {new Date(session.date).toLocaleDateString()} · {session.startTime}–{session.endTime}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick links</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ to, label, icon: Icon, description, gradient }) => (
          <Link key={to} to={to}>
            <Card className="flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}>
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

const FACULTY_MENTOR_QUICK_LINKS: { to: string; label: string; icon: LucideIcon; description: string; gradient: string }[] = [
  { to: "/staff/mentee-info", label: "Mentee Info", icon: Users, description: "Full profile for each mentee", gradient: "from-emerald-500 to-teal-600" },
  { to: "/staff/mentor-tools", label: "Mentor Tools", icon: GraduationCap, description: "Follow-ups, mock interviews, reviews", gradient: "from-pink-500 to-rose-600" },
  { to: "/staff/mock-evaluations", label: "Mock Interview Modules", icon: ClipboardCheck, description: "Daily evaluations for a company drive", gradient: "from-indigo-500 to-purple-600" },
];

/** faculty_mentor's whole job is ~10-12 assigned mentees — this dashboard is
 * built entirely from that roster (mentorMapping), not department-wide
 * drives/applications/alumni/training data the way CoordinatorDashboard is.
 * See the nav comment in StaffShell.tsx for the fuller reasoning. */
function FacultyMentorDashboard() {
  const { appUser, firebaseUser } = useAuth();
  const mentees = useMyMentees(appUser, firebaseUser?.uid);
  const students = useStudentsDirectory(appUser);

  const studentsByUid = useMemo(() => Object.fromEntries((students ?? []).map((s) => [s.uid, s])), [students]);

  const menteeStudents = useMemo(() => {
    if (!mentees) return [];
    return mentees
      .map((m) => studentsByUid[m.studentId])
      .filter((s): s is Student => s !== undefined)
      .sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  }, [mentees, studentsByUid]);

  const loading = mentees === null || students === null;

  const stats = useMemo(() => {
    if (loading) return null;
    const total = menteeStudents.length;
    const verified = menteeStudents.filter((s) => s.verifiedByFaculty).length;
    const placed = menteeStudents.filter((s) => s.placementStatus === "placed" || s.placementStatus === "multiple_offers").length;
    const topCgpa = total > 0 ? Math.max(...menteeStudents.map((s) => s.cgpa)) : 0;
    return { total, verified, placed, topCgpa };
  }, [menteeStudents, loading]);

  // A mentor's mentees aren't necessarily all one batch (e.g. 2027 finals
  // and 2028 3rd-years both assigned to the same mentor) — see the same
  // reasoning on the Mentee Info batch filter.
  const byBatch = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of menteeStudents) counts.set(s.batchYear, (counts.get(s.batchYear) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  }, [menteeStudents]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 p-6 text-white shadow-lg shadow-brand-200 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-purple-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/80">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold">{appUser?.name}</h1>
          <p className="mt-2 text-sm text-white/70">
            {appUser && "department" in appUser && appUser.department ? `${appUser.department} department` : ""}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <StatTile label="My mentees" value={stats ? String(stats.total) : "…"} icon={Users} gradient="from-emerald-500 to-teal-600" />
          {byBatch.length > 0 && (
            <p className="mt-1.5 px-1 text-xs text-slate-500">
              {byBatch.map(([year, count]) => `Batch ${year}: ${count}`).join(" · ")}
            </p>
          )}
        </div>
        <StatTile label="Verified" value={stats ? String(stats.verified) : "…"} icon={GraduationCap} gradient="from-blue-500 to-indigo-600" />
        <StatTile label="Placed" value={stats ? String(stats.placed) : "…"} icon={TrendingUp} gradient="from-amber-500 to-orange-600" />
        <StatTile label="Top CGPA" value={stats ? String(stats.topCgpa) : "…"} icon={FileBarChart} gradient="from-sky-500 to-cyan-600" />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">My mentees</h2>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : menteeStudents.length === 0 ? (
        <EmptyState icon={Users} title="No mentees assigned to you yet" />
      ) : (
        <div className="space-y-3">
          {menteeStudents.map((s) => (
            <MenteeRow key={s.studentId} student={s} />
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Quick links</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FACULTY_MENTOR_QUICK_LINKS.map(({ to, label, icon: Icon, description, gradient }) => (
          <Link key={to} to={to}>
            <Card className="flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}>
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

export default function StaffDashboard() {
  const { appUser } = useAuth();
  if (appUser?.role === "faculty_mentor") return <FacultyMentorDashboard />;
  return <CoordinatorDashboard />;
}
