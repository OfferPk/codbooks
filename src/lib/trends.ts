import { getDb } from "./db";

export interface CourierTrendMetrics {
  courier_code: string;
  courier_name: string;
  received_paisa: number;
  pending_paisa: number;
  expected_paisa: number;
  recovery_rate: number; // 0 to 100 percentage
  matched_count: number;
  unpaid_count: number;
  short_count: number;
  total_count: number;
}

export interface TrendTimeBucket {
  period_key: string;       // e.g. "2026-W42" or "2026-10"
  period_label: string;     // e.g. "W42 (Oct 12–18)" or "Oct 2026"
  received_paisa: number;
  pending_paisa: number;
  expected_paisa: number;
  recovery_rate: number;    // 0 to 100 percentage
  matched_count: number;
  unpaid_count: number;
  short_count: number;
  total_count: number;
  by_courier: Record<string, CourierTrendMetrics>;
}

export interface DashboardTrends {
  period_type: "weekly" | "monthly";
  buckets: TrendTimeBucket[];
  couriers: Array<{ code: string; name: string }>;
  totals: {
    received_paisa: number;
    pending_paisa: number;
    expected_paisa: number;
    recovery_rate: number;
    matched_count: number;
    unpaid_count: number;
    short_count: number;
    total_count: number;
  };
}

/**
 * Returns ISO week key "YYYY-Www" (e.g. "2026-W42") from an ISO date or date string.
 */
export function getIsoWeekKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
  const year = new Date(firstThursday).getUTCFullYear();
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

export function formatWeekLabel(weekKey: string): string {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekKey;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const mon1 = new Date(jan4.getTime() - jan4Day * 86400000);
  const weekMon = new Date(mon1.getTime() + (week - 1) * 7 * 86400000);
  const weekSun = new Date(weekMon.getTime() + 6 * 86400000);

  const m1 = weekMon.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const d1 = weekMon.getUTCDate();
  const m2 = weekSun.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const d2 = weekSun.getUTCDate();

  if (m1 === m2) {
    return `W${week} (${m1} ${d1}–${d2})`;
  }
  return `W${week} (${m1} ${d1}–${m2} ${d2})`;
}

/**
 * Returns month key "YYYY-MM" (e.g. "2026-10") from an ISO date or date string.
 */
export function getMonthKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const d = new Date(Date.UTC(year, month, 1));
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function computeRecoveryRate(received: number, expected: number): number {
  if (expected <= 0) {
    return received > 0 ? 100 : 0;
  }
  const pct = (received / expected) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

export interface GetTrendsOptions {
  period?: "weekly" | "monthly";
  limit?: number;
  shopId?: string | null;
}

export function getDashboardTrends(
  orgId: string,
  options: GetTrendsOptions = {}
): DashboardTrends {
  const periodType = options.period || "weekly";
  const limit = options.limit || (periodType === "weekly" ? 8 : 6);
  const db = getDb();

  let matchSql = `
    SELECT m.status, m.expected_paisa, m.remitted_paisa, m.short_paisa,
           m.reference_date,
           COALESCE(c.code, 'unknown') as courier_code,
           COALESCE(c.name, 'Other / Unknown') as courier_name
    FROM matches m
    LEFT JOIN couriers c ON c.id = m.courier_id
    WHERE m.org_id = ?
      AND m.match_run_id = (
        SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
      )
  `;
  const params: string[] = [orgId, orgId];

  if (options.shopId) {
    matchSql += ` AND (m.shop_id = ? OR m.shop_id IS NULL)`;
    params.push(options.shopId);
  }

  const rows = db.prepare(matchSql).all(...params) as Array<{
    status: string;
    expected_paisa: number;
    remitted_paisa: number;
    short_paisa: number;
    reference_date: string | null;
    courier_code: string;
    courier_name: string;
  }>;

  const courierCatalog = new Map<string, string>();
  const bucketMap = new Map<
    string,
    {
      received_paisa: number;
      pending_paisa: number;
      expected_paisa: number;
      matched_count: number;
      unpaid_count: number;
      short_count: number;
      total_count: number;
      by_courier: Map<
        string,
        {
          courier_code: string;
          courier_name: string;
          received_paisa: number;
          pending_paisa: number;
          expected_paisa: number;
          matched_count: number;
          unpaid_count: number;
          short_count: number;
          total_count: number;
        }
      >;
    }
  >();

  const totals = {
    received_paisa: 0,
    pending_paisa: 0,
    expected_paisa: 0,
    recovery_rate: 0,
    matched_count: 0,
    unpaid_count: 0,
    short_count: 0,
    total_count: 0,
  };

  const nowIso = new Date().toISOString();

  for (const r of rows) {
    const courierCode = r.courier_code.toLowerCase();
    const courierName = r.courier_name;
    courierCatalog.set(courierCode, courierName);

    // Compute period key
    const refDate = r.reference_date || nowIso;
    const periodKey =
      periodType === "weekly"
        ? getIsoWeekKey(refDate) || "undated"
        : getMonthKey(refDate) || "undated";

    let bucket = bucketMap.get(periodKey);
    if (!bucket) {
      bucket = {
        received_paisa: 0,
        pending_paisa: 0,
        expected_paisa: 0,
        matched_count: 0,
        unpaid_count: 0,
        short_count: 0,
        total_count: 0,
        by_courier: new Map(),
      };
      bucketMap.set(periodKey, bucket);
    }

    let courierData = bucket.by_courier.get(courierCode);
    if (!courierData) {
      courierData = {
        courier_code: courierCode,
        courier_name: courierName,
        received_paisa: 0,
        pending_paisa: 0,
        expected_paisa: 0,
        matched_count: 0,
        unpaid_count: 0,
        short_count: 0,
        total_count: 0,
      };
      bucket.by_courier.set(courierCode, courierData);
    }

    let rec = 0;
    let pend = 0;
    let exp = r.expected_paisa || 0;

    if (r.status === "matched") {
      rec = r.remitted_paisa > 0 ? r.remitted_paisa : exp;
      pend = 0;
      bucket.matched_count++;
      courierData.matched_count++;
      totals.matched_count++;
    } else if (r.status === "short") {
      rec = Math.max(0, r.remitted_paisa);
      pend = r.short_paisa > 0 ? r.short_paisa : Math.max(0, exp - rec);
      bucket.short_count++;
      courierData.short_count++;
      totals.short_count++;
    } else if (r.status === "unpaid") {
      rec = 0;
      pend = exp;
      bucket.unpaid_count++;
      courierData.unpaid_count++;
      totals.unpaid_count++;
    } else if (r.status === "double_paid") {
      rec = r.remitted_paisa > 0 ? r.remitted_paisa : exp;
      pend = 0;
      bucket.matched_count++;
      courierData.matched_count++;
      totals.matched_count++;
    } else if (r.status === "unmatched") {
      rec = r.remitted_paisa > 0 ? r.remitted_paisa : 0;
      pend = 0;
    }

    if (exp === 0 && (rec > 0 || pend > 0)) {
      exp = rec + pend;
    }

    bucket.received_paisa += rec;
    bucket.pending_paisa += pend;
    bucket.expected_paisa += exp;
    bucket.total_count++;

    courierData.received_paisa += rec;
    courierData.pending_paisa += pend;
    courierData.expected_paisa += exp;
    courierData.total_count++;

    totals.received_paisa += rec;
    totals.pending_paisa += pend;
    totals.expected_paisa += exp;
    totals.total_count++;
  }

  totals.recovery_rate = computeRecoveryRate(
    totals.received_paisa,
    totals.expected_paisa
  );

  // Sort keys chronologically
  const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => {
    if (a === "undated") return -1;
    if (b === "undated") return 1;
    return a.localeCompare(b);
  });

  // Keep up to limit buckets (most recent)
  const recentKeys =
    sortedKeys.length > limit ? sortedKeys.slice(sortedKeys.length - limit) : sortedKeys;

  const buckets: TrendTimeBucket[] = recentKeys.map((key) => {
    const b = bucketMap.get(key)!;
    const label =
      key === "undated"
        ? "Undated"
        : periodType === "weekly"
        ? formatWeekLabel(key)
        : formatMonthLabel(key);

    const byCourierObj: Record<string, CourierTrendMetrics> = {};
    for (const [code, cData] of b.by_courier.entries()) {
      byCourierObj[code] = {
        ...cData,
        recovery_rate: computeRecoveryRate(
          cData.received_paisa,
          cData.expected_paisa
        ),
      };
    }

    return {
      period_key: key,
      period_label: label,
      received_paisa: b.received_paisa,
      pending_paisa: b.pending_paisa,
      expected_paisa: b.expected_paisa,
      recovery_rate: computeRecoveryRate(b.received_paisa, b.expected_paisa),
      matched_count: b.matched_count,
      unpaid_count: b.unpaid_count,
      short_count: b.short_count,
      total_count: b.total_count,
      by_courier: byCourierObj,
    };
  });

  const couriers = Array.from(courierCatalog.entries()).map(([code, name]) => ({
    code,
    name,
  }));

  return {
    period_type: periodType,
    buckets,
    couriers,
    totals,
  };
}
