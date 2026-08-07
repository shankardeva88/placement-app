import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { StaffShell } from "./StaffShell";

function RequireStaffRole({ children }: { children: ReactNode }) {
  const { appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (appUser && appUser.role === "student") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function StaffLayoutRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireStaffRole>
        <StaffShell>{children}</StaffShell>
      </RequireStaffRole>
    </ProtectedRoute>
  );
}
