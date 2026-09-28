import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-matches-filter-${Date.now()}-${Math.random()}.db`
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

describe("GET /api/matches filters (q + courier + status)", () => {
  let orgId: string;
  let ownerId: string;
  let ownerSession: string;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;
  let getMatches: typeof import("@/app/api/matches/route").GET;
  let ingestOrders: typeof import("@/lib/ingest").ingestOrders;
  let ingestCpr: typeof import("@/lib/ingest").ingestCpr;
  let runMatch: typeof import("@/lib/match").runMatch;

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
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Filter Org', 'seller', ?)`
    ).run(orgId, now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(ownerId, "owner-f@t.local", bcrypt.hashSync("password12", 4), "O", now);
    db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`
    ).run(crypto.randomUUID(), orgId, ownerId);
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    db.prepare(
      `INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`
    ).run(ownerSession, ownerId, orgId, expires.toISOString());

    ingestOrders = (await import("@/lib/ingest")).ingestOrders;
    ingestCpr = (await import("@/lib/ingest")).ingestCpr;
    runMatch = (await import("@/lib/match")).runMatch;
    getMatches = (await import("@/app/api/matches/route")).GET;

    const fixtures = path.join(process.cwd(), "fixtures");
    const read = (name: string) =>
      fs.readFileSync(path.join(fixtures, name), "utf8");
    ingestOrders(
      orgId,
      ownerId,
      "orders-tcs.example.csv",
      read("orders-tcs.example.csv"),
      "tcs"
    );
    ingestOrders(
      orgId,
      ownerId,
      "orders-postex.example.csv",
      read("orders-postex.example.csv"),
      "postex"
    );
    ingestCpr(
      orgId,
      ownerId,
      "tcs-payment-invoice.example.csv",
      read("tcs-payment-invoice.example.csv"),
      "tcs"
    );
    ingestCpr(
      orgId,
      ownerId,
      "tcs-payment-detail.example.csv",
      read("tcs-payment-detail.example.csv"),
      "tcs"
    );
    ingestCpr(
      orgId,
      ownerId,
      "postex-settlement-portal.example.csv",
      read("postex-settlement-portal.example.csv"),
      "postex"
    );
    runMatch(orgId, ownerId);
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
      nextUrl: new URL(`http://localhost/api/matches${qs}`),
    } as unknown as import("next/server").NextRequest;
  }

  it("filters by status", async () => {
    const res = await getMatches(req("?status=short"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.matches.every((m: { status: string }) => m.status === "short")).toBe(
      true
    );
  });

  it("filters by courier case-insensitively", async () => {
    const res = await getMatches(req("?courier=TCS"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);
    expect(
      body.matches.every(
        (m: { courier_code: string | null }) =>
          (m.courier_code || "").toLowerCase() === "tcs"
      )
    ).toBe(true);
  });

  it("filters by q substring on awb/order/customer", async () => {
    const all = await getMatches(req(""));
    const allBody = await all.json();
    const sample = allBody.matches.find(
      (m: { awb: string | null }) => m.awb && m.awb.length > 4
    );
    expect(sample).toBeTruthy();
    const fragment = String(sample.awb).slice(2, 8);
    const res = await getMatches(req(`?q=${encodeURIComponent(fragment)}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);
    expect(
      body.matches.some(
        (m: {
          awb: string | null;
          cn: string | null;
          external_order_id: string | null;
          customer_name: string | null;
        }) =>
          [m.awb, m.cn, m.external_order_id, m.customer_name]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(fragment.toLowerCase()))
      )
    ).toBe(true);
  });

  it("combines q + courier + status", async () => {
    const shortTcs = await getMatches(req("?status=short&courier=tcs"));
    const shortBody = await shortTcs.json();
    if (shortBody.matches.length === 0) {
      // still assert empty combo works
      const empty = await getMatches(
        req("?status=short&courier=tcs&q=zzzz-no-hit")
      );
      expect(empty.status).toBe(200);
      expect((await empty.json()).matches).toEqual([]);
      return;
    }
    const hit = shortBody.matches[0];
    const q = hit.awb || hit.cn || hit.external_order_id || hit.customer_name;
    expect(q).toBeTruthy();
    const fragment = String(q).slice(0, Math.min(6, String(q).length));
    const res = await getMatches(
      req(
        `?status=short&courier=tcs&q=${encodeURIComponent(fragment)}`
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches.length).toBeGreaterThan(0);
    expect(
      body.matches.every(
        (m: { status: string; courier_code: string | null }) =>
          m.status === "short" &&
          (m.courier_code || "").toLowerCase() === "tcs"
      )
    ).toBe(true);
  });
});
