import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireRoles } from "@/lib/auth";
import { getDb } from "@/lib/db";

const NOTES_MAX = 500;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRoles("owner", "ops");
    const { id } = await ctx.params;
    const matchId = String(id || "").trim();
    if (!matchId) {
      return NextResponse.json({ error: "Match id required" }, { status: 400 });
    }

    const body = await req.json();
    if (body.notes === undefined || body.notes === null) {
      return NextResponse.json({ error: "notes required" }, { status: 400 });
    }
    const notes = String(body.notes);
    if (notes.length > NOTES_MAX) {
      return NextResponse.json(
        { error: `notes max length is ${NOTES_MAX}` },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare(`SELECT id, org_id FROM matches WHERE id = ?`)
      .get(matchId) as { id: string; org_id: string } | undefined;
    if (!row || row.org_id !== user.org_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    db.prepare(`UPDATE matches SET notes = ? WHERE id = ? AND org_id = ?`).run(
      notes,
      matchId,
      user.org_id
    );

    const updated = db
      .prepare(
        `SELECT m.*, c.code as courier_code, o.external_order_id, o.customer_name
         FROM matches m
         LEFT JOIN couriers c ON c.id = m.courier_id
         LEFT JOIN orders o ON o.id = m.order_id
         WHERE m.id = ? AND m.org_id = ?`
      )
      .get(matchId, user.org_id);

    return NextResponse.json({ match: updated });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
