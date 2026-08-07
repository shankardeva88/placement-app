/** Parses pasted spreadsheet data — auto-detects comma (CSV export) vs tab
 * (pasting directly from Excel/Sheets) by checking the header line. Handles
 * quoted fields for both delimiters; doesn't handle quoted fields spanning
 * multiple lines (not a real concern for the roster data this feeds). */
export function parseDelimited(text: string): { headers: string[]; rows: string[][] } {
  const trimmed = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!trimmed) return { headers: [], rows: [] };

  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);
  const delimiter = lines[0].includes("\t") ? "\t" : ",";

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
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
        cells.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  const [headerLine, ...rowLines] = lines;
  return { headers: parseLine(headerLine), rows: rowLines.map(parseLine) };
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
