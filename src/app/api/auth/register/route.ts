import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const orgName = String(body.org_name || "").trim() || `${name}'s Store`;
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO orgs (id, name, type, created_at) VALUES (?, ?, 'seller', ?)`
      ).run(orgId, orgName, now);
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
      ).run(userId, email, hashPassword(password), name, now);
      db.prepare(
        `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`
      ).run(crypto.randomUUID(), orgId, userId);
    });
    tx();
    const sessionId = createSession(userId, orgId);
    await setSessionCookie(sessionId, req.headers);
    return NextResponse.json({
      ok: true,
      user: {
        id: userId,
        email,
        name,
        role: "owner",
        org_id: orgId,
        org_name: orgName,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Register failed" }, { status: 500 });
  }
}
