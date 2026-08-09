import { Link } from "react-router-dom";
import { ArrowRight, Award, BarChart3, ClipboardCheck, FileBarChart, FileCheck, Users, Users2, UserCheck, Briefcase, GraduationCap } from "lucide-react";
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
    to: "/staff/reports/placements",
    label: "Placement / Offers Report",
    description: "Who's placed, where, CTC, offer and joining status.",
    icon: Briefcase,
    gradient: "from-blue-500 to-indigo-600",
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
    description: "Per mentor — mentee count, avg CGPA/backlogs, at-risk count, follow-up activity.",
    icon: Users2,
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
