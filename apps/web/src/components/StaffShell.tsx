import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Bell,
  BookOpen,
  GraduationCap,
  UserPlus,
  FileBarChart,
  Users2,
  ClipboardCheck,
  KeyRound,
  Building2,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { logout } from "../lib/authActions";

const STAFF_NAV_ITEMS = [
  { to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/drives", label: "Drives", icon: Briefcase },
  { to: "/staff/students", label: "Students", icon: Users },
  { to: "/staff/alumni", label: "Alumni", icon: Users2 },
  { to: "/staff/offers", label: "Offers", icon: FileText },
  { to: "/staff/internships", label: "Internships", icon: Building2 },
  { to: "/staff/training", label: "Training", icon: BookOpen },
  { to: "/staff/mentor-tools", label: "Mentor Tools", icon: GraduationCap },
  { to: "/staff/mock-evaluations", label: "Mock Interview Modules", icon: ClipboardCheck },
  { to: "/staff/reports", label: "Reports", icon: FileBarChart },
  { to: "/staff/notifications", label: "Notifications", icon: Bell },
];

// Admin and cpo (the overall campus placement officer, see
// database.rules.json's institution tier) are the only roles with
// account/role management on top of full operational access.
const MANAGE_STAFF_ITEM = { to: "/staff/manage-staff", label: "Manage Staff", icon: UserPlus };
const ADMIN_NAV_ITEMS = [...STAFF_NAV_ITEMS, MANAGE_STAFF_ITEM];

// faculty_mentor's actual job is owning ~10-12 assigned mentees — regular
// follow-up on their academics/placement/attendance/activities and parent
// communication (see Mentor Tools → My Mentees) — not drive *operations*
// (creating/editing drives, applicants, Offers, managing Notifications,
// Alumni, batch/session scheduling — coordinator/hod-tier, see the
// database.rules.json write restrictions). So they get a deliberately
// short, mentee-scoped menu:
//   - Dashboard: mentee-focused summary, not the department-wide operational
//     one coordinator/hod see (StaffDashboard.tsx branches on role).
//   - Mentee Info: browse a mentee's full profile (contact, academics,
//     links, trainings) — links into the same /staff/students/:uid page
//     coordinators use, just entered from "my mentees" instead of the full
//     department directory (which faculty_mentor doesn't get — no
//     /staff/students item here, that's coordinator/hod-tier).
//   - Drives: read-only view of every drive (completed and upcoming) with
//     the full details a coordinator entered — FacultyMentorDrives.tsx, a
//     separate page from /staff/drives (which has create/edit/status
//     actions with no role gate — deliberately not linked here).
//   - Training: read-only — FacultyMentorTraining.tsx, NOT the same page as
//     coordinator/hod (/staff/training, which has batch/session creation and
//     attendance-marking/QR-check-in actions). A mentor isn't the one
//     running these sessions (confirmed choice), so this is purely "what's
//     currently on, and how are my specific mentees doing" — attendance
//     shown read-only per mentee, reusing the same per-student hook the
//     student's own Training page uses.
//   - Mentor Tools: the action side — log follow-ups, record 1:1 mock
//     interviews, resume reviews, skill assessments.
//   - Mock Interview Modules: log/review daily evaluations for a company
//     drive (e.g. "Infosys Mock").
//   - Reports: mentee-scoped reports (MentorReportsHome.tsx), not the
//     department-wide /staff/reports coordinator/hod see.
const FACULTY_MENTOR_NAV_ITEMS = [
  { to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/mentee-info", label: "Mentee Info", icon: Users },
  { to: "/staff/mentor-drives", label: "Drives", icon: Briefcase },
  { to: "/staff/mentor-training", label: "Training", icon: BookOpen },
  { to: "/staff/mentor-tools", label: "Mentor Tools", icon: GraduationCap },
  { to: "/staff/mock-evaluations", label: "Mock Interview Modules", icon: ClipboardCheck },
  { to: "/staff/mentor-reports", label: "Reports", icon: FileBarChart },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  dean: "Dean",
  principal: "Principal",
  cpo: "CPO",
  hod: "HOD",
  coordinator: "Coordinator",
  faculty_mentor: "Faculty Mentor",
};

export function StaffShell({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const name = appUser?.name ?? "Staff";
  const initial = name.charAt(0).toUpperCase();
  const roleLabel = appUser ? ROLE_LABEL[appUser.role] ?? appUser.role : "";
  const navItems =
    appUser?.role === "admin" || appUser?.role === "cpo"
      ? ADMIN_NAV_ITEMS
      : appUser?.role === "faculty_mentor"
        ? FACULTY_MENTOR_NAV_ITEMS
        : STAFF_NAV_ITEMS;

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm shadow-brand-200"
                : "text-slate-600 hover:bg-slate-100"
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  const signOutButton = (
    <div className="border-t border-slate-200 p-3">
      <NavLink
        to="/staff/change-password"
        onClick={() => setDrawerOpen(false)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        <KeyRound className="h-4 w-4" />
        Change Password
      </NavLink>
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-brand-50">
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-sm font-semibold text-white shadow-sm shadow-brand-200">
            P
          </div>
          <div>
            <span className="block font-semibold text-slate-900">Placement Portal</span>
            <span className="block text-xs text-slate-400">Staff console</span>
          </div>
        </div>
        {navLinks}
        {signOutButton}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="font-semibold text-slate-900">Placement Portal</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            {navLinks}
            {signOutButton}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/70 px-4 py-3 backdrop-blur-md lg:px-8">
          <button onClick={() => setDrawerOpen(true)} className="text-slate-500 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold text-slate-900 lg:hidden">Placement Portal</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700 sm:block">
              {roleLabel}
              {appUser && "department" in appUser && appUser.department ? ` · ${appUser.department}` : ""}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-sm font-semibold text-white">
              {initial}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{name}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
