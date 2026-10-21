import { getDb } from "./db";
import type { Shop } from "./types";

export function createShop(
  orgId: string,
  name: string,
  code?: string,
  isDefault: boolean = false
): Shop {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // If this shop is marked default, unset default from other shops in org
  if (isDefault) {
    db.prepare("UPDATE shops SET is_default = 0 WHERE org_id = ?").run(orgId);
  }

  db.prepare(
    `INSERT INTO shops (id, org_id, name, code, is_default, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, orgId, name.trim(), code ? code.trim() : null, isDefault ? 1 : 0, now);

  return {
    id,
    org_id: orgId,
    name: name.trim(),
    code: code ? code.trim() : null,
    is_default: isDefault,
    created_at: now,
  };
}

export function listShops(orgId: string): Shop[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, org_id, name, code, is_default, created_at
       FROM shops WHERE org_id = ? ORDER BY is_default DESC, name ASC`
    )
    .all(orgId) as Array<{
    id: string;
    org_id: string;
    name: string;
    code: string | null;
    is_default: number;
    created_at: string;
  }>;

  return rows.map((r) => ({
    ...r,
    is_default: Boolean(r.is_default),
  }));
}

export function getShop(shopId: string, orgId?: string): Shop | null {
  const db = getDb();
  const sql = orgId
    ? "SELECT * FROM shops WHERE id = ? AND org_id = ?"
    : "SELECT * FROM shops WHERE id = ?";
  const params = orgId ? [shopId, orgId] : [shopId];
  const row = db.prepare(sql).get(...params) as
    | {
        id: string;
        org_id: string;
        name: string;
        code: string | null;
        is_default: number;
        created_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    ...row,
    is_default: Boolean(row.is_default),
  };
}

export function getDefaultShop(orgId: string): Shop {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM shops WHERE org_id = ? AND is_default = 1 LIMIT 1")
    .get(orgId) as
    | {
        id: string;
        org_id: string;
        name: string;
        code: string | null;
        is_default: number;
        created_at: string;
      }
    | undefined;
  if (row) {
    return { ...row, is_default: true };
  }
  // Create if missing
  return createShop(orgId, "Default Shop", "default", true);
}

export function setDefaultShop(shopId: string, orgId: string) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE shops SET is_default = 0 WHERE org_id = ?").run(orgId);
    db.prepare("UPDATE shops SET is_default = 1 WHERE id = ? AND org_id = ?").run(
      shopId,
      orgId
    );
  })();
}
