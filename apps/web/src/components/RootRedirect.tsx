import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function RootRedirect() {
  const { firebaseUser, appUser, student, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!firebaseUser) return <Navigate to="/login" replace />;
  if (!appUser) return <Navigate to="/login" replace />;

  if (appUser.role !== "student") {
    return <Navigate to="/staff/dashboard" replace />;
  }

  if (!student?.profileComplete) return <Navigate to="/profile-setup" replace />;
  return <Navigate to="/dashboard" replace />;
}
