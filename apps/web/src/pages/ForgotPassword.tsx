import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../lib/passwordActions";
import { AuthLayout } from "../components/AuthLayout";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      // auth/user-not-found is treated the same as success — showing a
      // distinct error for it would let anyone probe which emails have
      // accounts. Only genuinely different failures (bad email format,
      // network) get their own message.
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found") {
        setSent(true);
      } else if (code === "auth/invalid-email") {
        setError("That doesn't look like a valid email address.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
          <p className="text-sm text-slate-500">We'll email you a link to set a new one.</p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              If an account exists for <span className="font-medium text-slate-800">{email}</span>, a reset link is
              on its way. Check your inbox (and spam folder).
            </p>
            <Link to="/login" className="inline-block text-sm font-medium text-brand-700 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>

            <p className="text-center text-sm text-slate-500">
              <Link to="/login" className="font-medium text-brand-700 hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </Card>
    </AuthLayout>
  );
}
