/** Normalize AWB / CN / order id for matching. */

export function normalizeKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/^CN[:\s-]*/i, "")
    .replace(/^AWB[:\s-]*/i, "");
}

export function normalizeAwb(raw: string | null | undefined): string {
  return normalizeKey(raw);
}

export function normalizeCn(raw: string | null | undefined): string {
  return normalizeKey(raw);
}

export function normalizeOrderId(raw: string | null | undefined): string {
  return normalizeKey(raw);
}
