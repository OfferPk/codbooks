/** Money helpers — all ledger amounts are integer paisa (PKR * 100). */

export function pkrToPaisa(pkr: number | string | null | undefined): number {
  if (pkr === null || pkr === undefined || pkr === "") return 0;
  const n = typeof pkr === "string" ? parseFloat(pkr.replace(/,/g, "").trim()) : pkr;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paisaToPkr(paisa: number): number {
  return paisa / 100;
}

export function formatPkr(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${sign}PKR ${whole.toLocaleString("en-PK")}.${frac.toString().padStart(2, "0")}`;
}

export function withinTolerance(
  expected: number,
  remitted: number,
  tolerancePaisa = 100
): boolean {
  return Math.abs(expected - remitted) <= tolerancePaisa;
}
