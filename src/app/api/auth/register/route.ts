import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  checkRateLimit,
  MIN_PASSWORD_LENGTH,
  recordRateLimitFailure,
} from "@/lib/rate-limit";

function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const orgName = String(body.org_name || "").trim() || `${name}'s Store`;

    const ip = clientIp(req);
    const ipKey = `register:ip:${ip}`;
    const lim = checkRateLimit(ipKey);
    if (!lim.ok) {
      return NextResponse.json(
        {
          error: `Too many registration attempts. Try again in ${lim.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(lim.retryAfterSec) },
        }
      );
    }

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
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);
    if (existing) {
      recordRateLimitFailure(ipKey);
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
