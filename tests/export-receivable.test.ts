import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-export-recv-${Date.now()}-${Math.random()}.db`
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

describe("GET /api/export/receivable status + date window", () => {
  let orgId: string;
  let ownerSession: string;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getExport: typeof import("@/app/api/export/receivable/route").GET;

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    const dbMod = await import("@/lib/db");
    closeDb = dbMod.closeDb;
    const getDb = dbMod.getDb;
    closeDb();
    const db = getDb();
    const now = new Date().toISOString();
    orgId = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    ownerSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Export Org', 'seller', ?)`
    ).run(orgId, now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(ownerId, "owner-e@t.local", bcrypt.hashSync("password12", 4), "O", now);
    db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`
    ).run(crypto.randomUUID(), orgId, ownerId);
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare(
      `INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`
    ).run(ownerSession, ownerId, orgId, expires.toISOString());

    const courierId = "courier_tcs";
    const runId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO match_runs (id, org_id, created_at, created_by, summary_json) VALUES (?, ?, ?, ?, '{}')`
    ).run(runId, orgId, now, ownerId);

    const ins = db.prepare(
      `INSERT INTO matches (id, org_id, match_run_id, order_id, settlement_line_id, status,
        expected_paisa, remitted_paisa, short_paisa, courier_id, awb, cn, notes, reference_date)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`
    );
    ins.run(
      crypto.randomUUID(),
      orgId,
      runId,
      "short",
      100000,
      90000,
      10000,
      courierId,
      "E-SHORT",
      "2026-09-10"
    );
    ins.run(
      crypto.randomUUID(),
      orgId,
      runId,
      "unpaid",
      50000,
      0,
      50000,
      courierId,
      "E-UNPAID",
      "2026-09-20"
    );
    ins.run(
      crypto.randomUUID(),
      orgId,
      runId,
      "matched",
      80000,
      80000,
      0,
      courierId,
      "E-MATCHED",
      "2026-09-15"
    );

    getExport = (await import("@/app/api/export/receivable/route")).GET;
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

  beforeEach(() => {
    sessionCookie = ownerSession;
  });

  function req(qs: string) {
    return {
      nextUrl: new URL(`http://localhost/api/export/receivable${qs}`),
    } as unknown as import("next/server").NextRequest;
  }

  it("filters by status=short,unpaid (chase)", async () => {
    const res = await getExport(req("?status=short,unpaid"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("E-SHORT");
    expect(text).toContain("E-UNPAID");
    expect(text).not.toContain("E-MATCHED");
  });

  it("filters by from/to on reference_date", async () => {
    const res = await getExport(req("?from=2026-09-15&to=2026-09-20"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("E-UNPAID");
    expect(text).toContain("E-MATCHED");
    expect(text).not.toContain("E-SHORT");
  });

  it("combines status + date window", async () => {
    const res = await getExport(
      req("?status=short,unpaid&from=2026-09-18&to=2026-09-25")
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("E-UNPAID");
    expect(text).not.toContain("E-SHORT");
    expect(text).not.toContain("E-MATCHED");
  });
});
