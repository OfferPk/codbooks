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

export function parseMnp(text: string): {
  rows: ParsedSettlement[];
  errors: string[];
} {
  const { rows: raw } = parseCsv(text);
  const errors: string[] = [];
  const rows: ParsedSettlement[] = [];

  raw.forEach((r, i) => {
    const cn = normalizeCn(
      getField(r, "cn number", "consignment no", "cn", "cn#", "cnsg_no")
    );
    if (!cn) {
      errors.push(`M&P row ${i + 2}: missing CN number`);
      return;
    }

    const cod = pkrToPaisa(
      getField(r, "cod value", "cod amount", "cod", "declared value")
    );
    const feeDel = pkrToPaisa(
      getField(r, "delivery charges", "freight", "tariff", "service charges")
    );
    const feeGst = pkrToPaisa(getField(r, "fed", "gst", "sales tax"));
    const feeWht = pkrToPaisa(getField(r, "wht", "withholding tax"));
    const status = getField(r, "status", "delivery status") || "Delivered";
    const isRto = /return|rto/i.test(status);

    const netCodRaw = getField(r, "net cod", "net amount", "paid amount");
    let remitted: number;
    if (netCodRaw) {
      remitted = pkrToPaisa(netCodRaw);
    } else {
      remitted = isRto ? 0 : Math.max(0, cod - feeDel - feeGst - feeWht);
    }

    const orderRef = normalizeOrderId(
      getField(r, "order ref", "customer ref", "ref#", "order id")
    );

    rows.push({
      awb: cn,
      cn,
      order_ref: orderRef,
      remitted_paisa: remitted,
      fee_delivery_paisa: feeDel,
      fee_return_paisa: isRto ? feeDel : 0,
      fee_gst_paisa: feeGst,
      fee_wht_paisa: feeWht,
      fee_cash_handling_paisa: 0,
      fee_other_paisa: 0,
      cod_booked_paisa: cod,
      settled_at: parseDateLoose(getField(r, "payment date", "settlement date", "date")),
      settlement_id: getField(r, "voucher no", "payment ref", "voucher_no"),
      delivery_status: status,
      settle_flag: !isRto && remitted > 0,
      raw: r,
    });
  });

  return { rows, errors };
}
