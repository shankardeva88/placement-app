/** Parses pasted spreadsheet data — auto-detects comma (CSV export) vs tab
 * (pasting directly from Excel/Sheets) by checking the header line. Handles
 * quoted fields for both delimiters, including a quoted field that spans
 * multiple physical lines (e.g. a multi-line address pasted from Excel/
 * Sheets) — this used to split the input into lines first and parse each
 * one independently, so a literal newline inside a quoted cell broke that
 * one logical row into two: whatever came before the newline got cut off
 * mid-field (silently truncating that cell's value), and whatever came
 * after became its own garbled, unmatched row. Scanning the whole input in
 * one pass instead means a newline only ends a row when it's outside an
 * open quote. */
export function parseDelimited(text: string): { headers: string[]; rows: string[][] } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) return { headers: [], rows: [] };

  const firstLineEnd = normalized.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? normalized : normalized.slice(0, firstLineEnd);
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  function endField() {
    row.push(current.trim());
    current = "";
  }
  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else {
      current += ch;
    }
  }
  if (current !== "" || row.length > 0) endRow();

  const nonEmptyRows = rows.filter((r) => r.some((c) => c.length > 0));
  if (nonEmptyRows.length === 0) return { headers: [], rows: [] };
  const [headerLine, ...rowLines] = nonEmptyRows;
  return { headers: headerLine, rows: rowLines };
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = rows.map((row) => row.map(escape).join(","));
  return [headers.map(escape).join(","), ...lines].join("\n");
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
