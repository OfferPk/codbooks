import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-test-multishop-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
);

let sessionCookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "codbooks_session" && sessionCookie
        ? { value: sessionCookie }
        : undefined,
    set: () => {},
  }),
}));

describe("Multi-Shop Support & Role Isolation (Issue #6)", () => {
  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;
  let migrate: typeof import("@/lib/db").migrate;
  let createShop: typeof import("@/lib/shops").createShop;
  let listShops: typeof import("@/lib/shops").listShops;
  let getShop: typeof import("@/lib/shops").getShop;
  let getDefaultShop: typeof import("@/lib/shops").getDefaultShop;
  let setDefaultShop: typeof import("@/lib/shops").setDefaultShop;
  let ROLE_MATRIX: typeof import("@/lib/auth").ROLE_MATRIX;
  let requireAction: typeof import("@/lib/auth").requireAction;
  let createSession: typeof import("@/lib/auth").createSession;
  let getSessionUser: typeof import("@/lib/auth").getSessionUser;
  let postUsers: typeof import("@/app/api/users/route").POST;

  let orgAId: string;
  let orgBId: string;
  let ownerAId: string;
  let staffAId: string;
  let ownerASession: string;
  let staffASession: string;

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    const dbMod = await import("@/lib/db");
    closeDb = dbMod.closeDb;
    getDb = dbMod.getDb;
    migrate = dbMod.migrate;

    const shopsMod = await import("@/lib/shops");
    createShop = shopsMod.createShop;
    listShops = shopsMod.listShops;
    getShop = shopsMod.getShop;
    getDefaultShop = shopsMod.getDefaultShop;
    setDefaultShop = shopsMod.setDefaultShop;

    const authMod = await import("@/lib/auth");
    ROLE_MATRIX = authMod.ROLE_MATRIX;
    requireAction = authMod.requireAction;
    createSession = authMod.createSession;
    getSessionUser = authMod.getSessionUser;

    postUsers = (await import("@/app/api/users/route")).POST;

    // Initial setup with clean database
    closeDb();
    const db = getDb();
    const now = new Date().toISOString();

    orgAId = "org_a_" + crypto.randomUUID();
    orgBId = "org_b_" + crypto.randomUUID();
    ownerAId = "user_owner_a_" + crypto.randomUUID();
    staffAId = "user_staff_a_" + crypto.randomUUID();

    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Seller Org A', 'seller', ?)`
    ).run(orgAId, now);
    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Seller Org B', 'seller', ?)`
    ).run(orgBId, now);

    const insUser = db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    insUser.run(ownerAId, "owner-a@example.com", bcrypt.hashSync("password123", 4), "Owner A", now);
    insUser.run(staffAId, "staff-a@example.com", bcrypt.hashSync("password123", 4), "Staff A", now);

    const insMem = db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`
    );
    insMem.run(crypto.randomUUID(), orgAId, ownerAId, "owner");
    insMem.run(crypto.randomUUID(), orgAId, staffAId, "staff");

    ownerASession = createSession(ownerAId, orgAId);
    staffASession = createSession(staffAId, orgAId);
  });

  afterAll(() => {
    closeDb();
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(tmpDb + suffix);
      } catch {
        /* ignore */
      }
    }
  });

  beforeEach(() => {
    sessionCookie = undefined;
  });

  describe("1. Schema & Additive Migration Verification", () => {
    it("ensures shops table exists with proper columns", () => {
      const db = getDb();
      const cols = db.prepare("PRAGMA table_info(shops)").all() as Array<{ name: string; type: string }>;
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("id");
      expect(colNames).toContain("org_id");
      expect(colNames).toContain("name");
      expect(colNames).toContain("code");
      expect(colNames).toContain("is_default");
      expect(colNames).toContain("created_at");
    });

    it("verifies shop_id additive column exists across all required tables", () => {
      const db = getDb();
      const tables = ["orders", "shipments", "settlement_lines", "uploads", "matches", "match_runs"];
      for (const table of tables) {
        const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        const colNames = cols.map((c) => c.name);
        expect(colNames).toContain("shop_id");
      }

      const sessionCols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
      expect(sessionCols.map((c) => c.name)).toContain("active_shop_id");
    });

    it("backfills NULL shop_id rows to default shop on migration", () => {
      const db = getDb();
      const now = new Date().toISOString();
      const testOrgId = "org_backfill_" + crypto.randomUUID();
      db.prepare("INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Backfill Org', 'seller', ?)").run(
        testOrgId,
        now
      );

      // Insert an order without shop_id (NULL)
      const testOrderId = "order_backfill_" + crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, external_order_id, awb, cn, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, 'EXT-BACKFILL-1', 'AWB-BF-1', 'CN-BF-1', 'Customer BF', 100000, ?)`
      ).run(testOrderId, testOrgId, now);

      // Trigger migration backfill pass
      migrate(db);

      const updatedOrder = db.prepare("SELECT shop_id FROM orders WHERE id = ?").get(testOrderId) as {
        shop_id: string | null;
      };
      expect(updatedOrder.shop_id).not.toBeNull();

      const defaultShop = getDefaultShop(testOrgId);
      expect(updatedOrder.shop_id).toBe(defaultShop.id);
    });
  });

  describe("2. Shop Management & Helpers", () => {
    it("creates shops and manages default shop designation", () => {
      const shop1 = createShop(orgAId, "Gulberg Branch", "GLB", true);
      expect(shop1.name).toBe("Gulberg Branch");
      expect(shop1.code).toBe("GLB");
      expect(shop1.is_default).toBe(true);

      const shop2 = createShop(orgAId, "DHA Branch", "DHA", false);
      expect(shop2.name).toBe("DHA Branch");
      expect(shop2.is_default).toBe(false);

      // Switch default to DHA
      setDefaultShop(shop2.id, orgAId);

      const updatedShop1 = getShop(shop1.id, orgAId);
      const updatedShop2 = getShop(shop2.id, orgAId);
      expect(updatedShop1?.is_default).toBe(false);
      expect(updatedShop2?.is_default).toBe(true);

      const currentDefault = getDefaultShop(orgAId);
      expect(currentDefault.id).toBe(shop2.id);
    });

    it("enforces cross-organization isolation in shop queries", () => {
      const shopA = createShop(orgAId, "Shop For Org A", "SOA", false);
      const shopB = createShop(orgBId, "Shop For Org B", "SOB", true);

      // List shops for Org A must never include Org B shops
      const shopsA = listShops(orgAId);
      expect(shopsA.some((s) => s.id === shopB.id)).toBe(false);
      expect(shopsA.some((s) => s.id === shopA.id)).toBe(true);

      // getShop with orgId guard must reject cross-org queries
      expect(getShop(shopB.id, orgAId)).toBeNull();
      expect(getShop(shopA.id, orgBId)).toBeNull();
      expect(getShop(shopA.id, orgAId)?.id).toBe(shopA.id);
    });
  });

  describe("3. Multi-Shop Data Isolation", () => {
    it("ensures orders and settlement lines in Shop 1 are completely isolated from Shop 2", () => {
      const db = getDb();
      const now = new Date().toISOString();

      const shop1 = createShop(orgAId, "Isolation Shop 1", "IS1", false);
      const shop2 = createShop(orgAId, "Isolation Shop 2", "IS2", false);

      // Insert 2 orders for Shop 1
      const order1Id = "ord_is1_" + crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, shop_id, external_order_id, awb, cn, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, ?, 'EXT-IS1', 'AWB-IS1', 'CN-IS1', 'Customer Shop1', 150000, ?)`
      ).run(order1Id, orgAId, shop1.id, now);

      // Insert 1 order for Shop 2
      const order2Id = "ord_is2_" + crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, shop_id, external_order_id, awb, cn, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, ?, 'EXT-IS2', 'AWB-IS2', 'CN-IS2', 'Customer Shop2', 250000, ?)`
      ).run(order2Id, orgAId, shop2.id, now);

      // Query scoped to Shop 1
      const shop1Orders = db.prepare("SELECT * FROM orders WHERE org_id = ? AND shop_id = ?").all(orgAId, shop1.id) as any[];
      expect(shop1Orders.length).toBe(1);
      expect(shop1Orders[0].id).toBe(order1Id);
      expect(shop1Orders[0].shop_id).toBe(shop1.id);

      // Query scoped to Shop 2
      const shop2Orders = db.prepare("SELECT * FROM orders WHERE org_id = ? AND shop_id = ?").all(orgAId, shop2.id) as any[];
      expect(shop2Orders.length).toBe(1);
      expect(shop2Orders[0].id).toBe(order2Id);
      expect(shop2Orders[0].shop_id).toBe(shop2.id);

      // Verify cross-shop query yields zero records
      const crossShop = db.prepare("SELECT * FROM orders WHERE id = ? AND shop_id = ?").all(order1Id, shop2.id);
      expect(crossShop.length).toBe(0);
    });

    it("scopes newly ingested orders and CPR uploads to the specified shop (Issue #14)", async () => {
      const { ingestOrders, ingestCpr } = await import("@/lib/ingest");
      const db = getDb();

      const shop1 = createShop(orgAId, "Ingest Shop 1", "IS10", false);
      const shop2 = createShop(orgAId, "Ingest Shop 2", "IS20", false);

      const sampleOrdersCsv =
        "Order ID,AWB,Customer Name,Amount,Courier,Status\n" +
        "ORD-ING-1,AWB-ING-1,Customer A,1500,tcs,Delivered\n";

      const sampleCprCsv =
        "booking date,cn by courier,cn status,order no,payment status,amount paid,parcel weight,city,delivery charges,delivery date,payment date\n" +
        "2026-09-08,AWB-ING-1,Delivered,ORD-ING-1,Paid,1350,0.5,Lahore,150,2026-09-09,2026-09-10\n";

      // Ingest orders explicitly scoped to shop1
      const orderRes = ingestOrders(
        orgAId,
        ownerAId,
        "sample-orders.csv",
        sampleOrdersCsv,
        "tcs",
        shop1.id
      );
      expect(orderRes.rowCount).toBe(1);

      // Verify upload record has shop_id = shop1.id
      const uploadRow = db
        .prepare("SELECT * FROM uploads WHERE id = ?")
        .get(orderRes.uploadId) as any;
      expect(uploadRow.shop_id).toBe(shop1.id);

      // Verify inserted order has shop_id = shop1.id
      const orderRow = db
        .prepare("SELECT * FROM orders WHERE upload_id = ?")
        .get(orderRes.uploadId) as any;
      expect(orderRow.shop_id).toBe(shop1.id);

      // Querying orders for shop2 yields 0 records
      const shop2Orders = db
        .prepare("SELECT * FROM orders WHERE org_id = ? AND shop_id = ?")
        .all(orgAId, shop2.id);
      expect(shop2Orders.length).toBe(0);

      // Ingest CPR explicitly scoped to shop1
      const cprRes = ingestCpr(
        orgAId,
        ownerAId,
        "sample-cpr.csv",
        sampleCprCsv,
        "tcs",
        shop1.id
      );
      expect(cprRes.rowCount).toBe(1);

      const cprUpload = db
        .prepare("SELECT * FROM uploads WHERE id = ?")
        .get(cprRes.uploadId) as any;
      expect(cprUpload.shop_id).toBe(shop1.id);

      const settLine = db
        .prepare("SELECT * FROM settlement_lines WHERE upload_id = ?")
        .get(cprRes.uploadId) as any;
      expect(settLine.shop_id).toBe(shop1.id);

      // Querying settlement lines for shop2 yields 0 records
      const shop2Lines = db
        .prepare("SELECT * FROM settlement_lines WHERE org_id = ? AND shop_id = ?")
        .all(orgAId, shop2.id);
      expect(shop2Lines.length).toBe(0);
    });
  });

  describe("4. Role Permissions & Restrictions (Staff vs Owner)", () => {
    it("confirms staff role permissions in ROLE_MATRIX", () => {
      // staff can read, mutate, export
      expect(ROLE_MATRIX.read).toContain("staff");
      expect(ROLE_MATRIX.mutate).toContain("staff");
      expect(ROLE_MATRIX.export).toContain("staff");

      // staff CANNOT access settings, delete, or audit
      expect(ROLE_MATRIX.settings).not.toContain("staff");
      expect(ROLE_MATRIX.delete).not.toContain("staff");
      expect(ROLE_MATRIX.audit).not.toContain("staff");
    });

    it("allows staff to perform mutate/read/export actions", async () => {
      sessionCookie = staffASession;

      const userMutate = await requireAction("mutate");
      expect(userMutate.role).toBe("staff");

      const userRead = await requireAction("read");
      expect(userRead.role).toBe("staff");

      const userExport = await requireAction("export");
      expect(userExport.role).toBe("staff");
    });

    it("blocks staff from settings and delete actions (throws 403)", async () => {
      sessionCookie = staffASession;

      await expect(requireAction("settings")).rejects.toThrow("Forbidden");
      await expect(requireAction("delete")).rejects.toThrow("Forbidden");
      await expect(requireAction("audit")).rejects.toThrow("Forbidden");
    });

    it("allows owner full access to all actions", async () => {
      sessionCookie = ownerASession;

      await expect(requireAction("read")).resolves.toBeDefined();
      await expect(requireAction("mutate")).resolves.toBeDefined();
      await expect(requireAction("export")).resolves.toBeDefined();
      await expect(requireAction("settings")).resolves.toBeDefined();
      await expect(requireAction("delete")).resolves.toBeDefined();
      await expect(requireAction("audit")).resolves.toBeDefined();
    });
  });

  describe("5. Session Active Shop Resolution & Staff Invite", () => {
    it("resolves active shop and shop name from session", async () => {
      const customShop = createShop(orgAId, "Model Town Branch", "MTB", false);
      const sessionWithShop = createSession(staffAId, orgAId, customShop.id);

      sessionCookie = sessionWithShop;
      const user = await getSessionUser();
      expect(user).not.toBeNull();
      expect(user?.shop_id).toBe(customShop.id);
      expect(user?.shop_name).toBe("Model Town Branch");
      expect(user?.role).toBe("staff");
    });

    it("allows owner to invite staff via /api/users", async () => {
      sessionCookie = ownerASession;

      const req = {
        json: async () => ({
          name: "Junior Staff Member",
          email: "junior-staff@example.com",
          password: "password12345",
          role: "staff",
        }),
      } as unknown as NextRequest;

      const res = await postUsers(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.user.email).toBe("junior-staff@example.com");
      expect(body.user.role).toBe("staff");

      const db = getDb();
      const mem = db
        .prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ?")
        .get(orgAId, body.user.id) as { role: string };
      expect(mem.role).toBe("staff");
    });

    it("rejects invalid roles on invite", async () => {
      sessionCookie = ownerASession;

      const req = {
        json: async () => ({
          name: "Invalid Role",
          email: "invalid@example.com",
          password: "password12345",
          role: "superadmin",
        }),
      } as unknown as NextRequest;

      const res = await postUsers(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Role must be ops, accountant, or staff");
    });
  });

  describe("6. Cross-Shop Reconciliation Isolation & Export Scoping (Issue #21)", () => {
    it("scopes runMatch to designated shop without deleting other shops matches", async () => {
      const { runMatch } = await import("@/lib/match");
      const db = getDb();

      const shopAlpha = createShop(orgAId, "Alpha Store", "ALPHA", false);
      const shopBeta = createShop(orgAId, "Beta Store", "BETA", false);
      const now = new Date().toISOString();

      const courierRow = db
        .prepare("SELECT id FROM couriers WHERE code = 'tcs'")
        .get() as { id: string } | undefined;
      const courierId = courierRow
        ? courierRow.id
        : (() => {
            const id = "courier_tcs";
            db.prepare("INSERT INTO couriers (id, code, name) VALUES (?, 'tcs', 'TCS')").run(id);
            return id;
          })();

      // 1. Create orders & settlements for shopAlpha
      const oAlphaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, shop_id, external_order_id, awb, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, ?, 'ORD-ALPHA-1', 'AWB-ALPHA-1', 'Alpha Cust', 250000, ?)`
      ).run(oAlphaId, orgAId, shopAlpha.id, now);

      const upAlphaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO uploads (id, org_id, shop_id, kind, filename, storage_key, uploaded_by, status, created_at)
         VALUES (?, ?, ?, 'cpr', 'alpha.csv', 'key_alpha', ?, 'completed', ?)`
      ).run(upAlphaId, orgAId, shopAlpha.id, ownerAId, now);

      const settAlphaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO settlement_lines (id, org_id, shop_id, upload_id, courier_id, awb, remitted_paisa, settled_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'AWB-ALPHA-1', 250000, ?, ?)`
      ).run(settAlphaId, orgAId, shopAlpha.id, upAlphaId, courierId, now, now);

      // 2. Create orders & settlements for shopBeta
      const oBetaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, shop_id, external_order_id, awb, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, ?, 'ORD-BETA-1', 'AWB-BETA-1', 'Beta Cust', 400000, ?)`
      ).run(oBetaId, orgAId, shopBeta.id, now);

      const upBetaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO uploads (id, org_id, shop_id, kind, filename, storage_key, uploaded_by, status, created_at)
         VALUES (?, ?, ?, 'cpr', 'beta.csv', 'key_beta', ?, 'completed', ?)`
      ).run(upBetaId, orgAId, shopBeta.id, ownerAId, now);

      const settBetaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO settlement_lines (id, org_id, shop_id, upload_id, courier_id, awb, remitted_paisa, fee_delivery_paisa, settled_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'AWB-BETA-1', 400000, 20000, ?, ?)`
      ).run(settBetaId, orgAId, shopBeta.id, upBetaId, courierId, now, now);

      // Run match for shopAlpha only
      const resAlpha = runMatch(orgAId, ownerAId, shopAlpha.id);
      expect(resAlpha.summary.matched).toBe(1);

      // Verify shop_id is recorded in match_runs and matches
      const runAlphaRow = db
        .prepare("SELECT * FROM match_runs WHERE id = ?")
        .get(resAlpha.matchRunId) as any;
      expect(runAlphaRow.shop_id).toBe(shopAlpha.id);

      const alphaMatches = db
        .prepare("SELECT * FROM matches WHERE match_run_id = ?")
        .all(resAlpha.matchRunId) as any[];
      expect(alphaMatches.length).toBe(1);
      expect(alphaMatches[0].shop_id).toBe(shopAlpha.id);
      expect(alphaMatches[0].awb).toBe("AWB-ALPHA-1");

      // Run match for shopBeta only
      const resBeta = runMatch(orgAId, ownerAId, shopBeta.id);
      expect(resBeta.summary.matched).toBe(1);

      const betaMatches = db
        .prepare("SELECT * FROM matches WHERE match_run_id = ?")
        .all(resBeta.matchRunId) as any[];
      expect(betaMatches.length).toBe(1);
      expect(betaMatches[0].shop_id).toBe(shopBeta.id);
      expect(betaMatches[0].awb).toBe("AWB-BETA-1");

      // Verify that shopAlpha's matches were NOT deleted by shopBeta's match run!
      const remainingAlphaMatches = db
        .prepare("SELECT * FROM matches WHERE org_id = ? AND shop_id = ?")
        .all(orgAId, shopAlpha.id) as any[];
      expect(remainingAlphaMatches.length).toBe(1);
    });

    it("restricts GET /api/matches to user.shop_id when role is staff", async () => {
      const getMatches = (await import("@/app/api/matches/route")).GET;
      const { NextRequest } = await import("next/server");
      const db = getDb();

      const shopGamma = createShop(orgAId, "Gamma Shop", "GAM", false);
      const staffUser = crypto.randomUUID();
      const staffSession = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, 'staff-gamma@test.local', 'hash', 'Gamma Staff', ?)`
      ).run(staffUser, now);
      db.prepare(
        `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'staff')`
      ).run(crypto.randomUUID(), orgAId, staffUser);

      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      db.prepare(
        `INSERT INTO sessions (id, user_id, org_id, active_shop_id, expires_at) VALUES (?, ?, ?, ?, ?)`
      ).run(staffSession, staffUser, orgAId, shopGamma.id, expires.toISOString());

      // Insert match for shopGamma
      const runGammaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO match_runs (id, org_id, shop_id, created_at, created_by, summary_json) VALUES (?, ?, ?, ?, ?, '{}')`
      ).run(runGammaId, orgAId, shopGamma.id, now, staffUser);

      db.prepare(
        `INSERT INTO matches (id, match_run_id, org_id, shop_id, status, expected_paisa, remitted_paisa, awb, reference_date)
         VALUES (?, ?, ?, ?, 'matched', 100000, 100000, 'AWB-GAMMA-ONLY', ?)`
      ).run(crypto.randomUUID(), runGammaId, orgAId, shopGamma.id, now);

      sessionCookie = staffSession;
      const req = new NextRequest("http://localhost/api/matches");
      const res = await getMatches(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.matches.length).toBe(1);
      expect(json.matches[0].awb).toBe("AWB-GAMMA-ONLY");
      expect(json.matches[0].shop_id).toBe(shopGamma.id);
    });

    it("restricts GET /api/export/receivable and GET /api/export/fees to staff shop_id", async () => {
      const getExportRecv = (await import("@/app/api/export/receivable/route")).GET;
      const getExportFees = (await import("@/app/api/export/fees/route")).GET;
      const { NextRequest } = await import("next/server");
      const db = getDb();

      const shopDelta = createShop(orgAId, "Delta Shop", "DELT", false);
      const staffUser = crypto.randomUUID();
      const staffSession = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, 'staff-delta@test.local', 'hash', 'Delta Staff', ?)`
      ).run(staffUser, now);
      db.prepare(
        `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'staff')`
      ).run(crypto.randomUUID(), orgAId, staffUser);

      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      db.prepare(
        `INSERT INTO sessions (id, user_id, org_id, active_shop_id, expires_at) VALUES (?, ?, ?, ?, ?)`
      ).run(staffSession, staffUser, orgAId, shopDelta.id, expires.toISOString());

      const courierRow = db.prepare("SELECT id FROM couriers LIMIT 1").get() as { id: string };

      // Settlement line for Delta
      const upDeltaId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO uploads (id, org_id, shop_id, kind, filename, storage_key, uploaded_by, status, created_at)
         VALUES (?, ?, ?, 'cpr', 'delta.csv', 'key_delta', ?, 'completed', ?)`
      ).run(upDeltaId, orgAId, shopDelta.id, staffUser, now);

      db.prepare(
        `INSERT INTO settlement_lines (id, org_id, shop_id, upload_id, courier_id, awb, remitted_paisa, fee_delivery_paisa, settled_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'AWB-DELTA-FEE', 150000, 18000, ?, ?)`
      ).run(crypto.randomUUID(), orgAId, shopDelta.id, upDeltaId, courierRow.id, now, now);

      sessionCookie = staffSession;

      // Fees export
      const feesReq = new NextRequest("http://localhost/api/export/fees");
      const feesRes = await getExportFees(feesReq);
      expect(feesRes.status).toBe(200);
      const feesText = await feesRes.text();
      expect(feesText).toContain("AWB-DELTA-FEE");
      expect(feesText).not.toContain("AWB-BETA-1"); // Beta shop fee must NOT leak to Delta staff!
    });
  });
});
