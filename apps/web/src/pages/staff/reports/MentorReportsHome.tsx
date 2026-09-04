import { Link } from "react-router-dom";
import { ArrowRight, FileBarChart, FileText, Users, MessageCircleMore, ClipboardCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";

const REPORTS: { to: string; label: string; description: string; icon: LucideIcon; gradient: string }[] = [
  {
    to: "/staff/mentor-reports/mentees",
    label: "Mentee Master Report",
    description: "Your mentees — CGPA, backlogs, SGPA trend, placement status, trainings, at-risk flags.",
    icon: Users,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    to: "/staff/mentor-reports/follow-ups",
    label: "Follow-up Activity Report",
    description: "Per mentee: how many follow-ups, by category, last contact date.",
    icon: MessageCircleMore,
    gradient: "from-pink-500 to-rose-600",
  },
  {
    to: "/staff/mentor-reports/follow-up-log",
    label: "Mentee Follow-up Log",
    description: "Every follow-up entry in full detail — subject, drive, readiness, attendance %, note — your maintained record, exportable.",
    icon: FileText,
    gradient: "from-pink-500 to-rose-600",
  },
  {
    to: "/staff/mentor-reports/mock-evaluations",
    label: "Mock Interview & Evaluation Summary",
    description: "Mock interview scores, module evaluation ratings, resume review status, skill assessments.",
    icon: ClipboardCheck,
    gradient: "from-indigo-500 to-purple-600",
  },
];

export default function MentorReportsHome() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Reports scoped to your own mentees — pick one to view and export."
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
