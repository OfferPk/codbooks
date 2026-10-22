import { getDb } from "./db";
import { daysBetween } from "./aging";
import { formatPkr, paisaToPkr } from "./money";
import { TOLERANCE_PAISA } from "./types";
import { csvLine } from "./csv";

export type LossCategory =
  | "short_payment"
  | "double_charged_fee"
  | "return_marked_delivered"
  | "held_payment"
  | "excess_fee_overcharge";

export type HeldBucket = "7-13" | "14-29" | "30+";

export interface LossItem {
  id: string;
  category: LossCategory;
  courier_code: string;
  courier_name: string;
  order_id: string | null;
  external_order_id: string | null;
  awb: string | null;
  cn: string | null;
  customer_name: string | null;
  expected_paisa: number;
  remitted_paisa: number;
  loss_paisa: number;
  loss_pkr: number;
  reference_date: string | null;
  days_held: number | null;
  held_bucket: HeldBucket | null;
  reason: string;
  details?: Record<string, unknown>;
}

export interface CategoryTotals {
  count: number;
  loss_paisa: number;
  loss_pkr: number;
}

export interface CourierTotals {
  courier_code: string;
  courier_name: string;
  total_loss_paisa: number;
  total_loss_pkr: number;
  total_issues: number;
  by_category: Record<LossCategory, CategoryTotals>;
}

export interface LossReportSummary {
  as_of: string;
  total_loss_paisa: number;
  total_loss_pkr: number;
  total_issues: number;
  by_category: Record<LossCategory, CategoryTotals>;
  by_courier: Record<string, CourierTotals>;
  items: LossItem[];
}

export interface OrderInput {
  id: string;
  external_order_id: string | null;
  awb: string | null;
  cn: string | null;
  customer_name: string | null;
  order_amount_paisa: number;
  ordered_at: string | null;
  status: string | null;
  courier_id: string | null;
  courier_code?: string | null;
  courier_name?: string | null;
}

export interface SettlementInput {
  id: string;
  courier_id: string;
  courier_code?: string | null;
  courier_name?: string | null;
  awb: string | null;
  cn: string | null;
  order_ref: string | null;
  remitted_paisa: number;
  fee_delivery_paisa: number;
  fee_return_paisa: number;
  fee_gst_paisa?: number;
  fee_wht_paisa?: number;
  fee_cash_handling_paisa?: number;
  fee_other_paisa?: number;
  settled_at: string | null;
  settlement_id: string | null;
  delivery_status: string | null;
}

export interface MatchInput {
  id: string;
  order_id: string | null;
  settlement_line_id: string | null;
  status: string;
  expected_paisa: number;
  remitted_paisa: number;
  short_paisa: number;
  courier_id: string | null;
  courier_code?: string | null;
  courier_name?: string | null;
  awb: string | null;
  cn: string | null;
  notes: string | null;
  reference_date: string | null;
}

export function classifyHeldDays(days: number): HeldBucket | null {
  if (days < 7) return null;
  if (days <= 13) return "7-13";
  if (days <= 29) return "14-29";
  return "30+";
}

/** Rule 1: Detect Short Payments */
export function detectShortPayments(params: {
  matches: MatchInput[];
  orders?: OrderInput[];
  settlements?: SettlementInput[];
}): LossItem[] {
  const items: LossItem[] = [];
  const orderMap = new Map<string, OrderInput>();
  if (params.orders) {
    for (const o of params.orders) orderMap.set(o.id, o);
  }

  for (const m of params.matches) {
    const isShort =
      m.status === "short" ||
      (m.expected_paisa > m.remitted_paisa + TOLERANCE_PAISA &&
        m.remitted_paisa > 0);

    if (isShort) {
      const lossPaisa =
        m.short_paisa > 0
          ? m.short_paisa
          : Math.max(0, m.expected_paisa - m.remitted_paisa);

      const o = m.order_id ? orderMap.get(m.order_id) : undefined;
      const courierCode = m.courier_code || o?.courier_code || "unknown";
      const courierName =
        m.courier_name || o?.courier_name || courierCode.toUpperCase();

      items.push({
        id: `short_${m.id}`,
        category: "short_payment",
        courier_code: courierCode,
        courier_name: courierName,
        order_id: m.order_id,
        external_order_id: o?.external_order_id || null,
        awb: m.awb || o?.awb || null,
        cn: m.cn || o?.cn || null,
        customer_name: o?.customer_name || null,
        expected_paisa: m.expected_paisa,
        remitted_paisa: m.remitted_paisa,
        loss_paisa: lossPaisa,
        loss_pkr: paisaToPkr(lossPaisa),
        reference_date: m.reference_date || o?.ordered_at || null,
        days_held: null,
        held_bucket: null,
        reason: `Short remitted COD: expected ${formatPkr(m.expected_paisa)}, received ${formatPkr(m.remitted_paisa)} (underpaid by ${formatPkr(lossPaisa)})`,
        details: {
          matchId: m.id,
          settlementLineId: m.settlement_line_id,
        },
      });
    }
  }

  return items;
}

/** Rule 2: Detect Double-Charged / Duplicate Fees */
export function detectDoubleChargedFees(params: {
  settlements: SettlementInput[];
  orders?: OrderInput[];
}): LossItem[] {
  const items: LossItem[] = [];
  const orderMapByAwb = new Map<string, OrderInput>();
  const orderMapByCn = new Map<string, OrderInput>();
  const orderMapByRef = new Map<string, OrderInput>();

  if (params.orders) {
    for (const o of params.orders) {
      if (o.awb) orderMapByAwb.set(o.awb.trim().toLowerCase(), o);
      if (o.cn) orderMapByCn.set(o.cn.trim().toLowerCase(), o);
      if (o.external_order_id) {
        orderMapByRef.set(o.external_order_id.trim().toLowerCase(), o);
      }
    }
  }

  // Group settlements by tracking key (AWB / CN / order_ref)
  const byTrackingKey = new Map<string, SettlementInput[]>();
  for (const s of params.settlements) {
    const key =
      (s.awb && s.awb.trim().toLowerCase()) ||
      (s.cn && s.cn.trim().toLowerCase()) ||
      (s.order_ref && s.order_ref.trim().toLowerCase());
    if (!key) continue;
    const list = byTrackingKey.get(key) || [];
    list.push(s);
    byTrackingKey.set(key, list);
  }

  // 1) Duplicate / multiple delivery fees on same tracking key
  for (const [key, list] of byTrackingKey.entries()) {
    const linesWithDeliveryFee = list.filter((s) => s.fee_delivery_paisa > 0);
    if (linesWithDeliveryFee.length > 1) {
      for (let i = 1; i < linesWithDeliveryFee.length; i++) {
        const dup = linesWithDeliveryFee[i];
        const courierCode = dup.courier_code || "unknown";
        const courierName = dup.courier_name || courierCode.toUpperCase();
        const o =
          orderMapByAwb.get(key) ||
          orderMapByCn.get(key) ||
          orderMapByRef.get(key);

        items.push({
          id: `double_fee_${dup.id}`,
          category: "double_charged_fee",
          courier_code: courierCode,
          courier_name: courierName,
          order_id: o?.id || null,
          external_order_id: o?.external_order_id || dup.order_ref || null,
          awb: dup.awb || o?.awb || null,
          cn: dup.cn || o?.cn || null,
          customer_name: o?.customer_name || null,
          expected_paisa: 0,
          remitted_paisa: dup.remitted_paisa,
          loss_paisa: dup.fee_delivery_paisa,
          loss_pkr: paisaToPkr(dup.fee_delivery_paisa),
          reference_date: dup.settled_at || null,
          days_held: null,
          held_bucket: null,
          reason: `Duplicate delivery fee of ${formatPkr(dup.fee_delivery_paisa)} charged multiple times (${linesWithDeliveryFee.length}x) on tracking ${dup.awb || dup.cn || key}`,
          details: {
            settlementId: dup.settlement_id,
            firstLineId: linesWithDeliveryFee[0].id,
            duplicateLineId: dup.id,
          },
        });
      }
    }
  }

  // 2) Return fee charged on successfully delivered parcel
  for (const s of params.settlements) {
    const status = (s.delivery_status || "").toLowerCase();
    const isDelivered = /delivered|complete|ok|success/i.test(status);
    if (isDelivered && s.fee_return_paisa > 0) {
      const courierCode = s.courier_code || "unknown";
      const courierName = s.courier_name || courierCode.toUpperCase();
      const key =
        (s.awb && s.awb.trim().toLowerCase()) ||
        (s.cn && s.cn.trim().toLowerCase()) ||
        (s.order_ref && s.order_ref.trim().toLowerCase()) ||
        "";
      const o = key
        ? orderMapByAwb.get(key) ||
          orderMapByCn.get(key) ||
          orderMapByRef.get(key)
        : undefined;

      items.push({
        id: `invalid_return_fee_${s.id}`,
        category: "double_charged_fee",
        courier_code: courierCode,
        courier_name: courierName,
        order_id: o?.id || null,
        external_order_id: o?.external_order_id || s.order_ref || null,
        awb: s.awb || o?.awb || null,
        cn: s.cn || o?.cn || null,
        customer_name: o?.customer_name || null,
        expected_paisa: 0,
        remitted_paisa: s.remitted_paisa,
        loss_paisa: s.fee_return_paisa,
        loss_pkr: paisaToPkr(s.fee_return_paisa),
        reference_date: s.settled_at || null,
        days_held: null,
        held_bucket: null,
        reason: `Invalid return fee of ${formatPkr(s.fee_return_paisa)} deducted on delivered shipment`,
        details: {
          settlementId: s.settlement_id,
          deliveryStatus: s.delivery_status,
        },
      });
    }
  }

  return items;
}

/** Rule 3: Detect Return vs Delivered Status Discrepancies */
export function detectReturnsMarkedDelivered(params: {
  orders: OrderInput[];
  settlements: SettlementInput[];
  matches?: MatchInput[];
}): LossItem[] {
  const items: LossItem[] = [];

  const settlementByAwb = new Map<string, SettlementInput>();
  const settlementByCn = new Map<string, SettlementInput>();
  const settlementByRef = new Map<string, SettlementInput>();

  for (const s of params.settlements) {
    if (s.awb) settlementByAwb.set(s.awb.trim().toLowerCase(), s);
    if (s.cn) settlementByCn.set(s.cn.trim().toLowerCase(), s);
    if (s.order_ref) settlementByRef.set(s.order_ref.trim().toLowerCase(), s);
  }

  for (const o of params.orders) {
    const awbKey = o.awb ? o.awb.trim().toLowerCase() : "";
    const cnKey = o.cn ? o.cn.trim().toLowerCase() : "";
    const refKey = o.external_order_id
      ? o.external_order_id.trim().toLowerCase()
      : "";

    const s =
      (awbKey && settlementByAwb.get(awbKey)) ||
      (cnKey && settlementByCn.get(cnKey)) ||
      (refKey && settlementByRef.get(refKey));

    if (!s) continue;

    const courierCode = s.courier_code || o.courier_code || "unknown";
    const courierName =
      s.courier_name || o.courier_name || courierCode.toUpperCase();

    const orderStatus = (o.status || "").toLowerCase();
    const settStatus = (s.delivery_status || "").toLowerCase();

    // Case A: Order marked Return/RTO by merchant, but Courier says Delivered
    const orderIsRto = /return|rto|ro|canceled|cancelled/i.test(orderStatus);
    const settIsDelivered = /delivered|ok|complete/i.test(settStatus);

    if (orderIsRto && settIsDelivered) {
      const lossPaisa =
        s.remitted_paisa === 0
          ? o.order_amount_paisa
          : Math.max(0, o.order_amount_paisa - s.remitted_paisa);

      if (lossPaisa > 0) {
        items.push({
          id: `ret_deliv_${o.id}_${s.id}`,
          category: "return_marked_delivered",
          courier_code: courierCode,
          courier_name: courierName,
          order_id: o.id,
          external_order_id: o.external_order_id,
          awb: o.awb || s.awb,
          cn: o.cn || s.cn,
          customer_name: o.customer_name,
          expected_paisa: o.order_amount_paisa,
          remitted_paisa: s.remitted_paisa,
          loss_paisa: lossPaisa,
          loss_pkr: paisaToPkr(lossPaisa),
          reference_date: s.settled_at || o.ordered_at,
          days_held: null,
          held_bucket: null,
          reason: `Discrepancy: Merchant marked ${o.status || "RTO"}, but courier claims Delivered with 0 COD remitted`,
          details: {
            orderStatus: o.status,
            courierDeliveryStatus: s.delivery_status,
          },
        });
      }
    }

    // Case B: Courier marked Delivered, but remitted 0 COD on a COD order
    if (
      settIsDelivered &&
      s.remitted_paisa === 0 &&
      o.order_amount_paisa > TOLERANCE_PAISA &&
      !orderIsRto
    ) {
      items.push({
        id: `deliv_zero_${o.id}_${s.id}`,
        category: "return_marked_delivered",
        courier_code: courierCode,
        courier_name: courierName,
        order_id: o.id,
        external_order_id: o.external_order_id,
        awb: o.awb || s.awb,
        cn: o.cn || s.cn,
        customer_name: o.customer_name,
        expected_paisa: o.order_amount_paisa,
        remitted_paisa: 0,
        loss_paisa: o.order_amount_paisa,
        loss_pkr: paisaToPkr(o.order_amount_paisa),
        reference_date: s.settled_at || o.ordered_at,
        days_held: null,
        held_bucket: null,
        reason: `Courier reported Delivered, but remitted PKR 0.00 COD (withheld full cash)`,
        details: {
          courierDeliveryStatus: s.delivery_status,
        },
      });
    }
  }

  return items;
}

/** Rule 4: Detect Payments Held 7 / 14 / 30 Days */
export function detectHeldPayments(params: {
  matches: MatchInput[];
  orders?: OrderInput[];
  asOf?: Date;
}): LossItem[] {
  const items: LossItem[] = [];
  const asOf = params.asOf || new Date();
  const orderMap = new Map<string, OrderInput>();
  if (params.orders) {
    for (const o of params.orders) orderMap.set(o.id, o);
  }

  for (const m of params.matches) {
    if (m.status !== "unpaid" && m.status !== "short") continue;
    const refDate = m.reference_date || (m.order_id ? orderMap.get(m.order_id)?.ordered_at : null);
    if (!refDate) continue;

    const days = daysBetween(refDate, asOf);
    const bucket = classifyHeldDays(days);
    if (!bucket) continue;

    const o = m.order_id ? orderMap.get(m.order_id) : undefined;
    const courierCode = m.courier_code || o?.courier_code || "unknown";
    const courierName = m.courier_name || o?.courier_name || courierCode.toUpperCase();

    const bucketLabel =
      bucket === "7-13"
        ? "7–13 days overdue"
        : bucket === "14-29"
        ? "14–29 days overdue"
        : "30+ days overdue (Critical)";

    items.push({
      id: `held_${m.id}`,
      category: "held_payment",
      courier_code: courierCode,
      courier_name: courierName,
      order_id: m.order_id,
      external_order_id: o?.external_order_id || null,
      awb: m.awb || o?.awb || null,
      cn: m.cn || o?.cn || null,
      customer_name: o?.customer_name || null,
      expected_paisa: m.expected_paisa,
      remitted_paisa: 0,
      loss_paisa: m.expected_paisa,
      loss_pkr: paisaToPkr(m.expected_paisa),
      reference_date: refDate,
      days_held: days,
      held_bucket: bucket,
      reason: `Unpaid COD receivable held for ${days} days (${bucketLabel})`,
      details: {
        matchId: m.id,
        daysHeld: days,
        bucket,
      },
    });
  }

  return items;
}

/** Rule 5: Detect Delivery Weight Overcharges & Excessive Cash Handling Fees */
export function detectExcessFeeOvercharges(params: {
  settlements: SettlementInput[];
  orders?: OrderInput[];
}): LossItem[] {
  const items: LossItem[] = [];
  const orderMap = new Map<string, OrderInput>();
  if (params.orders) {
    for (const o of params.orders) {
      if (o.awb) orderMap.set(o.awb.trim().toLowerCase(), o);
      if (o.cn) orderMap.set(o.cn.trim().toLowerCase(), o);
      if (o.external_order_id) orderMap.set(o.external_order_id.trim().toLowerCase(), o);
    }
  }

  for (const s of params.settlements) {
    const courierCode = s.courier_code || "unknown";
    const courierName = s.courier_name || courierCode.toUpperCase();
    const key = (s.awb || s.cn || s.order_ref || "").trim().toLowerCase();
    const o = key ? orderMap.get(key) : undefined;

    // Delivery fee threshold: standard e-commerce delivery in PK is PKR 150-250.
    // Unexplained delivery fee > PKR 400 (40000 paisa) indicates arbitrary weight surcharge.
    const STANDARD_FEE_MAX_PAISA = 40000; // PKR 400
    if (s.fee_delivery_paisa > STANDARD_FEE_MAX_PAISA) {
      const overchargePaisa = s.fee_delivery_paisa - STANDARD_FEE_MAX_PAISA;
      items.push({
        id: `overcharge_deliv_${s.id}`,
        category: "excess_fee_overcharge",
        courier_code: courierCode,
        courier_name: courierName,
        order_id: o?.id || null,
        external_order_id: o?.external_order_id || s.order_ref || null,
        awb: s.awb || o?.awb || null,
        cn: s.cn || o?.cn || null,
        customer_name: o?.customer_name || null,
        expected_paisa: 0,
        remitted_paisa: s.remitted_paisa,
        loss_paisa: overchargePaisa,
        loss_pkr: paisaToPkr(overchargePaisa),
        reference_date: s.settled_at || null,
        days_held: null,
        held_bucket: null,
        reason: `Excessive delivery/freight charge: ${formatPkr(s.fee_delivery_paisa)} exceeds standard PKR 400.00 ceiling by ${formatPkr(overchargePaisa)}`,
        details: {
          deliveryFee: s.fee_delivery_paisa,
          settlementLineId: s.id,
        },
      });
    }

    // Cash handling fee threshold: standard contractual cap is 2.5%.
    if (s.fee_cash_handling_paisa && s.fee_cash_handling_paisa > 6000) {
      const codBase = s.remitted_paisa > 0 ? s.remitted_paisa : (o?.order_amount_paisa || 0);
      if (codBase > 0) {
        const allowedFee = Math.round(codBase * 0.025);
        if (s.fee_cash_handling_paisa > allowedFee + 2000) {
          const excessPaisa = s.fee_cash_handling_paisa - allowedFee;
          items.push({
            id: `overcharge_cash_${s.id}`,
            category: "excess_fee_overcharge",
            courier_code: courierCode,
            courier_name: courierName,
            order_id: o?.id || null,
            external_order_id: o?.external_order_id || s.order_ref || null,
            awb: s.awb || o?.awb || null,
            cn: s.cn || o?.cn || null,
            customer_name: o?.customer_name || null,
            expected_paisa: 0,
            remitted_paisa: s.remitted_paisa,
            loss_paisa: excessPaisa,
            loss_pkr: paisaToPkr(excessPaisa),
            reference_date: s.settled_at || null,
            days_held: null,
            held_bucket: null,
            reason: `Excessive cash handling deduction: ${formatPkr(s.fee_cash_handling_paisa)} exceeds 2.5% SLA cap (${formatPkr(allowedFee)}) by ${formatPkr(excessPaisa)}`,
            details: {
              cashHandlingFee: s.fee_cash_handling_paisa,
              codBase,
              settlementLineId: s.id,
            },
          });
        }
      }
    }
  }

  return items;
}

/** Pure Aggregator: compile all detection items into summary and courier totals */
export function compileLossReport(
  items: LossItem[],
  asOf: Date = new Date()
): LossReportSummary {
  const emptyCategoryTotals = (): CategoryTotals => ({
    count: 0,
    loss_paisa: 0,
    loss_pkr: 0,
  });

  const byCategory: Record<LossCategory, CategoryTotals> = {
    short_payment: emptyCategoryTotals(),
    double_charged_fee: emptyCategoryTotals(),
    return_marked_delivered: emptyCategoryTotals(),
    held_payment: emptyCategoryTotals(),
    excess_fee_overcharge: emptyCategoryTotals(),
  };

  const byCourier: Record<string, CourierTotals> = {};
  let totalLossPaisa = 0;

  for (const item of items) {
    totalLossPaisa += item.loss_paisa;

    // By category
    const cat = byCategory[item.category];
    if (cat) {
      cat.count++;
      cat.loss_paisa += item.loss_paisa;
      cat.loss_pkr = paisaToPkr(cat.loss_paisa);
    }

    // By courier
    const code = item.courier_code || "unknown";
    if (!byCourier[code]) {
      byCourier[code] = {
        courier_code: code,
        courier_name: item.courier_name || code.toUpperCase(),
        total_loss_paisa: 0,
        total_loss_pkr: 0,
        total_issues: 0,
        by_category: {
          short_payment: emptyCategoryTotals(),
          double_charged_fee: emptyCategoryTotals(),
          return_marked_delivered: emptyCategoryTotals(),
          held_payment: emptyCategoryTotals(),
          excess_fee_overcharge: emptyCategoryTotals(),
        },
      };
    }

    const c = byCourier[code];
    c.total_loss_paisa += item.loss_paisa;
    c.total_loss_pkr = paisaToPkr(c.total_loss_paisa);
    c.total_issues++;

    const cCat = c.by_category[item.category];
    if (cCat) {
      cCat.count++;
      cCat.loss_paisa += item.loss_paisa;
      cCat.loss_pkr = paisaToPkr(cCat.loss_paisa);
    }
  }

  return {
    as_of: asOf.toISOString(),
    total_loss_paisa: totalLossPaisa,
    total_loss_pkr: paisaToPkr(totalLossPaisa),
    total_issues: items.length,
    by_category: byCategory,
    by_courier: byCourier,
    items,
  };
}

/** Generate Loss Report from SQLite Database with optional shop-level isolation */
export function getLossReport(
  orgId: string,
  asOfDate: Date = new Date(),
  shopId?: string | null
): LossReportSummary {
  const db = getDb();

  // Load couriers map
  const couriers = db
    .prepare("SELECT id, code, name FROM couriers")
    .all() as Array<{ id: string; code: string; name: string }>;
  const courierMap = new Map<string, { code: string; name: string }>();
  for (const c of couriers) {
    courierMap.set(c.id, { code: c.code, name: c.name });
  }

  let matches: MatchInput[] = [];
  if (shopId) {
    const latestRun = db
      .prepare(
        `SELECT id FROM match_runs WHERE org_id = ? AND shop_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(orgId, shopId) as { id: string } | undefined;

    if (latestRun) {
      matches = db
        .prepare(
          `SELECT m.*, c.code as courier_code, c.name as courier_name
           FROM matches m
           LEFT JOIN couriers c ON c.id = m.courier_id
           WHERE m.org_id = ? AND m.match_run_id = ? AND (m.shop_id = ? OR m.shop_id IS NULL)`
        )
        .all(orgId, latestRun.id, shopId) as MatchInput[];
    }
  } else {
    // Org-level: select latest match run per shop using window functions
    matches = db
      .prepare(
        `SELECT m.*, c.code as courier_code, c.name as courier_name
         FROM matches m
         LEFT JOIN couriers c ON c.id = m.courier_id
         WHERE m.org_id = ?
           AND m.match_run_id IN (
             SELECT id FROM (
               SELECT id, row_number() OVER (PARTITION BY COALESCE(shop_id, '') ORDER BY created_at DESC) as rn
               FROM match_runs
               WHERE org_id = ?
             ) WHERE rn = 1
           )`
      )
      .all(orgId, orgId) as MatchInput[];
  }

  const orders = shopId
    ? (db
        .prepare(
          `SELECT o.*, c.code as courier_code, c.name as courier_name
           FROM orders o
           LEFT JOIN couriers c ON c.id = o.courier_id
           WHERE o.org_id = ? AND o.shop_id = ?`
        )
        .all(orgId, shopId) as OrderInput[])
    : (db
        .prepare(
          `SELECT o.*, c.code as courier_code, c.name as courier_name
           FROM orders o
           LEFT JOIN couriers c ON c.id = o.courier_id
           WHERE o.org_id = ?`
        )
        .all(orgId) as OrderInput[]);

  const settlements = shopId
    ? (db
        .prepare(
          `SELECT s.*, c.code as courier_code, c.name as courier_name
           FROM settlement_lines s
           LEFT JOIN couriers c ON c.id = s.courier_id
           WHERE s.org_id = ? AND s.shop_id = ?`
        )
        .all(orgId, shopId) as SettlementInput[])
    : (db
        .prepare(
          `SELECT s.*, c.code as courier_code, c.name as courier_name
           FROM settlement_lines s
           LEFT JOIN couriers c ON c.id = s.courier_id
           WHERE s.org_id = ?`
        )
        .all(orgId) as SettlementInput[]);

  // Fill in courier code/name if missing
  for (const m of matches) {
    if (!m.courier_code && m.courier_id && courierMap.has(m.courier_id)) {
      const c = courierMap.get(m.courier_id)!;
      m.courier_code = c.code;
      m.courier_name = c.name;
    }
  }
  for (const o of orders) {
    if (!o.courier_code && o.courier_id && courierMap.has(o.courier_id)) {
      const c = courierMap.get(o.courier_id)!;
      o.courier_code = c.code;
      o.courier_name = c.name;
    }
  }
  for (const s of settlements) {
    if (!s.courier_code && s.courier_id && courierMap.has(s.courier_id)) {
      const c = courierMap.get(s.courier_id)!;
      s.courier_code = c.code;
      s.courier_name = c.name;
    }
  }

  // Run the 5 detection rules
  const shortItems = detectShortPayments({ matches, orders, settlements });
  const doubleFeeItems = detectDoubleChargedFees({ settlements, orders });
  const returnDiscrepancyItems = detectReturnsMarkedDelivered({
    orders,
    settlements,
    matches,
  });
  const heldItems = detectHeldPayments({ matches, orders, asOf: asOfDate });
  const excessFeeItems = detectExcessFeeOvercharges({ settlements, orders });

  const allItems: LossItem[] = [
    ...shortItems,
    ...doubleFeeItems,
    ...returnDiscrepancyItems,
    ...heldItems,
    ...excessFeeItems,
  ];

  return compileLossReport(allItems, asOfDate);
}

/** CSV Export for Loss Report */
export function exportLossReportCsv(items: LossItem[]): string {
  const CATEGORY_LABELS: Record<LossCategory, string> = {
    short_payment: "Short Payment",
    double_charged_fee: "Double-Charged Fee",
    return_marked_delivered: "Return vs Delivered Discrepancy",
    held_payment: "Held Payment",
    excess_fee_overcharge: "Excess Fee / Overcharge",
  };

  const header = [
    "Category",
    "Courier",
    "Order ID",
    "Tracking AWB",
    "Consignment No",
    "Customer Name",
    "Reference Date",
    "Days Held",
    "Expected (PKR)",
    "Remitted (PKR)",
    "Claim Amount (PKR)",
    "Reason",
  ];

  const lines = [csvLine(header)];

  for (const item of items) {
    const row = [
      CATEGORY_LABELS[item.category] || item.category,
      item.courier_name,
      item.external_order_id || "",
      item.awb || "",
      item.cn || "",
      item.customer_name || "",
      item.reference_date ? item.reference_date.substring(0, 10) : "",
      item.days_held !== null ? String(item.days_held) : "",
      item.expected_paisa > 0 ? (item.expected_paisa / 100).toFixed(2) : "",
      item.remitted_paisa > 0 ? (item.remitted_paisa / 100).toFixed(2) : "0.00",
      item.loss_pkr.toFixed(2),
      item.reason,
    ];
    lines.push(csvLine(row));
  }

  return lines.join("\n");
}
