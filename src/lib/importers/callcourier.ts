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

export function parseCallCourier(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];

  raw.forEach((r, i) => {
    const cn = normalizeCn(
      getField(r, "cn number", "cn", "consignment no", "consignmentnumber", "cnsg_no")
    );
    if (!cn) {
      errors.push(`Call Courier row ${i + 2}: missing CN number`);
      return;
    }

    const cod = pkrToPaisa(getField(r, "cod amount", "cod", "amount"));
    const feeDel = pkrToPaisa(
      getField(r, "service charges", "courier charges", "delivery charges")
    );
    const feeGst = pkrToPaisa(getField(r, "tax", "gst", "sales tax"));
    const feeCash = pkrToPaisa(
      getField(r, "bank charges", "cash handling charges", "cash handling")
    );
    const status = getField(r, "status", "delivery status") || "Delivered";
    const isRto = /return|rto/i.test(status);

    const balanceRaw = getField(r, "balance", "net payable", "payment amount");
    let remitted: number;
    if (balanceRaw) {
      remitted = pkrToPaisa(balanceRaw);
    } else {
      remitted = isRto ? 0 : Math.max(0, cod - feeDel - feeGst - feeCash);
    }

    const orderRef = normalizeOrderId(
      getField(r, "ref no", "customer ref", "reference number", "order id", "ref#")
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
      settled_at: parseDateLoose(getField(r, "date", "payment date")),
      settlement_id: getField(r, "sheet no", "cheque no", "invoice no", "sheet_no"),
      delivery_status: status,
      settle_flag: !isRto && remitted > 0,
      raw: r,
    });
  });

  return { rows, errors };
}
