import Database from "better-sqlite3";
import path from "path";
import { chmodDbArtifacts, ensurePrivateDir } from "./fs-perms";

const DEFAULT_PATH = path.join(process.cwd(), "data", "codbooks.db");

let dbInstance: Database.Database | null = null;

function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_PATH;
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return DEFAULT_PATH;
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  ensurePrivateDir(dir);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  chmodDbArtifacts(dbPath);
  dbInstance = db;
  return db;
}

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('seller','firm')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('owner','ops','accountant','staff')),
      UNIQUE(org_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS firm_clients (
      id TEXT PRIMARY KEY,
      firm_org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      client_org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      UNIQUE(firm_org_id, client_org_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      active_shop_id TEXT REFERENCES shops(id),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS couriers (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS courier_templates (
      id TEXT PRIMARY KEY,
      courier_id TEXT NOT NULL REFERENCES couriers(id),
      version TEXT NOT NULL,
      column_map_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('orders','cpr')),
      courier_id TEXT REFERENCES couriers(id),
      storage_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      error_summary TEXT,
      template_hint TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      upload_id TEXT REFERENCES uploads(id),
      courier_id TEXT REFERENCES couriers(id),
      external_order_id TEXT,
      awb TEXT,
      cn TEXT,
      customer_name TEXT,
      order_amount_paisa INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'PKR',
      ordered_at TEXT,
      source TEXT,
      status TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES orders(id),
      awb TEXT,
      cn TEXT,
      courier_id TEXT REFERENCES couriers(id),
      status TEXT,
      cod_amount_paisa INTEGER NOT NULL DEFAULT 0,
      shipped_at TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settlement_lines (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      courier_id TEXT NOT NULL REFERENCES couriers(id),
      awb TEXT,
      cn TEXT,
      order_ref TEXT,
      remitted_paisa INTEGER NOT NULL DEFAULT 0,
      fee_delivery_paisa INTEGER NOT NULL DEFAULT 0,
      fee_return_paisa INTEGER NOT NULL DEFAULT 0,
      fee_gst_paisa INTEGER NOT NULL DEFAULT 0,
      fee_wht_paisa INTEGER NOT NULL DEFAULT 0,
      fee_cash_handling_paisa INTEGER NOT NULL DEFAULT 0,
      fee_other_paisa INTEGER NOT NULL DEFAULT 0,
      cod_booked_paisa INTEGER NOT NULL DEFAULT 0,
      settled_at TEXT,
      settlement_id TEXT,
      delivery_status TEXT,
      raw_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_runs (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      summary_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      match_run_id TEXT NOT NULL REFERENCES match_runs(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      shipment_id TEXT REFERENCES shipments(id),
      settlement_line_id TEXT REFERENCES settlement_lines(id),
      order_id TEXT REFERENCES orders(id),
      status TEXT NOT NULL CHECK(status IN ('matched','short','unpaid','unmatched','double_paid')),
      expected_paisa INTEGER NOT NULL DEFAULT 0,
      remitted_paisa INTEGER NOT NULL DEFAULT 0,
      short_paisa INTEGER NOT NULL DEFAULT 0,
      courier_id TEXT REFERENCES couriers(id),
      awb TEXT,
      cn TEXT,
      notes TEXT,
      reference_date TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(org_id);
    CREATE INDEX IF NOT EXISTS idx_orders_awb ON orders(org_id, awb);
    CREATE INDEX IF NOT EXISTS idx_orders_cn ON orders(org_id, cn);
    CREATE INDEX IF NOT EXISTS idx_orders_ext ON orders(org_id, external_order_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_org ON shipments(org_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_org ON settlement_lines(org_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_awb ON settlement_lines(org_id, awb);
    CREATE INDEX IF NOT EXISTS idx_matches_run ON matches(match_run_id);
    CREATE INDEX IF NOT EXISTS idx_matches_org ON matches(org_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_events(org_id);
  `);

  // Additive column migrations
  function ensureColumn(table: string, colName: string, colDef: string) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>;
    if (!cols.some((c) => c.name === colName)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef}`);
    }
  }

  ensureColumn("orders", "courier_id", "TEXT REFERENCES couriers(id)");
  ensureColumn("orders", "shop_id", "TEXT REFERENCES shops(id)");
  ensureColumn("shipments", "shop_id", "TEXT REFERENCES shops(id)");
  ensureColumn("settlement_lines", "shop_id", "TEXT REFERENCES shops(id)");
  ensureColumn("uploads", "shop_id", "TEXT REFERENCES shops(id)");
  ensureColumn("matches", "shop_id", "TEXT REFERENCES shops(id)");
  ensureColumn("match_runs", "shop_id", "TEXT REFERENCES shops(id)");
  ensureColumn("sessions", "active_shop_id", "TEXT REFERENCES shops(id)");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shops_org ON shops(org_id);
    CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
    CREATE INDEX IF NOT EXISTS idx_shipments_shop ON shipments(shop_id);
    CREATE INDEX IF NOT EXISTS idx_settlement_shop ON settlement_lines(shop_id);
    CREATE INDEX IF NOT EXISTS idx_matches_shop ON matches(shop_id);
  `);

  // Backfill default shops for existing orgs and update records with NULL shop_id
  const orgRows = db
    .prepare("SELECT id, name, created_at FROM orgs")
    .all() as Array<{
    id: string;
    name: string;
    created_at: string;
  }>;

  for (const org of orgRows) {
    const existingDefault = db
      .prepare(
        "SELECT id FROM shops WHERE org_id = ? AND is_default = 1 LIMIT 1"
      )
      .get(org.id) as { id: string } | undefined;

    let defaultShopId = existingDefault?.id;
    if (!defaultShopId) {
      defaultShopId = `shop_default_${org.id}`;
      db.prepare(
        `INSERT OR IGNORE INTO shops (id, org_id, name, code, is_default, created_at)
         VALUES (?, ?, ?, 'default', 1, ?)`
      ).run(
        defaultShopId,
        org.id,
        `${org.name} Main Shop`,
        org.created_at || new Date().toISOString()
      );
    }

    db.prepare(
      "UPDATE orders SET shop_id = ? WHERE org_id = ? AND shop_id IS NULL"
    ).run(defaultShopId, org.id);
    db.prepare(
      "UPDATE shipments SET shop_id = ? WHERE org_id = ? AND shop_id IS NULL"
    ).run(defaultShopId, org.id);
    db.prepare(
      "UPDATE settlement_lines SET shop_id = ? WHERE org_id = ? AND shop_id IS NULL"
    ).run(defaultShopId, org.id);
    db.prepare(
      "UPDATE uploads SET shop_id = ? WHERE org_id = ? AND shop_id IS NULL"
    ).run(defaultShopId, org.id);
    db.prepare(
      "UPDATE matches SET shop_id = ? WHERE org_id = ? AND shop_id IS NULL"
    ).run(defaultShopId, org.id);
    db.prepare(
      "UPDATE match_runs SET shop_id = ? WHERE org_id = ? AND shop_id IS NULL"
    ).run(defaultShopId, org.id);
  }

  // Seed courier catalog if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM couriers").get() as {
    c: number;
  };
  if (count.c === 0) {
    db.prepare(
      "INSERT INTO couriers (id, code, name) VALUES (?, ?, ?)"
    ).run("courier_tcs", "tcs", "TCS");
    db.prepare(
      "INSERT INTO couriers (id, code, name) VALUES (?, ?, ?)"
    ).run("courier_postex", "postex", "PostEx");

    db.prepare(
      `INSERT INTO courier_templates (id, courier_id, version, column_map_json)
       VALUES (?, ?, ?, ?)`
    ).run(
      "tpl_tcs_invoice",
      "courier_tcs",
      "payment-invoice-v1",
      JSON.stringify({
        awb: "cnsg_no",
        cn: "cnsg_no",
        order_ref: "cust_ref",
        cod_booked: "codamount",
        fee_delivery: "courier_charges",
        fee_gst: "gst",
        settlement_id: "invoiceno",
        delivery_status: "status",
        payment_period: "paymentperiod",
      })
    );
    db.prepare(
      `INSERT INTO courier_templates (id, courier_id, version, column_map_json)
       VALUES (?, ?, ?, ?)`
    ).run(
      "tpl_tcs_detail",
      "courier_tcs",
      "payment-detail-v1",
      JSON.stringify({
        awb: "cn by courier",
        cn: "cn by courier",
        order_ref: "order no",
        remitted: "amount paid",
        fee_delivery: "delivery charges",
        delivery_status: "cn status",
        settled_at: "payment date",
      })
    );
    db.prepare(
      `INSERT INTO courier_templates (id, courier_id, version, column_map_json)
       VALUES (?, ?, ?, ?)`
    ).run(
      "tpl_postex_v1",
      "courier_postex",
      "payment-status-v1",
      JSON.stringify({
        awb: "trackingNumber",
        cn: "trackingNumber",
        order_ref: "orderRefNumber",
        settle: "settle",
        settled_at: "settlementDate",
        settlement_id: "cprNumber_1",
      })
    );
  }
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function getCourierIdByCode(code: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM couriers WHERE code = ?")
    .get(code) as { id: string } | undefined;
  return row?.id ?? null;
}

export function audit(
  orgId: string,
  userId: string | null,
  action: string,
  meta: Record<string, unknown> = {}
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_events (id, org_id, user_id, action, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    orgId,
    userId,
    action,
    JSON.stringify(meta),
    new Date().toISOString()
  );
}
