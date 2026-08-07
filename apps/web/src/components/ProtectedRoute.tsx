import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { logout } from "../lib/authActions";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const deactivated = !!appUser && appUser.isActive === false;

  // Signing out is a side effect, not something to trigger during render —
  // the effect fires once, then the redirect below takes over.
  useEffect(() => {
    if (deactivated) logout();
  }, [deactivated]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  if (deactivated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-slate-500">
        This account has been deactivated. Contact your admin if this is unexpected.
      </div>
    );
  }

  return <>{children}</>;
}
