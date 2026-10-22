import { parseCsv, getField } from "../csv";
import { pkrToPaisa } from "../money";
import { normalizeCn, normalizeOrderId } from "../normalize";
import type { ParsedSettlement } from "../parsers";

function parseDateLoose(v: string): string | null {
  if (!v || v.toLowerCase() === "null") return null;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return v;
}

export function parseRider(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];

  raw.forEach((r, i) => {
    const cn = normalizeCn(
      getField(
        r,
        "rider cn",
        "tracking number",
        "tracking id",
        "consignment number",
        "cn",
        "tracking_number"
      )
    );
    if (!cn) {
      errors.push(`Rider row ${i + 2}: missing tracking / Rider CN`);
      return;
    }

    const cod = pkrToPaisa(
      getField(r, "cod amount", "collected amount", "cod", "cash collection", "amount")
    );
    const feeDel = pkrToPaisa(
      getField(r, "delivery fee", "delivery charges", "rider fee", "shipping fee")
    );
    const feeCash = pkrToPaisa(
      getField(r, "cash handling", "handling fee", "bank charges")
    );
    const feeGst = pkrToPaisa(getField(r, "gst", "tax", "sst", "sales tax"));
    const status = getField(r, "status", "delivery status", "order status") || "Delivered";
    const isRto = /return|rto|cancelled|failed/i.test(status);

    const netRemittedRaw = getField(
      r,
      "net remittance",
      "net amount",
      "payout amount",
      "transfer amount",
      "amount paid"
    );

    let remitted: number;
    if (netRemittedRaw) {
      remitted = pkrToPaisa(netRemittedRaw);
    } else {
      remitted = isRto ? 0 : Math.max(0, cod - feeDel - feeCash - feeGst);
    }

    const orderRef = normalizeOrderId(
      getField(r, "order reference", "order no", "order id", "merchant order id", "ref no")
    );

    const settledAt = parseDateLoose(
      getField(r, "settlement date", "disbursement date", "payment date", "date", "delivery date")
    );

    const settlementId = getField(
      r,
      "disbursement id",
      "batch id",
      "sheet no",
      "invoice no",
      "statement id"
    );

    rows.push({
      awb: cn,
      cn,
      order_ref: orderRef,
      remitted_paisa: remitted,
      fee_delivery_paisa: feeDel,
      fee_return_paisa: isRto ? feeDel : 0,
      fee_gst_paisa: feeGst,
      fee_wht_paisa: 0,
      fee_cash_handling_paisa: feeCash,
      fee_other_paisa: 0,
      cod_booked_paisa: cod,
      settled_at: settledAt,
      settlement_id: settlementId,
      delivery_status: status,
      settle_flag: true,
      raw: r,
    });
  });

  return { rows, errors };
}
