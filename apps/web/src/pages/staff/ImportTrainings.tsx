import { useMemo, useState } from "react";
import { GraduationCap, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { parseDelimited } from "../../lib/csv";
import { parseTrainingRows, importTrainings } from "../../lib/trainingImportLib";
import type { ParsedTrainingRow, TrainingImportOutcome } from "../../lib/trainingImportLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";

const CAN_IMPORT_ROLES = ["coordinator", "hod", "dean", "principal", "cpo", "admin"];

const RESULT_BADGE: Record<TrainingImportOutcome["result"], { variant: "success" | "neutral" | "warning" | "danger"; label: string }> = {
  updated: { variant: "success", label: "Updated" },
  not_found: { variant: "warning", label: "Roll no not found in your students" },
  no_trainings: { variant: "neutral", label: "No training columns filled — skipped" },
  failed: { variant: "danger", label: "Failed" },
};

export default function ImportTrainings() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const students = useStudentsDirectory(appUser);
  const canImport = !!appUser && CAN_IMPORT_ROLES.includes(appUser.role);

  const [pasteText, setPasteText] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedTrainingRow[] | null>(null);
  const [trainingNames, setTrainingNames] = useState<string[]>([]);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [outcomes, setOutcomes] = useState<TrainingImportOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rosterByRollNo = useMemo(() => {
    const map: Record<string, Student> = {};
    for (const s of students ?? []) map[s.rollNo.toUpperCase()] = s;
    return map;
  }, [students]);

  function handleParse() {
    const { headers, rows } = parseDelimited(pasteText);
    if (headers.length === 0) {
      showToast("Paste some data first");
      return;
    }
    const result = parseTrainingRows(headers, rows);
    setParsedRows(result.rows);
    setTrainingNames(result.trainingNames);
    setUnmappedHeaders(result.unmappedHeaders);
    setOutcomes(null);
  }

  async function handleImport() {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true);
    setError(null);
    setProgress(0);
    setProgressTotal(0);
    try {
      const results = await importTrainings(parsedRows, rosterByRollNo, (done, total) => {
        setProgress(done);
        setProgressTotal(total);
      });
      setOutcomes(results);
      const updated = results.filter((r) => r.result === "updated").length;
      const failed = results.filter((r) => r.result === "failed").length;
      showToast(failed > 0 ? `${updated} updated, ${failed} failed — see results below` : `${updated} of ${parsedRows.length} student(s) updated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (!canImport) {
    return (
      <div>
        <PageHeader
          title="Import Trainings"
          subtitle="Upload completed-training data from a tracking sheet."
          icon={GraduationCap}
          gradient="from-pink-500 to-rose-600"
        />
        <Card className="text-sm text-slate-600">Only coordinator, HOD, and institution roles can import trainings.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Import Trainings"
        subtitle="Paste a training tracking sheet — Reg.No plus one column per training, e.g. Training1(Infosys)."
        icon={GraduationCap}
        gradient="from-pink-500 to-rose-600"
      />

      <Card className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">1. Paste data</h3>
        <p className="mb-3 text-xs text-slate-500">
          Copy the header row and student rows from your sheet and paste below — works with a tab-separated
          Excel/Sheets paste or a comma-separated CSV export. Matches students by Reg.No within your own department;
          a non-empty training cell means that training is complete. Re-uploading doesn't erase trainings recorded
          from an earlier upload.
        </p>
        <textarea
          rows={8}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Reg.No\tName\tBranch\tTraining1(Infosys)\tTraining2(BeingZero)\t..."}
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button className="mt-3" onClick={handleParse}>
          Parse
        </Button>
      </Card>

      {parsedRows !== null && (
        <Card className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">2. Review ({parsedRows.length} row(s))</h3>

          {unmappedHeaders.length > 0 && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Columns not recognized, ignored: {unmappedHeaders.join(", ")}
            </p>
          )}
          {trainingNames.length > 0 && (
            <p className="mb-3 text-xs text-slate-500">Trainings found in this sheet: {trainingNames.join(", ")}</p>
          )}

          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Roll No</th>
                  <th className="py-1.5 pr-3">Name</th>
                  <th className="py-1.5 pr-3">Trainings</th>
                  <th className="py-1.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row) => {
                  const outcome = outcomes?.find((o) => o.row.rowIndex === row.rowIndex);
                  const found = !!rosterByRollNo[row.rollNo.toUpperCase()];
                  return (
                    <tr key={row.rowIndex}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{row.rollNo}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.name || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{Object.keys(row.trainings).join(", ") || "—"}</td>
                      <td className="py-1.5 pr-3">
                        {outcome ? (
                          <Badge variant={RESULT_BADGE[outcome.result].variant}>{RESULT_BADGE[outcome.result].label}</Badge>
                        ) : !found ? (
                          <Badge variant="warning">Roll no not found in your students</Badge>
                        ) : Object.keys(row.trainings).length === 0 ? (
                          <Badge variant="neutral">No training columns filled</Badge>
                        ) : (
                          <Badge variant="success">Ready</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button className="mt-4" onClick={handleImport} loading={importing} disabled={parsedRows.length === 0}>
            Import {parsedRows.length} row(s)
          </Button>
          {importing && progressTotal > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {progress} of {progressTotal} done…
            </p>
          )}
          {error && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </Card>
      )}

      {outcomes && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">3. Results</h3>
          <p className="flex items-center gap-1.5 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {outcomes.filter((o) => o.result === "updated").length} updated,{" "}
            {outcomes.filter((o) => o.result === "not_found").length} not found,{" "}
            {outcomes.filter((o) => o.result === "no_trainings").length} skipped,{" "}
            {outcomes.filter((o) => o.result === "failed").length} failed
          </p>
          {outcomes.filter((o) => o.result === "failed").length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-600">
              {outcomes
                .filter((o) => o.result === "failed")
                .map((o) => (
                  <li key={o.row.rowIndex}>
                    {o.row.rollNo} — {o.message}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
