import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paisaToPkr } from "@/lib/money";

export async function GET() {
  try {
    const user = await requireUser();
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT m.status, m.awb, m.cn, m.expected_paisa, m.remitted_paisa, m.short_paisa,
                m.reference_date, m.notes, c.code as courier,
                o.external_order_id, o.customer_name
         FROM matches m
         LEFT JOIN couriers c ON c.id = m.courier_id
         LEFT JOIN orders o ON o.id = m.order_id
         WHERE m.org_id = ?
           AND m.match_run_id = (
             SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
           )
         ORDER BY m.status, c.code`
      )
      .all(user.org_id, user.org_id) as Array<Record<string, unknown>>;

    const header = [
      "status",
      "courier",
      "order_id",
      "awb",
      "cn",
      "customer",
      "expected_pkr",
      "remitted_pkr",
      "short_pkr",
      "reference_date",
      "notes",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [
        r.status,
        r.courier || "",
        r.external_order_id || "",
        r.awb || "",
        r.cn || "",
        csvEscape(String(r.customer_name || "")),
        paisaToPkr(Number(r.expected_paisa || 0)).toFixed(2),
        paisaToPkr(Number(r.remitted_paisa || 0)).toFixed(2),
        paisaToPkr(Number(r.short_paisa || 0)).toFixed(2),
        r.reference_date || "",
        csvEscape(String(r.notes || "")),
      ];
      lines.push(cells.join(","));
    }
    const body = lines.join("\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="codbooks-receivable.csv"',
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
