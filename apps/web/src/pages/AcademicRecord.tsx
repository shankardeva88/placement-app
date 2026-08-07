import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, GraduationCap } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { updateAcademicRecord } from "../lib/academicActions";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const MAX_SEMESTERS = 12;

export default function AcademicRecord() {
  const { firebaseUser, student } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [semesterCount, setSemesterCount] = useState(student?.currentSemester ?? 1);
  const [sgpaMap, setSgpaMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (let i = 1; i <= (student?.currentSemester ?? 1); i++) {
      const key = `sem${i}`;
      const val = student?.semesterWiseSgpa?.[key];
      initial[key] = val != null ? String(val) : "";
    }
    return initial;
  });
  const [activeBacklogs, setActiveBacklogs] = useState(student?.activeBacklogs ?? 0);
  const [cgpa, setCgpa] = useState(student?.cgpa ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedAverage = useMemo(() => {
    const values = Object.values(sgpaMap)
      .map((v) => parseFloat(v))
      .filter((v) => !Number.isNaN(v));
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }, [sgpaMap]);

  function addSemester() {
    if (semesterCount >= MAX_SEMESTERS) return;
    const next = semesterCount + 1;
    setSemesterCount(next);
    setSgpaMap((prev) => ({ ...prev, [`sem${next}`]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setError(null);
    setSubmitting(true);
    try {
      const semesterWiseSgpa: Record<string, number> = {};
      for (const [key, val] of Object.entries(sgpaMap)) {
        const num = parseFloat(val);
        if (!Number.isNaN(num)) semesterWiseSgpa[key] = num;
      }
      await updateAcademicRecord(firebaseUser.uid, {
        semesterWiseSgpa,
        cgpa,
        activeBacklogs,
        currentSemester: semesterCount,
      });
      showToast("Academic record updated");
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Academic Record"
        subtitle="Update this each semester — takes under a minute."
        icon={GraduationCap}
        gradient="from-violet-500 to-purple-600"
      />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: semesterCount }, (_, i) => i + 1).map((sem) => {
              const key = `sem${sem}`;
              return (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Semester {sem}</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={10}
                    placeholder="SGPA"
                    value={sgpaMap[key] ?? ""}
                    onChange={(e) => setSgpaMap((prev) => ({ ...prev, [key]: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              );
            })}
          </div>

          {semesterCount < MAX_SEMESTERS && (
            <button
              type="button"
              onClick={addSemester}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-4 w-4" />
              I've started semester {semesterCount + 1}
            </button>
          )}

          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Active backlogs
              </label>
              <input
                type="number"
                min={0}
                value={activeBacklogs}
                onChange={(e) => setActiveBacklogs(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
                <span>CGPA</span>
                {computedAverage != null && computedAverage !== cgpa && (
                  <button
                    type="button"
                    onClick={() => setCgpa(computedAverage)}
                    className="text-xs font-normal text-brand-700 hover:underline"
                  >
                    Use average ({computedAverage})
                  </button>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={10}
                value={cgpa}
                onChange={(e) => setCgpa(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Save academic record"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
