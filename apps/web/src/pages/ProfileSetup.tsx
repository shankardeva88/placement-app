import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Department } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { completeStudentProfile } from "../lib/authActions";
import { AuthLayout } from "../components/AuthLayout";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const DEPARTMENTS: Department[] = [
  "CSE",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
  "IT",
  "AIML",
  "AIDS",
  "OTHER",
];

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { firebaseUser, student } = useAuth();

  const [rollNo, setRollNo] = useState(student?.rollNo ?? "");
  const [department, setDepartment] = useState<Department>(student?.department ?? "CSE");
  const [batchYear, setBatchYear] = useState(student?.batchYear ?? new Date().getFullYear());
  const [currentSemester, setCurrentSemester] = useState(student?.currentSemester ?? 1);
  const [cgpa, setCgpa] = useState(student?.cgpa ?? 0);
  const [activeBacklogs, setActiveBacklogs] = useState(student?.activeBacklogs ?? 0);
  const [skillsText, setSkillsText] = useState(student?.skills?.join(", ") ?? "");
  const [resumeUrl, setResumeUrl] = useState(student?.resumeUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setError(null);
    setSubmitting(true);
    try {
      await completeStudentProfile(firebaseUser.uid, {
        rollNo,
        department,
        batchYear,
        currentSemester,
        cgpa,
        activeBacklogs,
        skills: skillsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        resumeUrl: resumeUrl.trim(),
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-lg">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Complete your profile</h1>
        <p className="mb-6 text-sm text-slate-500">
          This information is used for eligibility checks on placement drives. CGPA and
          backlogs can be updated every semester from Academic Record later, and contact
          details / address / links / skills live under Student Info — no need to come
          back here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Roll number</label>
              <input
                type="text"
                required
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className={inputClass}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Graduating year</label>
              <input
                type="number"
                required
                value={batchYear}
                onChange={(e) => setBatchYear(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Current semester</label>
              <input
                type="number"
                min={1}
                max={8}
                required
                value={currentSemester}
                onChange={(e) => setCurrentSemester(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CGPA</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={10}
                required
                value={cgpa}
                onChange={(e) => setCgpa(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Active backlogs</label>
              <input
                type="number"
                min={0}
                required
                value={activeBacklogs}
                onChange={(e) => setActiveBacklogs(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Skills (comma separated)</label>
            <input
              type="text"
              placeholder="React, Python, SQL"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Resume link (Google Drive, shared as "Anyone with the link can view")
            </label>
            <input
              type="url"
              placeholder="https://drive.google.com/..."
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Saving…" : "Save and continue"}
          </Button>
        </form>
      </Card>
    </AuthLayout>
  );
}
