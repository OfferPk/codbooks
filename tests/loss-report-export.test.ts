import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-loss-export-${Date.now()}-${Math.random()}.db`
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

describe("GET /api/loss-report/export", () => {
  let orgId: string;
  let ownerId: string;
  let ownerSession: string;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;
  let getExport: typeof import("@/app/api/loss-report/export/route").GET;

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    const dbMod = await import("@/lib/db");
    closeDb = dbMod.closeDb;
    getDb = dbMod.getDb;
    closeDb();
    const db = getDb();
    const now = new Date().toISOString();

    orgId = crypto.randomUUID();
    ownerId = crypto.randomUUID();
    ownerSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Loss Audit Org', 'seller', ?)`
    ).run(orgId, now);

    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(ownerId, "loss-audit-owner@test.local", bcrypt.hashSync("password12", 4), "Audit Owner", now);

    db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`
    ).run(crypto.randomUUID(), orgId, ownerId);

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare(
      `INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`
    ).run(ownerSession, ownerId, orgId, expires.toISOString());

    // Courier
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

    // Match run & sample short match
    const runId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO match_runs (id, org_id, created_at, created_by, summary_json) VALUES (?, ?, ?, ?, '{}')`
    ).run(runId, orgId, now, ownerId);

    const o1Id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO orders (id, org_id, external_order_id, awb, customer_name, order_amount_paisa, created_at)
       VALUES (?, ?, 'ORD-EXP-1', 'AWB-EXP-1', 'Hamza Khan', 300000, ?)`
    ).run(o1Id, orgId, now);

    db.prepare(
      `INSERT INTO matches (id, org_id, match_run_id, order_id, courier_id, status, expected_paisa, remitted_paisa, short_paisa, awb, reference_date)
       VALUES (?, ?, ?, ?, ?, 'short', 300000, 250000, 50000, 'AWB-EXP-1', ?)`
    ).run(crypto.randomUUID(), orgId, runId, o1Id, courierId, now);

    const exportRouteMod = await import("@/app/api/loss-report/export/route");
    getExport = exportRouteMod.GET;
  });

  afterAll(() => {
    closeDb();
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(tmpDb + s);
      } catch {
        /* ignore */
      }
    }
  });

  it("returns 401 Unauthorized when session is absent", async () => {
    sessionCookie = undefined;
    const req = new NextRequest("http://localhost/api/loss-report/export");
    const res = await getExport(req);
    expect(res.status).toBe(401);
  });

  it("generates CSV export and writes an immutable audit_events record", async () => {
    sessionCookie = ownerSession;
    const req = new NextRequest(
      "http://localhost/api/loss-report/export?courier=tcs&category=short_payment"
    );
    const res = await getExport(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="codbooks-loss-report-\d{4}-\d{2}-\d{2}\.csv"/
    );

    const text = await res.text();
    expect(text).toContain("Category,Courier,Order ID,Tracking AWB");
    expect(text).toContain("ORD-EXP-1");
    expect(text).toContain("AWB-EXP-1");
    expect(text).toContain("500.00");

    // Verify audit record was created in database
    const db = getDb();
    const event = db
      .prepare(
        `SELECT * FROM audit_events WHERE org_id = ? AND action = 'export_loss_report' ORDER BY created_at DESC LIMIT 1`
      )
      .get(orgId) as
      | { id: string; user_id: string; action: string; meta_json: string }
      | undefined;

    expect(event).toBeDefined();
    expect(event?.user_id).toBe(ownerId);
    expect(event?.action).toBe("export_loss_report");

    const meta = JSON.parse(event!.meta_json);
    expect(meta.courier).toBe("tcs");
    expect(meta.category).toBe("short_payment");
    expect(meta.item_count).toBeGreaterThanOrEqual(1);
    expect(meta.as_of).toBeDefined();
  });
});
