import { parseCsv, getField } from "../csv";
import { pkrToPaisa } from "../money";
import { normalizeAwb, normalizeCn, normalizeOrderId } from "../normalize";
import type { ParsedOrder } from "../parsers";

function parseDateLoose(v: string): string | null {
  if (!v || v.toLowerCase() === "null") return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return v;
}

function resolveCourierCode(companyRaw: string): string | null {
  const c = companyRaw.toLowerCase().trim();
  if (!c) return null;
  if (c.includes("tcs")) return "tcs";
  if (c.includes("postex") || c.includes("post ex")) return "postex";
  if (c.includes("leopard")) return "leopards";
  if (c.includes("mnp") || c.includes("m&p")) return "mnp";
  if (c.includes("trax")) return "trax";
  if (c.includes("callcourier") || c.includes("call courier")) return "callcourier";
  if (c.includes("rider")) return "rider";
  if (c.includes("swyft")) return "swyft";
  return null;
}

/**
 * Parses a Shopify Orders Export CSV.
 * In Shopify multi-item exports, the first row of an order contains the order totals,
 * tracking numbers, and customer info. Subsequent item rows with identical or empty Name
 * are deduplicated.
 */
export function parseShopifyOrders(text: string): {
  rows: ParsedOrder[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedOrder[] = [];
  const seenOrderIds = new Set<string>();

  raw.forEach((r, i) => {
    const rawName = getField(r, "name", "order", "id");
    if (!rawName) {
      // Shopify secondary item row without order name
      return;
    }

    const orderId = normalizeOrderId(rawName.replace(/^#/, ""));
    if (seenOrderIds.has(orderId)) {
      // Deduplicate secondary line items of same order
      return;
    }

    const awbRaw = getField(
      r,
      "fulfillments tracking number",
      "tracking number",
      "fulfillment tracking number",
      "tracking_number",
      "awb"
    );
    const trackingCompany = getField(
      r,
      "fulfillments tracking company",
      "tracking company",
      "shipping line title",
      "courier"
    );

    const amountRaw = getField(r, "total", "outstanding balance", "subtotal", "amount");
    const amount = pkrToPaisa(amountRaw);

    const awb = normalizeAwb(awbRaw);
    const cn = normalizeCn(awbRaw);

    if (!orderId && !awb) {
      errors.push(`Shopify row ${i + 2}: missing order ID and tracking number`);
      return;
    }

    seenOrderIds.add(orderId);

    const customer = getField(
      r,
      "shipping name",
      "billing name",
      "customer name",
      "name"
    );

    const orderedAt = parseDateLoose(getField(r, "created at", "created_at", "date"));
    const financialStatus = getField(r, "financial status", "financial_status");
    const fulfillmentStatus = getField(r, "fulfillment status", "fulfillment_status");
    const status = fulfillmentStatus || financialStatus || "shipped";

    rows.push({
      external_order_id: orderId,
      awb,
      cn: cn || awb,
      customer_name: customer,
      order_amount_paisa: amount,
      currency: getField(r, "currency") || "PKR",
      ordered_at: orderedAt,
      source: "shopify",
      status,
      courier_code: resolveCourierCode(trackingCompany),
      raw: r,
    });
  });

  return { rows, errors };
}

/**
 * Parses a WooCommerce Orders Export CSV.
 */
export function parseWooCommerceOrders(text: string): {
  rows: ParsedOrder[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedOrder[] = [];
  const seenOrderIds = new Set<string>();

  raw.forEach((r, i) => {
    const rawNum = getField(r, "order number", "order_number", "order id", "order_id", "id");
    const orderId = normalizeOrderId(rawNum.replace(/^#/, ""));
    if (!orderId) {
      errors.push(`WooCommerce row ${i + 2}: missing order number`);
      return;
    }
    if (seenOrderIds.has(orderId)) return;
    seenOrderIds.add(orderId);

    const awbRaw = getField(
      r,
      "tracking number",
      "tracking_number",
      "custom tracking number",
      "consignment no",
      "awb"
    );
    const courierRaw = getField(
      r,
      "courier",
      "courier name",
      "shipping method",
      "shipping method title"
    );

    const amount = pkrToPaisa(
      getField(r, "order total", "order_total", "total", "order subtotal")
    );

    const awb = normalizeAwb(awbRaw);
    const cn = normalizeCn(awbRaw);

    const customer = getField(
      r,
      "billing full name",
      "billing name",
      "customer name",
      "shipping full name"
    );

    const orderedAt = parseDateLoose(getField(r, "order date", "order_date", "date"));
    const status = getField(r, "order status", "order_status", "status") || "processing";

    rows.push({
      external_order_id: orderId,
      awb,
      cn: cn || awb,
      customer_name: customer,
      order_amount_paisa: amount,
      currency: getField(r, "currency") || "PKR",
      ordered_at: orderedAt,
      source: "woocommerce",
      status,
      courier_code: resolveCourierCode(courierRaw),
      raw: r,
    });
  });

  return { rows, errors };
}
