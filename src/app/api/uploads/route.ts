import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRoles, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ingestOrders, ingestCpr } from "@/lib/ingest";
import { runMatch } from "@/lib/match";

export async function GET() {
  try {
    const user = await requireUser();
    const db = getDb();
    const rows = user.shop_id
      ? db
          .prepare(
            `SELECT u.*, c.code as courier_code, usr.name as uploaded_by_name
             FROM uploads u
             LEFT JOIN couriers c ON c.id = u.courier_id
             LEFT JOIN users usr ON usr.id = u.uploaded_by
             WHERE u.org_id = ? AND (u.shop_id = ? OR u.shop_id IS NULL)
             ORDER BY u.created_at DESC
             LIMIT 100`
          )
          .all(user.org_id, user.shop_id)
      : db
          .prepare(
            `SELECT u.*, c.code as courier_code, usr.name as uploaded_by_name
             FROM uploads u
             LEFT JOIN couriers c ON c.id = u.courier_id
             LEFT JOIN users usr ON usr.id = u.uploaded_by
             WHERE u.org_id = ?
             ORDER BY u.created_at DESC
             LIMIT 100`
          )
          .all(user.org_id);
    return NextResponse.json({ uploads: rows });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRoles("owner", "ops");
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind") || "orders");
    const courierHint = String(form.get("courier") || "");
    const autoMatch = String(form.get("auto_match") || "true") !== "false";
    const shopIdParam = form.get("shop_id") ? String(form.get("shop_id")) : null;
    const shopId = user.shop_id || shopIdParam || null;

    if (!file) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const text = await file.text();
    const filename = file.name || "upload.csv";

    if (kind === "orders") {
      const result = ingestOrders(
        user.org_id,
        user.id,
        filename,
        text,
        courierHint || undefined,
        shopId
      );
      let match = null;
      if (autoMatch && result.rowCount > 0) {
        match = runMatch(user.org_id, user.id);
      }
      return NextResponse.json({ ok: true, kind: "orders", ...result, match });
    }

    if (kind === "cpr") {
      const result = ingestCpr(
        user.org_id,
        user.id,
        filename,
        text,
        courierHint || undefined,
        shopId
      );
      let match = null;
      if (autoMatch && result.rowCount > 0) {
        match = runMatch(user.org_id, user.id);
      }
      return NextResponse.json({ ok: true, kind: "cpr", ...result, match });
    }

    return NextResponse.json(
      { error: "kind must be orders or cpr" },
      { status: 400 }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
