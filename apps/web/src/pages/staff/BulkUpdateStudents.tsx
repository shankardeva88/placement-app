import { useMemo, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { useStudentsDirectory } from "../../lib/studentsDirectoryLib";
import { parseDelimited } from "../../lib/csv";
import { parseStudentUpdateRows, applyStudentUpdate } from "../../lib/bulkUpdateLib";
import type { ParsedUpdateRow } from "../../lib/bulkUpdateLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";

const CAN_BULK_UPDATE_ROLES = ["coordinator", "hod", "dean", "principal", "cpo", "admin"];

interface RowResult {
  row: ParsedUpdateRow;
  status: "updated" | "no-changes" | "not-found" | "failed";
  changedFields?: string[];
  message?: string;
}

export default function BulkUpdateStudents() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const canUpdate = !!appUser && CAN_BULK_UPDATE_ROLES.includes(appUser.role);
  const students = useStudentsDirectory(appUser);

  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ParsedUpdateRow[] | null>(null);
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const studentsByRollNo = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students ?? []) map.set(s.rollNo.trim().toLowerCase(), s);
    return map;
  }, [students]);

  function handleParse() {
    const { headers, rows } = parseDelimited(pasteText);
    if (headers.length === 0) {
      showToast("Paste some data first");
      return;
    }
    const { rows: parsedRows, unmappedHeaders: unmapped } = parseStudentUpdateRows(headers, rows);
    setParsed(parsedRows);
    setUnmappedHeaders(unmapped);
    setResults(null);
  }

  // A row with errors (no roll number) or with nothing to write can't be
  // applied — everything else gets attempted, including rows whose roll
  // number doesn't match anyone (reported as "not found" rather than
  // silently skipped, so a typo'd roll number surfaces instead of quietly
  // doing nothing).
  const applicableRows = (parsed ?? []).filter((r) => r.errors.length === 0 && Object.keys(r.values).length > 0);

  async function handleUpdate() {
    if (applicableRows.length === 0 || !students || !appUser) return;
    const actor = { role: appUser.role, department: "department" in appUser ? appUser.department : undefined };
    setUpdating(true);
    setProgress(0);
    const outcomes: RowResult[] = [];
    for (const row of applicableRows) {
      const student = studentsByRollNo.get(row.rollNo.trim().toLowerCase());
      if (!student) {
        outcomes.push({ row, status: "not-found" });
      } else {
        try {
          const { changedFields, skippedFields } = await applyStudentUpdate(student, row.values, actor);
          const message = skippedFields.length > 0 ? `Skipped: ${skippedFields.join(", ")} (needs institution-level access)` : undefined;
          outcomes.push(
            changedFields.length > 0
              ? { row, status: "updated", changedFields, message }
              : { row, status: "no-changes", message }
          );
        } catch (err) {
          outcomes.push({ row, status: "failed", message: err instanceof Error ? err.message : "Update failed" });
        }
      }
      setProgress((p) => p + 1);
    }
    setResults(outcomes);
    setUpdating(false);
    const updatedCount = outcomes.filter((o) => o.status === "updated").length;
    const notFoundCount = outcomes.filter((o) => o.status === "not-found").length;
    const failedCount = outcomes.filter((o) => o.status === "failed").length;
    showToast(`${updatedCount} updated, ${notFoundCount} not found, ${failedCount} failed`);
  }

  if (!canUpdate) {
    return (
      <div>
        <PageHeader
          title="Bulk Update Students"
          subtitle="Fill in pending fields for existing students from a spreadsheet."
          icon={RefreshCw}
          gradient="from-sky-500 to-blue-600"
        />
        <Card className="text-sm text-slate-600">Only coordinator, HOD, and institution roles can bulk-update students.</Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bulk Update Students"
        subtitle="Matches rows to existing students by roll number and fills in whichever columns you provide — blank cells are left untouched, so this is safe to use for filling in pending fields without overwriting what's already on file."
        icon={RefreshCw}
        gradient="from-sky-500 to-blue-600"
      />

      <Card className="mb-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">1. Paste data</h3>
        <p className="mb-3 text-xs text-slate-500">
          Include a "Roll No" column to match against, plus any subset of: name, email, department, batchYear,
          currentSemester, tenthPercentage, tenthSchool, tenthYearOfPassing, twelfthPercentage, twelfthSchool,
          twelfthYearOfPassing, entranceType (EAMCET/ECET), entranceRank, studentPhone, personalEmail, parentName,
          parentPhone, address, state, dateOfBirth, gender, photoUrl. Leave a cell blank to leave that field untouched
          for that student.
        </p>
        <textarea
          rows={8}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Roll No\tstudentPhone\tparentPhone\taddress\t..."}
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
          <p className="mb-3 text-xs text-slate-500">
            {applicableRows.length} of {parsed.length} row(s) have a roll number and at least one field to update.
          </p>

          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                  <th className="py-1.5 pr-3">Roll No</th>
                  <th className="py-1.5 pr-3">Matched student</th>
                  <th className="py-1.5 pr-3">Fields to update</th>
                  <th className="py-1.5 pr-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.map((row) => {
                  const student = studentsByRollNo.get(row.rollNo.trim().toLowerCase());
                  const fieldNames = Object.keys(row.values);
                  return (
                    <tr key={row.rowIndex}>
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{row.rollNo || "—"}</td>
                      <td className="py-1.5 pr-3 text-slate-600">
                        {students === null ? "…" : student ? student.name : "Not found in your scope"}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-600">{fieldNames.join(", ") || "—"}</td>
                      <td className="py-1.5 pr-3">
                        {row.errors.length > 0 ? (
                          <Badge variant="danger">{row.errors.join("; ")}</Badge>
                        ) : fieldNames.length === 0 ? (
                          <Badge variant="neutral">Nothing to update</Badge>
                        ) : students !== null && !student ? (
                          <Badge variant="warning">Roll number not found</Badge>
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

          <Button className="mt-4" onClick={handleUpdate} loading={updating} disabled={applicableRows.length === 0}>
            Update {applicableRows.length} student(s)
          </Button>
          {updating && (
            <p className="mt-2 text-xs text-slate-500">
              {progress} of {applicableRows.length} done…
            </p>
          )}
        </Card>
      )}

      {results && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">3. Results</h3>
          <p className="mb-3 flex items-center gap-1.5 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            {results.filter((r) => r.status === "updated").length} updated,{" "}
            {results.filter((r) => r.status === "no-changes").length} already matched (no change),{" "}
            {results.filter((r) => r.status === "not-found").length} not found,{" "}
            {results.filter((r) => r.status === "failed").length} failed
          </p>
          {results.filter((r) => r.status === "not-found" || r.status === "failed").length > 0 && (
            <ul className="mb-2 space-y-1 text-xs text-red-600">
              {results
                .filter((r) => r.status === "not-found" || r.status === "failed")
                .map((r) => (
                  <li key={r.row.rowIndex}>
                    {r.row.rollNo || `Row ${r.row.rowIndex}`} — {r.status === "not-found" ? "roll number not found" : r.message}
                  </li>
                ))}
            </ul>
          )}
          {results.filter((r) => (r.status === "updated" || r.status === "no-changes") && r.message).length > 0 && (
            <ul className="space-y-1 text-xs text-amber-700">
              {results
                .filter((r) => (r.status === "updated" || r.status === "no-changes") && r.message)
                .map((r) => (
                  <li key={r.row.rowIndex}>
                    {r.row.rollNo} — {r.message}
                  </li>
                ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
