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

export function parseSwyft(text: string): {
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
        "swyft tracking id",
        "tracking number",
        "tracking no",
        "cn",
        "consignment id"
      )
    );
    if (!cn) {
      errors.push(`Swyft row ${i + 2}: missing tracking number / Swyft ID`);
      return;
    }

    const cod = pkrToPaisa(
      getField(r, "cod amount", "declared value", "order amount", "amount")
    );
    const feeDel = pkrToPaisa(
      getField(r, "delivery charges", "freight charges", "shipping charges", "fee")
    );
    const feeFuel = pkrToPaisa(getField(r, "fuel surcharge", "fuel"));
    const feeGst = pkrToPaisa(getField(r, "gst", "sales tax", "tax"));
    const status = getField(r, "consignment status", "status", "delivery status") || "Delivered";
    const isRto = /return|rto|undelivered|cancelled/i.test(status);

    const netPayableRaw = getField(
      r,
      "net payable",
      "paid amount",
      "remitted amount",
      "net amount"
    );

    let remitted: number;
    if (netPayableRaw) {
      remitted = pkrToPaisa(netPayableRaw);
    } else {
      remitted = isRto ? 0 : Math.max(0, cod - feeDel - feeFuel - feeGst);
    }

    const orderRef = normalizeOrderId(
      getField(r, "order id", "reference no", "order reference", "client order id", "ref no")
    );

    const settledAt = parseDateLoose(
      getField(r, "settlement date", "payment date", "transferred on", "date", "delivery date")
    );

    const settlementId = getField(
      r,
      "voucher number",
      "payout ref",
      "cpr number",
      "batch id",
      "invoice no"
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
      fee_cash_handling_paisa: feeFuel, // Map fuel surcharge to cash handling / surcharge field
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
