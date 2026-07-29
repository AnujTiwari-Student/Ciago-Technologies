// Pure CSV helpers. Kept browser/node agnostic so the audit-export logic can
// be unit-tested without a DOM.

export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsvCell).join(","))].join("\n");
}
