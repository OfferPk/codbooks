import Papa from "papaparse";

/** Strip leading # comment lines from CSV text (fixtures use them). */
export function stripCsvComments(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("#");
    })
    .join("\n");
}

export function parseCsv(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const cleaned = stripCsvComments(text);
  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = result.meta.fields ?? [];
  const rows = (result.data || []).filter((r) =>
    Object.values(r).some((v) => String(v ?? "").trim() !== "")
  );
  return { headers, rows };
}

export function getField(
  row: Record<string, string>,
  ...aliases: string[]
): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find(
      (k) => k.toLowerCase().trim() === alias.toLowerCase().trim()
    );
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}
