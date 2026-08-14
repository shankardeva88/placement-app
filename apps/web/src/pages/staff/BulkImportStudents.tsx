import { useState } from "react";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { parseDelimited } from "../../lib/csv";
import { parseStudentRows, createBulkStudent } from "../../lib/bulkImportLib";
import type { ParsedStudentRow } from "../../lib/bulkImportLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";

const CAN_BULK_IMPORT_ROLES = ["coordinator", "hod", "dean", "principal", "cpo", "admin"];

interface ImportOutcome {
  row: ParsedStudentRow;
  result: "created" | "alreadyExists" | "failed";
  message?: string;
}

export default function BulkImportStudents() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const canImport = !!appUser && CAN_BULK_IMPORT_ROLES.includes(appUser.role);
  const myDept = appUser && "department" in appUser ? appUser.department : undefined;

  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ParsedStudentRow[] | null>(null);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);

  function handleParse() {
    const { headers, rows } = parseDelimited(pasteText);
    if (headers.length === 0) {
      showToast("Paste some data first");
      return;
    }
    const { rows: parsedRows, unmappedHeaders: unmapped } = parseStudentRows(headers, rows);
    setParsed(parsedRows);
    setUnmappedHeaders(unmapped);
    setOutcomes(null);
  }

  const rowsWithWrongDept = myDept ? (parsed ?? []).filter((r) => r.department !== myDept) : [];
  const importableRows = (parsed ?? []).filter((r) => r.errors.length === 0 && (!myDept || r.department === myDept));

  async function handleImport() {
    if (importableRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    const results: ImportOutcome[] = [];
    for (const row of importableRows) {
      const res = await createBulkStudent(row);
      if ("uid" in res) results.push({ row, result: "created" });
      else if ("alreadyExists" in res) results.push({ row, result: "alreadyExists" });
      else results.push({ row, result: "failed", message: res.error });
      setProgress((p) => p + 1);
      // Firebase's identitytoolkit signup endpoint rate-limits rapid-fire
      // account creation from one client — hammering it with no delay trips
      // "auth/too-many-requests" partway through a large batch. Space out
      // requests, and stop immediately (rather than burning through the rest
      // of the rows while blocked) so the remaining rows stay untouched and
      // re-importable once the block clears.
      if ("error" in res && res.error.includes("auth/too-many-requests")) {
        showToast("Firebase is rate-limiting account creation — stopped early. Wait 15–30 min, then re-import the remaining rows.");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    setOutcomes(results);
    setImporting(false);
    const createdCount = results.filter((r) => r.result === "created").length;
    const alreadyExistsCount = results.filter((r) => r.result === "alreadyExists").length;
    showToast(`${createdCount} created, ${alreadyExistsCount} already existed, ${results.length - createdCount - alreadyExistsCount} failed`);
  }

  if (!canImport) {
    return (
      <div>
        <PageHeader
          title="Bulk Import Students"
          subtitle="Import a roster from a spreadsheet."
          icon={Upload}
          gradient="from-violet-500 to-purple-600"
        />
        <Card className="text-sm text-slate-600">Only coordinator, HOD, and institution roles can bulk-import students.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bulk Import Students"
        subtitle="Paste roster data — roll number, name, dept, CGPA, email, and batch are required; gender, backlogs, phone, DOB, 10th/12th, personal email, and resume link are optional and can be filled in by the student later."
        icon={Upload}
        gradient="from-violet-500 to-purple-600"
      />

      <Card className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">1. Paste data</h3>
        <p className="mb-3 text-xs text-slate-500">
          Copy the header row and student rows from your sheet and paste below — works with a tab-separated Excel/Sheets
          paste or a comma-separated CSV export.
        </p>
        <textarea
          rows={8}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Roll Number\tFull Name(As per Aadhar)\tGender\tBranch\t..."}
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button className="mt-3" onClick={handleParse}>
          Parse
        </Button>
      </Card>

      {parsed !== null && (
        <Card className="mb-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-900">2. Review ({parsed.length} row(s))</h3>

          {unmappedHeaders.length > 0 && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Columns not recognized, ignored: {unmappedHeaders.join(", ")}
            </p>
          )}
          {rowsWithWrongDept.length > 0 && (
            <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {rowsWithWrongDept.length} row(s) are for a different department than yours ({myDept}) — those will be
              skipped (you can only create accounts for your own department).
            </p>
          )}
          <p className="mb-3 text-xs text-slate-500">
            {importableRows.length} of {parsed.length} row(s) will be imported. Each account's temporary password is
            set to that student's roll number — they can change it after logging in.
          </p>

          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Roll No</th>
                  <th className="py-1.5 pr-3">Name</th>
                  <th className="py-1.5 pr-3">Dept</th>
                  <th className="py-1.5 pr-3">Batch</th>
                  <th className="py-1.5 pr-3">CGPA</th>
                  <th className="py-1.5 pr-3">Email</th>
                  <th className="py-1.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.map((row) => {
                  const wrongDept = !!myDept && row.department !== myDept;
                  return (
                    <tr key={row.rowIndex}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{row.rollNo || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.name || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.department}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.batchYear || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.cgpa}</td>
                      <td className="py-1.5 pr-3 text-slate-600">{row.email || "—"}</td>
                      <td className="py-1.5 pr-3">
                        {row.errors.length > 0 ? (
                          <Badge variant="danger">{row.errors.join("; ")}</Badge>
                        ) : wrongDept ? (
                          <Badge variant="neutral">Different dept — skipped</Badge>
                        ) : row.warnings.length > 0 ? (
                          <Badge variant="warning">{row.warnings.join("; ")}</Badge>
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

          <Button className="mt-4" onClick={handleImport} loading={importing} disabled={importableRows.length === 0}>
            Import {importableRows.length} student(s)
          </Button>
          {importing && (
            <p className="mt-2 text-xs text-slate-500">
              {progress} of {importableRows.length} done…
            </p>
          )}
        </Card>
      )}

      {outcomes && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">3. Results</h3>
          <p className="mb-3 flex items-center gap-1.5 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {outcomes.filter((o) => o.result === "created").length} created,{" "}
            {outcomes.filter((o) => o.result === "alreadyExists").length} already imported (skipped),{" "}
            {outcomes.filter((o) => o.result === "failed").length} failed
          </p>
          {outcomes.filter((o) => o.result === "failed").length > 0 && (
            <ul className="space-y-1 text-xs text-red-600">
              {outcomes
                .filter((o) => o.result === "failed")
                .map((o) => (
                  <li key={o.row.rowIndex}>
                    {o.row.rollNo || `Row ${o.row.rowIndex}`} — {o.message}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
