import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-sm shadow-brand-200 hover:shadow-md hover:shadow-brand-300 disabled:opacity-50",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50",
  ghost: "text-slate-600 hover:bg-slate-100 disabled:opacity-50",
  danger: "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:shadow-md hover:shadow-red-200 disabled:opacity-50",
};

export function Button({ variant = "primary", loading, disabled, className = "", children, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
