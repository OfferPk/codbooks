/**
 * Escape LIKE metacharacters so user `q` is a literal substring match.
 * Pair with SQL `LIKE ? ESCAPE '\'` (backslash escape).
 */
export function escapeLikePattern(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}
