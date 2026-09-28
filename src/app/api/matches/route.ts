import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const status = req.nextUrl.searchParams.get("status")?.trim() || "";
    const q = req.nextUrl.searchParams.get("q")?.trim() || "";
    const courier = req.nextUrl.searchParams.get("courier")?.trim() || "";
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
    if (courier) {
      sql += ` AND LOWER(c.code) = LOWER(?)`;
      params.push(courier);
    }
    if (q) {
      sql += ` AND (
        LOWER(COALESCE(m.awb, '')) LIKE ?
        OR LOWER(COALESCE(m.cn, '')) LIKE ?
        OR LOWER(COALESCE(o.external_order_id, '')) LIKE ?
        OR LOWER(COALESCE(o.customer_name, '')) LIKE ?
      )`;
      const like = `%${q.toLowerCase()}%`;
      params.push(like, like, like, like);
    }
    sql += ` ORDER BY m.status, m.short_paisa DESC LIMIT 500`;
    const rows = db.prepare(sql).all(...params);
    const runs = db
      .prepare(
        `SELECT id, created_at, summary_json FROM match_runs
         WHERE org_id = ? ORDER BY created_at DESC LIMIT 5`
      )
      .all(user.org_id);
    const couriers = db
      .prepare(
        `SELECT DISTINCT LOWER(c.code) as code
         FROM matches m
         JOIN couriers c ON c.id = m.courier_id
         WHERE m.org_id = ?
           AND m.match_run_id = (
             SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1
           )
         ORDER BY code`
      )
      .all(user.org_id, user.org_id) as Array<{ code: string }>;
    return NextResponse.json({
      matches: rows,
      runs,
      couriers: couriers.map((c) => c.code).filter(Boolean),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
