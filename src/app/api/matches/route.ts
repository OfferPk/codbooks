import { NextRequest, NextResponse } from "next/server";
import { agingBucketFromDate, type AgingBucketKey } from "@/lib/aging";
import { AuthError, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { escapeLikePattern } from "@/lib/like";

const AGING_KEYS = new Set<AgingBucketKey>(["<7", "7-14", ">14"]);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const status = req.nextUrl.searchParams.get("status")?.trim() || "";
    const q = req.nextUrl.searchParams.get("q")?.trim() || "";
    const courier = req.nextUrl.searchParams.get("courier")?.trim() || "";
    const agingRaw = req.nextUrl.searchParams.get("aging")?.trim() || "";
    const aging = AGING_KEYS.has(agingRaw as AgingBucketKey)
      ? (agingRaw as AgingBucketKey)
      : "";

    let targetShopId: string | null = null;
    if (user.role === "staff") {
      targetShopId = user.shop_id || null;
    } else {
      targetShopId = req.nextUrl.searchParams.get("shopId") || user.shop_id || null;
    }

    const db = getDb();
    const runSubquery = targetShopId
      ? `(SELECT id FROM match_runs WHERE org_id = ? AND (shop_id = ? OR shop_id IS NULL) ORDER BY created_at DESC LIMIT 1)`
      : `(SELECT id FROM match_runs WHERE org_id = ? ORDER BY created_at DESC LIMIT 1)`;

    let sql = `
      SELECT m.*, c.code as courier_code, c.name as courier_name,
             o.external_order_id, o.customer_name
      FROM matches m
      LEFT JOIN couriers c ON c.id = m.courier_id
      LEFT JOIN orders o ON o.id = m.order_id
      WHERE m.org_id = ?
        AND m.match_run_id = ${runSubquery}`;
    const params: string[] = targetShopId
      ? [user.org_id, user.org_id, targetShopId]
      : [user.org_id, user.org_id];

    if (targetShopId) {
      sql += ` AND (m.shop_id = ? OR m.shop_id IS NULL)`;
      params.push(targetShopId);
    }

    // Aging contract: when aging is set and status omitted, restrict to unpaid|short
    // (same set as the Aging board). Explicit status still applies when provided.
    if (aging && !status) {
      sql += ` AND m.status IN ('unpaid', 'short')`;
    } else if (status) {
      sql += ` AND m.status = ?`;
      params.push(status);
    }

    if (courier) {
      sql += ` AND LOWER(c.code) = LOWER(?)`;
      params.push(courier);
    }
    if (q) {
      // Literal substring: escape % _ \ then LIKE … ESCAPE '\'
      sql += ` AND (
        LOWER(COALESCE(m.awb, '')) LIKE ? ESCAPE '\\'
        OR LOWER(COALESCE(m.cn, '')) LIKE ? ESCAPE '\\'
        OR LOWER(COALESCE(o.external_order_id, '')) LIKE ? ESCAPE '\\'
        OR LOWER(COALESCE(o.customer_name, '')) LIKE ? ESCAPE '\\'
      )`;
      const like = `%${escapeLikePattern(q.toLowerCase())}%`;
      params.push(like, like, like, like);
    }
    // No SQL LIMIT when aging filters in JS (avoid truncating before bucket filter).
    if (!aging) {
      sql += ` ORDER BY m.status, m.short_paisa DESC LIMIT 500`;
    } else {
      sql += ` ORDER BY m.status, m.short_paisa DESC`;
    }

    let rows = db.prepare(sql).all(...params) as Array<{
      status: string;
      reference_date: string | null;
      [key: string]: unknown;
    }>;

    if (aging) {
      rows = rows
        .filter((r) => agingBucketFromDate(r.reference_date) === aging)
        .slice(0, 500);
    }

    const runs = targetShopId
      ? db
          .prepare(
            `SELECT id, created_at, summary_json FROM match_runs
             WHERE org_id = ? AND (shop_id = ? OR shop_id IS NULL) ORDER BY created_at DESC LIMIT 5`
          )
          .all(user.org_id, targetShopId)
      : db
          .prepare(
            `SELECT id, created_at, summary_json FROM match_runs
             WHERE org_id = ? ORDER BY created_at DESC LIMIT 5`
          )
          .all(user.org_id);

    const couriers = targetShopId
      ? (db
          .prepare(
            `SELECT DISTINCT LOWER(c.code) as code
             FROM matches m
             JOIN couriers c ON c.id = m.courier_id
             WHERE m.org_id = ?
               AND (m.shop_id = ? OR m.shop_id IS NULL)
               AND m.match_run_id = ${runSubquery}
             ORDER BY code`
          )
          .all(user.org_id, targetShopId, user.org_id, targetShopId) as Array<{
          code: string;
        }>)
      : (db
          .prepare(
            `SELECT DISTINCT LOWER(c.code) as code
             FROM matches m
             JOIN couriers c ON c.id = m.courier_id
             WHERE m.org_id = ?
               AND m.match_run_id = ${runSubquery}
             ORDER BY code`
          )
          .all(user.org_id, user.org_id) as Array<{ code: string }>);
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
