import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  checkRateLimit,
  clearRateLimit,
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
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const ip = clientIp(req);
    const ipKey = `login:ip:${ip}`;
    const emailKey = `login:email:${email}`;
    for (const key of [ipKey, emailKey]) {
      const lim = checkRateLimit(key);
      if (!lim.ok) {
        return NextResponse.json(
          {
            error: `Too many failed login attempts. Try again in ${lim.retryAfterSec}s.`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(lim.retryAfterSec) },
          }
        );
      }
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, password_hash, name FROM users WHERE email = ?")
      .get(email) as
      | { id: string; password_hash: string; name: string }
      | undefined;
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordRateLimitFailure(ipKey);
      recordRateLimitFailure(emailKey);
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }
    const membership = db
      .prepare(
        `SELECT m.org_id, m.role, o.name as org_name
         FROM memberships m JOIN orgs o ON o.id = m.org_id
         WHERE m.user_id = ? ORDER BY m.role = 'owner' DESC LIMIT 1`
      )
      .get(user.id) as
      | { org_id: string; role: string; org_name: string }
      | undefined;
    if (!membership) {
      return NextResponse.json(
        { error: "No organization membership" },
        { status: 403 }
      );
    }
    clearRateLimit(ipKey);
    clearRateLimit(emailKey);
    const sessionId = createSession(user.id, membership.org_id);
    await setSessionCookie(sessionId, req.headers);
    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email,
        name: user.name,
        role: membership.role,
        org_id: membership.org_id,
        org_name: membership.org_name,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
