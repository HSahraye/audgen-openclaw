export type CsvRow = Record<string, string>;

export function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function csvEscape(value: unknown) {
  const stringValue = String(value ?? "");
  if (/[",\n\r]/.test(stringValue)) return `"${stringValue.replaceAll('"', '""')}"`;
  return stringValue;
}

export function toCsv(rows: CsvRow[], headers: string[]) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n");
}

export function normalizeHeader(header: string) {
  const withoutTrailingSymbols = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+$/g, "");
  return withoutTrailingSymbols.replace(/[^a-z0-9]+/g, " ").trim();
}

export function pick(row: CsvRow, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value?.trim()) return value.trim();
  }
  return "";
}
