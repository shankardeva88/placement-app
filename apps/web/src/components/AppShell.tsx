import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  IdCard,
  Briefcase,
  FileText,
  Users,
  BookOpen,
  Bell,
  ClipboardCheck,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { logout } from "../lib/authActions";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/personal-details", label: "Student Info", icon: IdCard },
  { to: "/academic-record", label: "Academic Record", icon: GraduationCap },
  { to: "/drives", label: "Drives", icon: Briefcase },
  { to: "/offers", label: "Offers", icon: FileText },
  { to: "/training", label: "Training", icon: BookOpen },
  { to: "/mentor-progress", label: "Mentor Progress", icon: Users },
  { to: "/mock-performance", label: "Mock Performance", icon: ClipboardCheck },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { student, appUser } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const name = student?.name ?? appUser?.name ?? "Student";
  const initial = name.charAt(0).toUpperCase();

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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
          <span className="font-semibold text-slate-900">Placement Portal</span>
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-sm font-semibold text-white">
              {initial}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{name}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
