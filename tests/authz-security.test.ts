import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-test-authz-${Date.now()}-${Math.random()}.db`
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

describe("role authz + security gates", () => {
  let orgId: string;
  let ownerId: string;
  let acctId: string;
  let opsId: string;
  let ownerSession: string;
  let acctSession: string;
  let opsSession: string;

  let closeDb: typeof import("@/lib/db").closeDb;
  let getDb: typeof import("@/lib/db").getDb;
  let postMatch: typeof import("@/app/api/match/route").POST;
  let postUploads: typeof import("@/app/api/uploads/route").POST;
  let getAudit: typeof import("@/app/api/audit/route").GET;
  let getReceivable: typeof import("@/app/api/export/receivable/route").GET;
  let ROLE_MATRIX: typeof import("@/lib/auth").ROLE_MATRIX;
  let sanitizeCsvCell: typeof import("@/lib/csv").sanitizeCsvCell;
  let resolveSafeUploadPath: typeof import("@/lib/ingest").resolveSafeUploadPath;
  let ingestOrders: typeof import("@/lib/ingest").ingestOrders;
  let runMatch: typeof import("@/lib/match").runMatch;
  let getAgingBoard: typeof import("@/lib/match").getAgingBoard;
  let getHealthSummary: typeof import("@/lib/match").getHealthSummary;

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
    acctId = crypto.randomUUID();
    opsId = crypto.randomUUID();
    ownerSession = crypto.randomUUID();
    acctSession = crypto.randomUUID();
    opsSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Authz Org', 'seller', ?)`
    ).run(orgId, now);

    const insUser = db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    insUser.run(ownerId, "owner@t.local", bcrypt.hashSync("x", 4), "O", now);
    insUser.run(acctId, "acct@t.local", bcrypt.hashSync("x", 4), "A", now);
    insUser.run(opsId, "ops@t.local", bcrypt.hashSync("x", 4), "P", now);

    const insMem = db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`
    );
    insMem.run(crypto.randomUUID(), orgId, ownerId, "owner");
    insMem.run(crypto.randomUUID(), orgId, acctId, "accountant");
    insMem.run(crypto.randomUUID(), orgId, opsId, "ops");

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const insSess = db.prepare(
      `INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`
    );
    insSess.run(ownerSession, ownerId, orgId, expires.toISOString());
    insSess.run(acctSession, acctId, orgId, expires.toISOString());
    insSess.run(opsSession, opsId, orgId, expires.toISOString());

    postMatch = (await import("@/app/api/match/route")).POST;
    postUploads = (await import("@/app/api/uploads/route")).POST;
    getAudit = (await import("@/app/api/audit/route")).GET;
    getReceivable = (await import("@/app/api/export/receivable/route")).GET;
    ROLE_MATRIX = (await import("@/lib/auth")).ROLE_MATRIX;
    sanitizeCsvCell = (await import("@/lib/csv")).sanitizeCsvCell;
    resolveSafeUploadPath = (await import("@/lib/ingest")).resolveSafeUploadPath;
    ingestOrders = (await import("@/lib/ingest")).ingestOrders;
    const matchMod = await import("@/lib/match");
    runMatch = matchMod.runMatch;
    getAgingBoard = matchMod.getAgingBoard;
    getHealthSummary = matchMod.getHealthSummary;
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
    sessionCookie = undefined;
  });

  it("ROLE_MATRIX: accountant cannot mutate; ops can", () => {
    expect(ROLE_MATRIX.mutate).toContain("owner");
    expect(ROLE_MATRIX.mutate).toContain("ops");
    expect(ROLE_MATRIX.mutate).not.toContain("accountant");
    expect(ROLE_MATRIX.audit).not.toContain("ops");
  });

  it("accountant gets 403 on POST /api/match", async () => {
    sessionCookie = acctSession;
    const res = await postMatch();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it("accountant gets 403 on POST /api/uploads", async () => {
    sessionCookie = acctSession;
    const fd = new FormData();
    fd.set(
      "file",
      new File(
        [
          "external_order_id,awb,cn,customer_name,cod_amount_pkr,currency,ordered_at,source,status\nORD-1,1,1,A,100,PKR,2026-01-01,x,shipped\n",
        ],
        "orders.csv",
        { type: "text/csv" }
      )
    );
    fd.set("kind", "orders");
    fd.set("auto_match", "false");
    const req = {
      formData: async () => fd,
    } as unknown as import("next/server").NextRequest;
    const res = await postUploads(req);
    expect(res.status).toBe(403);
  });

  it("ops gets 403 on GET /api/audit", async () => {
    sessionCookie = opsSession;
    const res = await getAudit();
    expect(res.status).toBe(403);
  });

  it("owner can POST /api/match (200)", async () => {
    sessionCookie = ownerSession;
    const res = await postMatch();
    expect(res.status).toBe(200);
  });

  it("accountant can export receivable (200)", async () => {
    sessionCookie = acctSession;
    const res = await getReceivable({
      nextUrl: new URL("http://localhost/api/export/receivable"),
    } as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/csv/);
  });

  it("sanitizeCsvCell neutralizes formula prefixes", () => {
    expect(sanitizeCsvCell("=CMD")).toBe("'=CMD");
    expect(sanitizeCsvCell("+1")).toBe("'+1");
    expect(sanitizeCsvCell("-total")).toBe("'-total");
    expect(sanitizeCsvCell("@sum")).toBe("'@sum");
    expect(sanitizeCsvCell("normal")).toBe("normal");
    expect(sanitizeCsvCell('a,b')).toBe('"a,b"');
  });

  it("upload storage path uses UUID only and contains under uploads root", () => {
    const org = crypto.randomUUID();
    const upload = crypto.randomUUID();
    const { storageKey, fullPath } = resolveSafeUploadPath(
      org,
      upload,
      "../../../../tmp/evil.csv"
    );
    expect(storageKey).toBe(`${org}/${upload}.csv`);
    expect(storageKey).not.toContain("..");
    expect(fullPath).toContain(path.join("data", "uploads"));
    expect(fullPath.endsWith(`${upload}.csv`)).toBe(true);
    const root = path.resolve(process.cwd(), "data", "uploads");
    expect(path.relative(root, fullPath).startsWith("..")).toBe(false);
  });

  it("unpaid orders retain courier_id for health/aging", () => {
    const csv = `external_order_id,awb,cn,customer_name,cod_amount_pkr,currency,ordered_at,source,status
ORD-UNPAID-X,779499999001,779499999001,Unpaid Buyer,5000,PKR,2026-08-01T08:00:00+05:00,shopify,delivered
`;
    ingestOrders(orgId, ownerId, "unpaid-tcs.csv", csv, "tcs");
    runMatch(orgId, ownerId);
    const db = getDb();
    const unpaid = db
      .prepare(
        `SELECT m.status, m.courier_id, c.code as courier_code
         FROM matches m
         LEFT JOIN couriers c ON c.id = m.courier_id
         WHERE m.org_id = ? AND m.status = 'unpaid' AND m.awb = '779499999001'`
      )
      .get(orgId) as { status: string; courier_id: string; courier_code: string };
    expect(unpaid).toBeTruthy();
    expect(unpaid.courier_id).toBeTruthy();
    expect(unpaid.courier_code).toBe("tcs");

    const health = getHealthSummary(orgId);
    expect(health.by_courier.tcs?.unpaid_count).toBeGreaterThan(0);
    expect(health.by_courier.unknown?.unpaid_count ?? 0).toBe(0);

    const aging = getAgingBoard(orgId);
    const tcsBuckets = aging.filter((b) => b.courier_code === "tcs");
    expect(tcsBuckets.length).toBeGreaterThan(0);
  });
});
