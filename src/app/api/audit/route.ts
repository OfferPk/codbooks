import { NextResponse } from "next/server";
import { AuthError, requireRoles } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireRoles("owner", "accountant");
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT a.*, u.name as user_name, u.email as user_email
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.org_id = ?
         ORDER BY a.created_at DESC
         LIMIT 200`
      )
      .all(user.org_id);
    return NextResponse.json({ events: rows });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
