import { parseCsv, getField } from "./csv";
import { pkrToPaisa } from "./money";
import { normalizeAwb, normalizeCn, normalizeOrderId } from "./normalize";

export type DetectedTemplate =
  | "orders"
  | "tcs_invoice"
  | "tcs_detail"
  | "postex"
  | "postex_portal"
  | "unknown";

export interface ParsedOrder {
  external_order_id: string;
  awb: string;
  cn: string;
  customer_name: string;
  order_amount_paisa: number;
  currency: string;
  ordered_at: string | null;
  source: string;
  status: string;
  courier_code: string | null;
  raw: Record<string, string>;
}

export interface ParsedSettlement {
  awb: string;
  cn: string;
  order_ref: string;
  remitted_paisa: number;
  fee_delivery_paisa: number;
  fee_return_paisa: number;
  fee_gst_paisa: number;
  fee_wht_paisa: number;
  fee_cash_handling_paisa: number;
  fee_other_paisa: number;
  cod_booked_paisa: number;
  settled_at: string | null;
  settlement_id: string;
  delivery_status: string;
  settle_flag: boolean | null;
  raw: Record<string, string>;
}

function headerSet(headers: string[]): Set<string> {
  return new Set(headers.map((h) => h.toLowerCase().trim()));
}

export function detectTemplate(headers: string[]): DetectedTemplate {
  const h = headerSet(headers);
  if (
    h.has("external_order_id") ||
    (h.has("cod_amount_pkr") && (h.has("awb") || h.has("cn")))
  ) {
    return "orders";
  }
  if (h.has("cnsg_no") && h.has("codamount")) return "tcs_invoice";
  if (h.has("cn by courier") || h.has("amount paid")) return "tcs_detail";
  if (
    h.has("trackingnumber") &&
    h.has("orderrefnumber") &&
    (h.has("amount_paid") || h.has("cod_amount") || h.has("fee_delivery"))
  ) {
    return "postex_portal";
  }
  if (h.has("trackingnumber") && h.has("settle")) return "postex";
  return "unknown";
}

export function parseOrdersCsv(text: string): {
  rows: ParsedOrder[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedOrder[] = [];
  raw.forEach((r, i) => {
    const external = getField(
      r,
      "external_order_id",
      "order_id",
      "order id",
      "order no",
      "orderRefNumber"
    );
    const awb = normalizeAwb(getField(r, "awb", "trackingNumber", "cnsg_no"));
    const cn = normalizeCn(getField(r, "cn", "awb", "trackingNumber", "cnsg_no"));
    const amount = pkrToPaisa(
      getField(r, "cod_amount_pkr", "cod_amount", "amount", "order_amount")
    );
    if (!external && !awb && !cn) {
      errors.push(`Row ${i + 2}: missing order id / AWB / CN`);
      return;
    }
    const courierRaw = getField(
      r,
      "courier",
      "courier_code",
      "courier_name"
    ).toLowerCase();
    let courier_code: string | null = null;
    if (courierRaw === "tcs" || courierRaw.includes("tcs")) courier_code = "tcs";
    else if (
      courierRaw === "postex" ||
      courierRaw.includes("postex") ||
      courierRaw.includes("post ex")
    ) {
      courier_code = "postex";
    }
    rows.push({
      external_order_id: normalizeOrderId(external),
      awb,
      cn: cn || awb,
      customer_name: getField(r, "customer_name", "consignee", "customer"),
      order_amount_paisa: amount,
      currency: getField(r, "currency") || "PKR",
      ordered_at: getField(r, "ordered_at", "order_date", "date") || null,
      source: getField(r, "source") || "csv",
      status: getField(r, "status") || "shipped",
      courier_code,
      raw: r,
    });
  });
  return { rows, errors };
}

function parseDateLoose(v: string): string | null {
  if (!v || v.toLowerCase() === "null") return null;
  // DD/MM/YYYY
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    return iso;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return v;
}

export function parseTcsInvoice(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];
  raw.forEach((r, i) => {
    const cn = normalizeCn(getField(r, "cnsg_no"));
    if (!cn) {
      errors.push(`TCS invoice row ${i + 2}: missing cnsg_no`);
      return;
    }
    const cod = pkrToPaisa(getField(r, "codamount"));
    const feeDel = pkrToPaisa(getField(r, "courier_charges"));
    const feeGst = pkrToPaisa(getField(r, "gst"));
    const status = getField(r, "status");
    // Net remittance ≈ COD − delivery − GST for delivered; RTO typically remits 0
    const isRto = /return|rto|ro/i.test(status);
    const remitted = isRto ? 0 : Math.max(0, cod - feeDel - feeGst);
    rows.push({
      awb: cn,
      cn,
      order_ref: normalizeOrderId(getField(r, "cust_ref")),
      remitted_paisa: remitted,
      fee_delivery_paisa: feeDel,
      fee_return_paisa: isRto ? feeDel : 0,
      fee_gst_paisa: feeGst,
      fee_wht_paisa: 0,
      fee_cash_handling_paisa: 0,
      fee_other_paisa: 0,
      cod_booked_paisa: cod,
      settled_at: parseDateLoose(getField(r, "bkg_dat")),
      settlement_id: getField(r, "invoiceno"),
      delivery_status: status,
      settle_flag: !isRto && remitted > 0,
      raw: r,
    });
  });
  return { rows, errors };
}

export function parseTcsDetail(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];
  raw.forEach((r, i) => {
    const cn = normalizeCn(getField(r, "cn by courier"));
    if (!cn) {
      errors.push(`TCS detail row ${i + 2}: missing cn`);
      return;
    }
    const remitted = pkrToPaisa(getField(r, "amount paid"));
    const feeDel = pkrToPaisa(getField(r, "delivery charges"));
    rows.push({
      awb: cn,
      cn,
      order_ref: normalizeOrderId(getField(r, "order no")),
      remitted_paisa: remitted,
      fee_delivery_paisa: feeDel,
      fee_return_paisa: 0,
      fee_gst_paisa: 0,
      fee_wht_paisa: 0,
      fee_cash_handling_paisa: 0,
      fee_other_paisa: 0,
      cod_booked_paisa: 0,
      settled_at: parseDateLoose(getField(r, "payment date")),
      settlement_id: "",
      delivery_status: getField(r, "cn status"),
      settle_flag: getField(r, "payment status").toUpperCase() === "Y",
      raw: r,
    });
  });
  return { rows, errors };
}

export function parsePostex(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw, headers } = parseCsv(text);
  const tpl = detectTemplate(headers);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];
  raw.forEach((r, i) => {
    const cn = normalizeCn(
      getField(r, "trackingNumber", "tracking_number", "awb", "cn")
    );
    if (!cn) {
      errors.push(`PostEx row ${i + 2}: missing trackingNumber`);
      return;
    }
    const settleRaw = getField(r, "settle");
    const settle =
      settleRaw === ""
        ? null
        : /^(true|1|yes|y)$/i.test(settleRaw);
    const feeDel = pkrToPaisa(getField(r, "fee_delivery", "delivery charges"));
    const feeGst = pkrToPaisa(getField(r, "fee_gst", "gst"));
    const feeWht = pkrToPaisa(getField(r, "fee_wht", "wht"));
    const feeRet = pkrToPaisa(getField(r, "fee_return", "return charges"));
    const feeCash = pkrToPaisa(getField(r, "fee_cash_handling"));
    const feeOther = pkrToPaisa(getField(r, "fee_other"));
    const codBooked = pkrToPaisa(getField(r, "cod_amount", "invoicePayment"));
    let remitted = pkrToPaisa(getField(r, "amount_paid", "amount paid"));
    // API-shaped: no amount — remitted filled later from order expected when settle=true
    if (
      remitted === 0 &&
      settle === true &&
      tpl === "postex" &&
      codBooked === 0
    ) {
      remitted = -1; // sentinel: use expected at match time
    } else if (remitted === 0 && settle === true && codBooked > 0) {
      remitted = Math.max(
        0,
        codBooked - feeDel - feeGst - feeWht - feeRet - feeCash - feeOther
      );
    }
    rows.push({
      awb: cn,
      cn,
      order_ref: normalizeOrderId(
        getField(r, "orderRefNumber", "order_ref", "external_order_id")
      ),
      remitted_paisa: remitted,
      fee_delivery_paisa: feeDel,
      fee_return_paisa: feeRet,
      fee_gst_paisa: feeGst,
      fee_wht_paisa: feeWht,
      fee_cash_handling_paisa: feeCash,
      fee_other_paisa: feeOther,
      cod_booked_paisa: codBooked,
      settled_at: parseDateLoose(
        getField(r, "settlementDate", "settlement_date", "upfrontPaymentDate")
      ),
      settlement_id: getField(
        r,
        "cprNumber_1",
        "cprNumber",
        "cprNumber_2",
        "cpr"
      ),
      delivery_status: settle === true ? "settled" : settle === false ? "unsettled" : "",
      settle_flag: settle,
      raw: r,
    });
  });
  return { rows, errors };
}

export function parseSettlementByTemplate(
  text: string,
  hint?: string
): {
  template: DetectedTemplate;
  courierCode: "tcs" | "postex" | null;
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { headers } = parseCsv(text);
  let template = detectTemplate(headers);
  if (hint === "tcs" && template === "unknown") template = "tcs_invoice";
  if (hint === "postex" && template === "unknown") template = "postex";

  if (template === "tcs_invoice") {
    const r = parseTcsInvoice(text);
    return { template, courierCode: "tcs", ...r };
  }
  if (template === "tcs_detail") {
    const r = parseTcsDetail(text);
    return { template, courierCode: "tcs", ...r };
  }
  if (template === "postex" || template === "postex_portal") {
    const r = parsePostex(text);
    return { template, courierCode: "postex", ...r };
  }
  return {
    template: "unknown",
    courierCode: null,
    rows: [],
    errors: ["Unrecognized CPR/settlement CSV headers"],
  };
}
