import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
      <Icon className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}
