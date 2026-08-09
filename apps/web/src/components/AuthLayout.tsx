import type { ReactNode } from "react";
import { Award, Briefcase, Building2, TrendingUp } from "lucide-react";
import vishnuLogo from "../assets/vishnu-logo.png";

/** Soft, semi-transparent placement-themed icons scattered across the
 * branding panel — decoration only (aria-hidden), not real content. */
function FloatingIcon({
  Icon,
  className,
}: {
  Icon: typeof Briefcase;
  className: string;
}) {
  return (
    <div className={`pointer-events-none absolute text-white/15 ${className}`} aria-hidden="true">
      <Icon className="h-full w-full" strokeWidth={1.5} />
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Branding panel — full hero on large screens, compact header on mobile */}
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-700 px-6 py-8 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:px-16 lg:py-16">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-purple-400/20 blur-3xl" />
        <FloatingIcon Icon={Briefcase} className="right-10 top-16 hidden h-16 w-16 -rotate-12 lg:block" />
        <FloatingIcon Icon={TrendingUp} className="bottom-40 right-24 hidden h-20 w-20 rotate-6 lg:block" />
        <FloatingIcon Icon={Building2} className="bottom-16 left-10 hidden h-24 w-24 -rotate-6 lg:block" />
        <FloatingIcon Icon={Award} className="left-24 top-1/2 hidden h-14 w-14 rotate-12 lg:block" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg">
            <img src={vishnuLogo} alt="Vishnu Institute of Technology" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight text-white lg:text-lg">Vishnu Institute of Technology</h1>
            <p className="text-xs text-white/70 lg:text-sm">Placement Portal</p>
          </div>
        </div>

        <div className="relative mt-6 hidden lg:mt-auto lg:block">
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Your career journey, tracked end to end.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            Drives, applications, mock interviews, and offers — everything a student, mentor, and coordinator needs
            in one place.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
