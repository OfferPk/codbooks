import { getDb, audit } from "./db";
import { agingBucketFromDate } from "./aging";
import { TOLERANCE_PAISA, type MatchStatus } from "./types";
import { normalizeAwb, normalizeCn, normalizeOrderId } from "./normalize";

export interface MatchSummary {
  matched: number;
  short: number;
  unpaid: number;
  unmatched: number;
  double_paid: number;
  total: number;
}

interface OrderRow {
  id: string;
  external_order_id: string | null;
  awb: string | null;
  cn: string | null;
  order_amount_paisa: number;
  ordered_at: string | null;
  status: string | null;
  courier_id: string | null;
  shop_id: string | null;
}

interface SettlementRow {
  id: string;
  courier_id: string;
  awb: string | null;
  cn: string | null;
  order_ref: string | null;
  remitted_paisa: number;
  settled_at: string | null;
  delivery_status: string | null;
  shop_id: string | null;
}


function classifyAmounts(
  expected: number,
  remitted: number,
  tolerance = TOLERANCE_PAISA
): MatchStatus {
  if (remitted < 0) {
    // sentinel from PostEx API settle=true without amount → treat as full match
    return "matched";
  }
  const short = expected - remitted;
  if (Math.abs(short) <= tolerance) return "matched";
  if (remitted === 0 && expected > tolerance) return "unpaid";
  if (short > tolerance) return "short";
  // remitted > expected + tolerance — still matched but note overpay as matched
  return "matched";
}

function resolveRemitted(expected: number, remitted: number): number {
  if (remitted === -1) return expected;
  return remitted;
}

export function runMatch(
  orgId: string,
  userId: string,
  shopId?: string | null
): {
  matchRunId: string;
  summary: MatchSummary;
} {
  const db = getDb();
  const now = new Date().toISOString();
  const matchRunId = crypto.randomUUID();

  const orders = shopId
    ? (db
        .prepare(
          `SELECT id, external_order_id, awb, cn, order_amount_paisa, ordered_at, status, courier_id, shop_id
           FROM orders WHERE org_id = ? AND (shop_id = ? OR shop_id IS NULL)`
        )
        .all(orgId, shopId) as OrderRow[])
    : (db
        .prepare(
          `SELECT id, external_order_id, awb, cn, order_amount_paisa, ordered_at, status, courier_id, shop_id
           FROM orders WHERE org_id = ?`
        )
        .all(orgId) as OrderRow[]);

  const settlements = shopId
    ? (db
        .prepare(
          `SELECT id, courier_id, awb, cn, order_ref, remitted_paisa, settled_at, delivery_status, shop_id
           FROM settlement_lines WHERE org_id = ? AND (shop_id = ? OR shop_id IS NULL)`
        )
        .all(orgId, shopId) as SettlementRow[])
    : (db
        .prepare(
          `SELECT id, courier_id, awb, cn, order_ref, remitted_paisa, settled_at, delivery_status, shop_id
           FROM settlement_lines WHERE org_id = ?`
        )
        .all(orgId) as SettlementRow[]);

  // Ensure shipments exist for each order
  const ensureShip = db.prepare(
    `INSERT INTO shipments
      (id, org_id, shop_id, order_id, awb, cn, courier_id, status, cod_amount_paisa, shipped_at, delivered_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const findShipByOrder = db.prepare(
    `SELECT id FROM shipments WHERE org_id = ? AND order_id = ?`
  );

  const orderShipments = new Map<string, string>();
  for (const o of orders) {
    const existing = findShipByOrder.get(orgId, o.id) as
      | { id: string }
      | undefined;
    if (existing) {
      if (o.courier_id) {
        db.prepare(
          `UPDATE shipments SET courier_id = COALESCE(courier_id, ?) WHERE id = ?`
        ).run(o.courier_id, existing.id);
      }
      orderShipments.set(o.id, existing.id);
      continue;
    }
    const sid = crypto.randomUUID();
    ensureShip.run(
      sid,
      orgId,
      o.shop_id || shopId || null,
      o.id,
      o.awb,
      o.cn,
      o.courier_id,
      o.status,
      o.order_amount_paisa,
      o.ordered_at,
      null,
      now
    );
    orderShipments.set(o.id, sid);
  }

  // Index orders
  const byAwb = new Map<string, OrderRow[]>();
  const byCn = new Map<string, OrderRow[]>();
  const byOrderId = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const awb = normalizeAwb(o.awb);
    const cn = normalizeCn(o.cn);
    const oid = normalizeOrderId(o.external_order_id);
    if (awb) {
      if (!byAwb.has(awb)) byAwb.set(awb, []);
      byAwb.get(awb)!.push(o);
    }
    if (cn) {
      if (!byCn.has(cn)) byCn.set(cn, []);
      byCn.get(cn)!.push(o);
    }
    if (oid) {
      if (!byOrderId.has(oid)) byOrderId.set(oid, []);
      byOrderId.get(oid)!.push(o);
    }
  }

  // Detect double-paid settlements (same AWB/CN appearing 2+)
  const settKeyCount = new Map<string, number>();
  for (const s of settlements) {
    const key = normalizeAwb(s.awb) || normalizeCn(s.cn) || normalizeOrderId(s.order_ref);
    if (!key) continue;
    settKeyCount.set(key, (settKeyCount.get(key) || 0) + 1);
  }
  const doubleKeys = new Set(
    [...settKeyCount.entries()].filter(([, c]) => c > 1).map(([k]) => k)
  );

  const matchedOrderIds = new Set<string>();
  const matchedSettlementIds = new Set<string>();
  const summary: MatchSummary = {
    matched: 0,
    short: 0,
    unpaid: 0,
    unmatched: 0,
    double_paid: 0,
    total: 0,
  };

  const insertMatch = db.prepare(
    `INSERT INTO matches
      (id, match_run_id, org_id, shop_id, shipment_id, settlement_line_id, order_id,
       status, expected_paisa, remitted_paisa, short_paisa, courier_id, awb, cn, notes, reference_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.prepare(
    `INSERT INTO match_runs (id, org_id, shop_id, created_at, created_by, summary_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(matchRunId, orgId, shopId || null, now, userId, "{}");

  const tx = db.transaction(() => {
    // Clear prior matches for shop or entire org (latest run is source of truth for MVP)
    if (shopId) {
      db.prepare(
        "DELETE FROM matches WHERE org_id = ? AND (shop_id = ? OR shop_id IS NULL)"
      ).run(orgId, shopId);
    } else {
      db.prepare("DELETE FROM matches WHERE org_id = ?").run(orgId);
    }

    for (const s of settlements) {
      const awb = normalizeAwb(s.awb);
      const cn = normalizeCn(s.cn);
      const oref = normalizeOrderId(s.order_ref);
      const key = awb || cn || oref;

      let order: OrderRow | undefined;
      let matchVia = "";
      if (awb && byAwb.has(awb)) {
        order = byAwb.get(awb)![0];
        matchVia = "awb";
      } else if (cn && byCn.has(cn)) {
        order = byCn.get(cn)![0];
        matchVia = "cn";
      } else if (oref && byOrderId.has(oref)) {
        order = byOrderId.get(oref)![0];
        matchVia = "order_id";
      }

      const matchShopId = order?.shop_id || s.shop_id || shopId || null;

      if (key && doubleKeys.has(key) && order) {
        const remitted = resolveRemitted(order.order_amount_paisa, s.remitted_paisa);
        insertMatch.run(
          crypto.randomUUID(),
          matchRunId,
          orgId,
          matchShopId,
          orderShipments.get(order.id) ?? null,
          s.id,
          order.id,
          "double_paid",
          order.order_amount_paisa,
          remitted,
          Math.max(0, order.order_amount_paisa - remitted),
          s.courier_id,
          s.awb,
          s.cn,
          `Double settlement on ${key}; matched via ${matchVia}`,
          s.settled_at || order.ordered_at
        );
        matchedOrderIds.add(order.id);
        matchedSettlementIds.add(s.id);
        summary.double_paid++;
        summary.total++;
        continue;
      }

      if (!order) {
        // Unmatched settlement
        const remitted = s.remitted_paisa === -1 ? 0 : s.remitted_paisa;
        insertMatch.run(
          crypto.randomUUID(),
          matchRunId,
          orgId,
          matchShopId,
          null,
          s.id,
          null,
          "unmatched",
          0,
          remitted,
          0,
          s.courier_id,
          s.awb,
          s.cn,
          "Settlement with no matching order",
          s.settled_at
        );
        matchedSettlementIds.add(s.id);
        summary.unmatched++;
        summary.total++;
        continue;
      }

      const expected = order.order_amount_paisa;
      const remitted = resolveRemitted(expected, s.remitted_paisa);
      let status = classifyAmounts(expected, remitted);

      // RTO / settle=false with remitted 0 → unpaid if expected > 0
      if (
        remitted === 0 &&
        expected > TOLERANCE_PAISA &&
        (/return|rto|ro|unsettled/i.test(s.delivery_status || "") ||
          status === "unpaid")
      ) {
        status = remitted === 0 ? (expected > 0 ? "short" : "matched") : status;
        // ORD-10003: RTO with expected COD but remitted 0 → short (courier didn't remit COD)
        status = "short";
      }

      // PostEx settle=false
      if (s.remitted_paisa === 0 && /unsettled/i.test(s.delivery_status || "")) {
        status = expected > TOLERANCE_PAISA ? "unpaid" : "matched";
      }

      const shortPaisa = Math.max(0, expected - remitted);
      insertMatch.run(
        crypto.randomUUID(),
        matchRunId,
        orgId,
        matchShopId,
        orderShipments.get(order.id) ?? null,
        s.id,
        order.id,
        status,
        expected,
        remitted,
        shortPaisa,
        s.courier_id,
        s.awb || order.awb,
        s.cn || order.cn,
        `Matched via ${matchVia}`,
        s.settled_at || order.ordered_at
      );

      // Link shipment courier
      db.prepare(
        `UPDATE shipments SET courier_id = COALESCE(courier_id, ?) WHERE id = ?`
      ).run(s.courier_id, orderShipments.get(order.id));

      matchedOrderIds.add(order.id);
      matchedSettlementIds.add(s.id);
      summary[status]++;
      summary.total++;
    }

    // Unpaid: orders with no settlement
    for (const o of orders) {
      if (matchedOrderIds.has(o.id)) continue;
      // Skip pure RTO orders that never expected COD? Still flag unpaid if delivered/shipped with COD
      const status: MatchStatus =
        o.order_amount_paisa > TOLERANCE_PAISA ? "unpaid" : "matched";
      insertMatch.run(
        crypto.randomUUID(),
        matchRunId,
        orgId,
        o.shop_id || shopId || null,
        orderShipments.get(o.id) ?? null,
        null,
        o.id,
        status,
        o.order_amount_paisa,
        0,
        o.order_amount_paisa,
        o.courier_id,
        o.awb,
        o.cn,
        "Order with no settlement line",
        o.ordered_at
      );
      if (status === "unpaid") summary.unpaid++;
      else summary.matched++;
      summary.total++;
    }
  });

  tx();

  db.prepare(`UPDATE match_runs SET summary_json = ? WHERE id = ?`).run(
    JSON.stringify(summary),
    matchRunId
  );

  audit(orgId, userId, "match_run", {
    match_run_id: matchRunId,
    shop_id: shopId || null,
    summary,
  });

  return { matchRunId, summary };
}

/** Pure classifier for unit tests */
export function classifyMatch(
  expectedPaisa: number,
  remittedPaisa: number,
  opts?: { settleFalse?: boolean; doublePaid?: boolean; noOrder?: boolean; noSettlement?: boolean }
): MatchStatus {
  if (opts?.doublePaid) return "double_paid";
  if (opts?.noOrder) return "unmatched";
  if (opts?.noSettlement) {
    return expectedPaisa > TOLERANCE_PAISA ? "unpaid" : "matched";
  }
  if (opts?.settleFalse) {
    return expectedPaisa > TOLERANCE_PAISA ? "unpaid" : "matched";
  }
  const remitted = remittedPaisa === -1 ? expectedPaisa : remittedPaisa;
  return classifyAmounts(expectedPaisa, remitted);
}

export function getHealthSummary(orgId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.*, c.code as courier_code
       FROM matches m
       LEFT JOIN couriers c ON c.id = m.courier_id
       WHERE m.org_id = ?
         AND m.match_run_id = (
           SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
         )`
    )
    .all(orgId, orgId) as Array<{
    status: MatchStatus;
    expected_paisa: number;
    remitted_paisa: number;
    short_paisa: number;
    courier_code: string | null;
    reference_date: string | null;
  }>;

  const health = {
    owed_paisa: 0,
    short_paisa: 0,
    aging_over_14_paisa: 0,
    unmatched_count: 0,
    unpaid_count: 0,
    matched_count: 0,
    short_count: 0,
    double_paid_count: 0,
    by_courier: {} as Record<
      string,
      {
        owed_paisa: number;
        short_paisa: number;
        unpaid_count: number;
        unmatched_count: number;
      }
    >,
  };

  for (const r of rows) {
    const code = r.courier_code || "unknown";
    if (!health.by_courier[code]) {
      health.by_courier[code] = {
        owed_paisa: 0,
        short_paisa: 0,
        unpaid_count: 0,
        unmatched_count: 0,
      };
    }
    if (r.status === "matched") health.matched_count++;
    if (r.status === "short") {
      health.short_count++;
      health.short_paisa += r.short_paisa;
      health.by_courier[code].short_paisa += r.short_paisa;
      health.owed_paisa += r.short_paisa;
      health.by_courier[code].owed_paisa += r.short_paisa;
    }
    if (r.status === "unpaid") {
      health.unpaid_count++;
      health.owed_paisa += r.expected_paisa;
      health.by_courier[code].owed_paisa += r.expected_paisa;
      health.by_courier[code].unpaid_count++;
    }
    if (r.status === "unmatched") {
      health.unmatched_count++;
      health.by_courier[code].unmatched_count++;
    }
    if (r.status === "double_paid") health.double_paid_count++;

    if (
      (r.status === "unpaid" || r.status === "short") &&
      agingBucketFromDate(r.reference_date) === ">14"
    ) {
      health.aging_over_14_paisa +=
        r.status === "unpaid" ? r.expected_paisa : r.short_paisa;
    }
  }

  return health;
}

export function getAgingBoard(orgId: string) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.*, c.code as courier_code
       FROM matches m
       LEFT JOIN couriers c ON c.id = m.courier_id
       WHERE m.org_id = ?
         AND m.status IN ('unpaid','short')
         AND m.match_run_id = (
           SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
         )`
    )
    .all(orgId, orgId) as Array<{
    status: string;
    expected_paisa: number;
    short_paisa: number;
    courier_code: string | null;
    reference_date: string | null;
    awb: string | null;
    cn: string | null;
  }>;

  const buckets: Record<
    string,
    { bucket: string; courier_code: string; count: number; amount_paisa: number; items: typeof rows }
  > = {};

  for (const r of rows) {
    const b = agingBucketFromDate(r.reference_date) || ">14";
    const code = r.courier_code || "unknown";
    const key = `${code}|${b}`;
    if (!buckets[key]) {
      buckets[key] = {
        bucket: b,
        courier_code: code,
        count: 0,
        amount_paisa: 0,
        items: [],
      };
    }
    const amt = r.status === "unpaid" ? r.expected_paisa : r.short_paisa;
    buckets[key].count++;
    buckets[key].amount_paisa += amt;
    buckets[key].items.push(r);
  }

  return Object.values(buckets);
}
