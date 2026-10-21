import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import type { OrgType, Role, SessionUser } from "./types";

const SESSION_COOKIE = "codbooks_session";
const SESSION_DAYS = 14;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createSession(
  userId: string,
  orgId: string,
  activeShopId?: string | null
): string {
  const db = getDb();
  const id = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);

  // If activeShopId not provided, default to org's default shop
  let shopId = activeShopId;
  if (!shopId) {
    const defaultShop = db
      .prepare("SELECT id FROM shops WHERE org_id = ? AND is_default = 1 LIMIT 1")
      .get(orgId) as { id: string } | undefined;
    shopId = defaultShop?.id || null;
  }

  db.prepare(
    "INSERT INTO sessions (id, user_id, org_id, active_shop_id, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, userId, orgId, shopId, expires.toISOString());
  return id;
}

export function destroySession(sessionId: string) {
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, s.org_id, s.expires_at, s.active_shop_id as shop_id,
              o.name as org_name, o.type as org_type, m.role,
              sh.name as shop_name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN orgs o ON o.id = s.org_id
       JOIN memberships m ON m.user_id = u.id AND m.org_id = s.org_id
       LEFT JOIN shops sh ON sh.id = s.active_shop_id
       WHERE s.id = ?`
    )
    .get(sessionId) as
    | {
        id: string;
        email: string;
        name: string;
        org_id: string;
        org_name: string;
        org_type: OrgType;
        role: Role;
        expires_at: string;
        shop_id: string | null;
        shop_name: string | null;
      }
    | undefined;

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    org_id: row.org_id,
    org_name: row.org_name,
    org_type: row.org_type,
    role: row.role,
    shop_id: row.shop_id || null,
    shop_name: row.shop_name || null,
  };
}

type HeaderLike = { get(name: string): string | null };

export function shouldUseSecureCookie(headers?: HeaderLike | null): boolean {
  const env = process.env.COOKIE_SECURE;
  if (env === "false" || env === "0") return false;
  if (env === "true" || env === "1") return true;
  if (headers) {
    const proto = headers.get("x-forwarded-proto");
    if (proto) {
      return proto.split(",")[0].trim().toLowerCase() === "https";
    }
  }
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(
  sessionId: string,
  headers?: HeaderLike | null
) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(headers),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(headers?: HeaderLike | null) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(headers),
    path: "/",
    maxAge: 0,
  });
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Unauthorized", 401);
  return user;
}

export async function requireRoles(
  ...roles: Role[]
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthError("Forbidden", 403);
  }
  return user;
}

/** Action → allowed roles. Staff cannot delete or change settings. */
export const ROLE_MATRIX = {
  mutate: ["owner", "ops", "staff"] as Role[],
  export: ["owner", "ops", "accountant", "staff"] as Role[],
  audit: ["owner", "accountant"] as Role[],
  read: ["owner", "ops", "accountant", "staff"] as Role[],
  settings: ["owner"] as Role[],
  delete: ["owner"] as Role[],
} as const;

export async function requireAction(
  action: keyof typeof ROLE_MATRIX
): Promise<SessionUser> {
  return requireRoles(...ROLE_MATRIX[action]);
}
