import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAction } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paisaToPkr } from "@/lib/money";
import { csvLine } from "@/lib/csv";

const VALID_STATUSES = new Set([
  "matched",
  "short",
  "unpaid",
  "unmatched",
  "double_paid",
]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireAction("export");
    const statusParam = req.nextUrl.searchParams.get("status")?.trim() || "";
    const from = req.nextUrl.searchParams.get("from")?.trim() || "";
    const to = req.nextUrl.searchParams.get("to")?.trim() || "";

    const statuses = statusParam
      ? statusParam
          .split(",")
          .map((s) => s.trim())
          .filter((s) => VALID_STATUSES.has(s))
      : [];

    if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return NextResponse.json(
        { error: "from must be YYYY-MM-DD" },
        { status: 400 }
      );
    }
    if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json(
        { error: "to must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const db = getDb();
    let sql = `
         SELECT m.status, m.awb, m.cn, m.expected_paisa, m.remitted_paisa, m.short_paisa,
                m.reference_date, m.notes, c.code as courier,
                o.external_order_id, o.customer_name
         FROM matches m
         LEFT JOIN couriers c ON c.id = m.courier_id
         LEFT JOIN orders o ON o.id = m.order_id
         WHERE m.org_id = ?
           AND m.match_run_id = (
             SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
           )`;
    const params: string[] = [user.org_id, user.org_id];

    if (statuses.length === 1) {
      sql += ` AND m.status = ?`;
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      sql += ` AND m.status IN (${statuses.map(() => "?").join(",")})`;
      params.push(...statuses);
    }

    // reference_date compared as ISO prefix / date string (YYYY-MM-DD…)
    if (from) {
      sql += ` AND m.reference_date IS NOT NULL AND substr(m.reference_date, 1, 10) >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND m.reference_date IS NOT NULL AND substr(m.reference_date, 1, 10) <= ?`;
      params.push(to);
    }

    sql += ` ORDER BY m.status, c.code`;

    const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

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
    const lines = [csvLine(header)];
    for (const r of rows) {
      lines.push(
        csvLine([
          r.status,
          r.courier || "",
          r.external_order_id || "",
          r.awb || "",
          r.cn || "",
          r.customer_name || "",
          paisaToPkr(Number(r.expected_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.remitted_paisa || 0)).toFixed(2),
          paisaToPkr(Number(r.short_paisa || 0)).toFixed(2),
          r.reference_date || "",
          r.notes || "",
        ])
      );
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
