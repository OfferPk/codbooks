export type AgingBucketKey = "<7" | "7-14" | ">14";

/** Days between settlement/order reference date and asOf (inclusive calendar days). */
export function daysBetween(fromIso: string, asOf: Date = new Date()): number {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return 0;
  const ms = asOf.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function agingBucket(days: number): AgingBucketKey {
  if (days < 7) return "<7";
  if (days <= 14) return "7-14";
  return ">14";
}

export function agingBucketFromDate(
  fromIso: string | null | undefined,
  asOf: Date = new Date()
): AgingBucketKey | null {
  if (!fromIso) return null;
  return agingBucket(daysBetween(fromIso, asOf));
}
