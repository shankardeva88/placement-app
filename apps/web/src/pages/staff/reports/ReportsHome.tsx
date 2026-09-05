import { Link } from "react-router-dom";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileBarChart,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Users,
  Users2,
  UserCheck,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";

const REPORTS: { to: string; label: string; description: string; icon: LucideIcon; gradient: string }[] = [
  {
    to: "/staff/reports/students",
    label: "Student Master Report",
    description: "Full roster — CGPA, backlogs, verification, placement status.",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    to: "/staff/reports/students-full",
    label: "Full Student Report",
    description: "Every field on the profile — academics, contact, address, links, skills, all of it. Search + filters.",
    icon: FileSpreadsheet,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    to: "/staff/reports/placements",
    label: "Placement / Offers Report",
    description: "Who's placed, where, CTC, offer and joining status.",
    icon: Briefcase,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    to: "/staff/reports/offers-internships",
    label: "Offers & Internships Report",
    description: "Both placement tracks in one table — offers link straight through to their drive.",
    icon: Building2,
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    to: "/staff/reports/drives",
    label: "Drive-wise Summary",
    description: "Applied → shortlisted → selected funnel, per drive.",
    icon: GraduationCap,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    to: "/staff/reports/mentors",
    label: "Mentor-wise Report",
    description: "Per mentor — mentee count, max CGPA, no. with backlogs, at-risk count, follow-up activity. Filter by batch.",
    icon: Users2,
    gradient: "from-slate-500 to-slate-700",
  },
  {
    to: "/staff/reports/alumni",
    label: "Alumni Report",
    description: "Placement % and average/highest CTC per batch year, top recruiting companies, plus the full searchable alumni list.",
    icon: GraduationCap,
    gradient: "from-slate-500 to-slate-700",
  },
  {
    to: "/staff/reports/mentee-roster",
    label: "Mentee Roster Report",
    description: "Every mentor-mentee assignment, one row each — filter by mentor, department, or batch.",
    icon: UserCheck,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    to: "/staff/reports/follow-up-log",
    label: "Mentee Follow-up Log",
    description: "Every mentor's follow-up entries, department-wide, in full detail — subject, drive, readiness, attendance %, note. Filter by mentor, batch, category, or date.",
    icon: FileText,
    gradient: "from-pink-500 to-rose-600",
  },
  {
    to: "/staff/reports/mock-interviews",
    label: "Mock Interview Report",
    description: "Every logged evaluation across every module — filter by batch, mentor, date, or module.",
    icon: ClipboardCheck,
    gradient: "from-indigo-500 to-purple-600",
  },
  {
    to: "/staff/reports/mock-interview-analytics",
    label: "Mock Interview Analytics",
    description: "One module at a time — daily performance trend, attendance, and faculty compliance.",
    icon: BarChart3,
    gradient: "from-indigo-500 to-purple-600",
  },
  {
    to: "/staff/reports/resume-reviews",
    label: "Resume Review Report",
    description: "Every student's latest resume status, reviewer, and version — department-wide.",
    icon: FileCheck,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    to: "/staff/reports/skill-assessments",
    label: "Skill Assessment Report",
    description: "Every student's assessment count, average score, and types covered.",
    icon: Award,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    to: "/staff/reports/training",
    label: "Training Report",
    description: "Internal training batch attendance % plus external/corporate trainings — filter by batch, department, or training batch.",
    icon: BookOpen,
    gradient: "from-amber-500 to-orange-600",
  },
  {
    to: "/staff/reports/certifications",
    label: "Certification Report",
    description: "Every certification a student has added, one row each — filter by department or batch, search by name.",
    icon: BadgeCheck,
    gradient: "from-violet-500 to-purple-600",
  },
];

export default function ReportsHome() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Pick a report to view and export."
        icon={FileBarChart}
        gradient="from-amber-500 to-orange-600"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map(({ to, label, description, icon: Icon, gradient }) => (
          <Link key={to} to={to}>
            <Card className="flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${gradient}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
