import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "brand" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-600",
  brand: "bg-brand-100 text-brand-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
};

export function Badge({
  variant = "neutral",
  title,
  children,
}: {
  variant?: BadgeVariant;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
