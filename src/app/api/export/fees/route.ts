import { NextResponse } from "next/server";
import { AuthError, requireAction } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paisaToPkr } from "@/lib/money";
import { csvLine } from "@/lib/csv";

export async function GET() {
  try {
    const user = await requireAction("export");
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT s.awb, s.cn, s.order_ref, s.settlement_id, s.settled_at,
                s.cod_booked_paisa, s.remitted_paisa,
                s.fee_delivery_paisa, s.fee_return_paisa, s.fee_gst_paisa,
                s.fee_wht_paisa, s.fee_cash_handling_paisa, s.fee_other_paisa,
                c.code as courier
         FROM settlement_lines s
         JOIN couriers c ON c.id = s.courier_id
         WHERE s.org_id = ?
         ORDER BY c.code, s.settled_at`
      )
      .all(user.org_id) as Array<Record<string, unknown>>;

    const header = [
      "courier",
      "awb",
      "cn",
      "order_ref",
      "settlement_id",
      "settled_at",
      "cod_booked_pkr",
      "remitted_pkr",
      "fee_delivery_pkr",
      "fee_return_pkr",
      "fee_gst_pkr",
      "fee_wht_pkr",
      "fee_cash_handling_pkr",
      "fee_other_pkr",
      "fees_total_pkr",
    ];
    const lines = [csvLine(header)];
    for (const r of rows) {
      const fees =
        Number(r.fee_delivery_paisa || 0) +
        Number(r.fee_return_paisa || 0) +
        Number(r.fee_gst_paisa || 0) +
        Number(r.fee_wht_paisa || 0) +
        Number(r.fee_cash_handling_paisa || 0) +
        Number(r.fee_other_paisa || 0);
      const remitted = Number(r.remitted_paisa || 0);
      lines.push(
        csvLine([
          r.courier,
          r.awb || "",
          r.cn || "",
          r.order_ref || "",
          r.settlement_id || "",
          r.settled_at || "",
          paisaToPkr(Number(r.cod_booked_paisa || 0)).toFixed(2),
          paisaToPkr(remitted < 0 ? 0 : remitted).toFixed(2),
          paisaToPkr(Number(r.fee_delivery_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.fee_return_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.fee_gst_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.fee_wht_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.fee_cash_handling_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.fee_other_paisa || 0)).toFixed(2),
          paisaToPkr(fees).toFixed(2),
        ])
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="codbooks-fees.csv"',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
