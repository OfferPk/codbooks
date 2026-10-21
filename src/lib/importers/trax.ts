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

export function parseTrax(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];

  raw.forEach((r, i) => {
    const cn = normalizeCn(
      getField(r, "tracking number", "tracking id", "trax cn", "consignment number", "trackingnumber")
    );
    if (!cn) {
      errors.push(`Trax row ${i + 2}: missing tracking number`);
      return;
    }

    const cod = pkrToPaisa(
      getField(r, "product amount", "cod amount", "cod", "amount")
    );
    const feeDel = pkrToPaisa(
      getField(r, "service charges", "shipping charges", "delivery charges")
    );
    const feeCash = pkrToPaisa(
      getField(r, "cash handling fee", "cash handling charges", "cash handling")
    );
    const feeGst = pkrToPaisa(getField(r, "sales tax", "gst"));
    const status = getField(r, "current status", "status", "delivery status") || "Delivered";
    const isRto = /return|rto|returned to shipper/i.test(status);

    const amountPaidRaw = getField(r, "amount paid", "net payable", "transfer amount");
    let remitted: number;
    if (amountPaidRaw) {
      remitted = pkrToPaisa(amountPaidRaw);
    } else {
      remitted = isRto ? 0 : Math.max(0, cod - feeDel - feeCash - feeGst);
    }

    const orderRef = normalizeOrderId(
      getField(r, "order number", "order id", "merchant reference", "order_id")
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
      settled_at: parseDateLoose(getField(r, "disbursement date", "settlement date", "payment date", "date")),
      settlement_id: getField(r, "disbursement id", "payment reference", "disbursement_id"),
      delivery_status: status,
      settle_flag: !isRto && remitted > 0,
      raw: r,
    });
  });

  return { rows, errors };
}
