import { NextRequest, NextResponse } from "next/server";
import { AuthError, hashPassword, requireRoles } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/rate-limit";
import type { Role } from "@/lib/types";

const INVITE_ROLES: Role[] = ["ops", "accountant"];

export async function GET() {
  try {
    const user = await requireRoles("owner");
    const rows = getDb()
      .prepare(
        `SELECT m.id as membership_id, m.role, u.id, u.email, u.name, u.created_at
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.org_id = ?
         ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'ops' THEN 1 ELSE 2 END, u.name`
      )
      .all(user.org_id);
    return NextResponse.json({ users: rows });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireRoles("owner");
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = String(body.role || "").trim() as Role;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password required" },
        { status: 400 }
      );
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        },
        { status: 400 }
      );
    }
    if (!INVITE_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Role must be ops or accountant" },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();
    let userId: string;
    let attachedExisting = false;
    const existing = db
      .prepare("SELECT id, name FROM users WHERE email = ?")
      .get(email) as { id: string; name: string } | undefined;

    if (existing) {
      userId = existing.id;
      const mem = db
        .prepare(
          `SELECT id FROM memberships WHERE org_id = ? AND user_id = ?`
        )
        .get(actor.org_id, userId);
      if (mem) {
        return NextResponse.json(
          { error: "User already in this organization" },
          { status: 409 }
        );
      }
      attachedExisting = true;
    } else {
      userId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
      ).run(userId, email, hashPassword(password), name, now);
    }

    const membershipId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`
    ).run(membershipId, actor.org_id, userId, role);

    return NextResponse.json(
      {
        user: {
          id: userId,
          email,
          name: attachedExisting ? existing!.name : name,
          role,
          membership_id: membershipId,
          attached_existing: attachedExisting,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
