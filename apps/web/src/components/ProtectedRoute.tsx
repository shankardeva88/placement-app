import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { logout } from "../lib/authActions";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const deactivated = !!appUser && appUser.isActive === false;
  // Authenticated, but no /users profile exists for this account anymore —
  // e.g. it was deleted from the database while the old login still works
  // (removeStudent only removes the RTDB profile, not the underlying
  // Firebase Auth account, which needs Admin SDK access this app doesn't
  // have — see the matching comment in AuthContext.tsx).
  const noProfile = !loading && !!firebaseUser && !appUser;

  // Signing out is a side effect, not something to trigger during render —
  // the effect fires once, then the redirect below takes over.
  useEffect(() => {
    if (deactivated || noProfile) logout();
  }, [deactivated, noProfile]);

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

  // Authenticated, but no /users profile exists for this account anymore
  // (e.g. it was deleted from the database while the old login still
  // works — see the matching comment in AuthContext.tsx) — treat the same
  // as not being logged in rather than rendering a protected page with a
  // null appUser underneath it.
  if (!appUser) {
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
