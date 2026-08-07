import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { selfCheckIn } from "../lib/checkInLib";
import { Card } from "../components/ui/Card";

export default function CheckIn() {
  const { sessionId, token } = useParams<{ sessionId: string; token: string }>();
  const { firebaseUser, student, loading } = useAuth();
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");

  useEffect(() => {
    if (loading || !firebaseUser || !student || !sessionId || !token) return;
    selfCheckIn(sessionId, token, firebaseUser.uid, student.department)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [loading, firebaseUser, student, sessionId, token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm text-center">
        {loading || (firebaseUser && status === "checking") ? (
          <p className="text-sm text-slate-500">Checking in…</p>
        ) : !firebaseUser ? (
          <div>
            <p className="mb-3 text-sm text-slate-700">Log in first, then reopen this link.</p>
            <Link to="/login" className="text-sm font-medium text-brand-700 underline">
              Go to login
            </Link>
          </div>
        ) : status === "success" ? (
          <div>
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-medium text-slate-900">Checked in!</p>
          </div>
        ) : (
          <div>
            <XCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />
            <p className="font-medium text-slate-900">Check-in failed</p>
            <p className="mt-1 text-sm text-slate-500">
              The code may be wrong, expired, or you've already checked in.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
