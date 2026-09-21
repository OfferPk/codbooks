import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const status = req.nextUrl.searchParams.get("status");
    const db = getDb();
    let sql = `
      SELECT m.*, c.code as courier_code, c.name as courier_name,
             o.external_order_id, o.customer_name
      FROM matches m
      LEFT JOIN couriers c ON c.id = m.courier_id
      LEFT JOIN orders o ON o.id = m.order_id
      WHERE m.org_id = ?
        AND m.match_run_id = (
          SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
        )`;
    const params: string[] = [user.org_id, user.org_id];
    if (status) {
      sql += ` AND m.status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY m.status, m.short_paisa DESC LIMIT 500`;
    const rows = db.prepare(sql).all(...params);
    const runs = db
      .prepare(
        `SELECT id, created_at, summary_json FROM match_runs
         WHERE org_id = ? ORDER BY created_at DESC LIMIT 5`
      )
      .all(user.org_id);
    return NextResponse.json({ matches: rows, runs });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
