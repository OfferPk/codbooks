import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-match-notes-${Date.now()}-${Math.random()}.db`
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

describe("PATCH /api/matches/[id] chase notes", () => {
  let orgId: string;
  let otherOrgId: string;
  let ownerSession: string;
  let opsSession: string;
  let acctSession: string;
  let matchId: string;
  let otherMatchId: string;
  let closeDb: typeof import("@/lib/db").closeDb;
  let patchMatch: typeof import("@/app/api/matches/[id]/route").PATCH;

  beforeAll(async () => {
    process.env.DATABASE_PATH = tmpDb;
    const dbMod = await import("@/lib/db");
    closeDb = dbMod.closeDb;
    const getDb = dbMod.getDb;
    closeDb();
    const db = getDb();
    const now = new Date().toISOString();

    orgId = crypto.randomUUID();
    otherOrgId = crypto.randomUUID();
    const ownerId = crypto.randomUUID();
    const opsId = crypto.randomUUID();
    const acctId = crypto.randomUUID();
    const otherOwner = crypto.randomUUID();
    ownerSession = crypto.randomUUID();
    opsSession = crypto.randomUUID();
    acctSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Notes Org', 'seller', ?)`
    ).run(orgId, now);
    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Other Org', 'seller', ?)`
    ).run(otherOrgId, now);

    const insUser = db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    insUser.run(ownerId, "owner-n@t.local", bcrypt.hashSync("password12", 4), "O", now);
    insUser.run(opsId, "ops-n@t.local", bcrypt.hashSync("password12", 4), "P", now);
    insUser.run(acctId, "acct-n@t.local", bcrypt.hashSync("password12", 4), "A", now);
    insUser.run(otherOwner, "other-n@t.local", bcrypt.hashSync("password12", 4), "X", now);

    const insMem = db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`
    );
    insMem.run(crypto.randomUUID(), orgId, ownerId, "owner");
    insMem.run(crypto.randomUUID(), orgId, opsId, "ops");
    insMem.run(crypto.randomUUID(), orgId, acctId, "accountant");
    insMem.run(crypto.randomUUID(), otherOrgId, otherOwner, "owner");

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const insSess = db.prepare(
      `INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`
    );
    insSess.run(ownerSession, ownerId, orgId, expires.toISOString());
    insSess.run(opsSession, opsId, orgId, expires.toISOString());
    insSess.run(acctSession, acctId, orgId, expires.toISOString());

    // Minimal courier + match_run + matches
    const courierId = "courier_tcs";
    const runId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO match_runs (id, org_id, created_at, created_by, summary_json) VALUES (?, ?, ?, ?, '{}')`
    ).run(runId, orgId, now, ownerId);
    matchId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO matches (id, org_id, match_run_id, order_id, settlement_line_id, status,
        expected_paisa, remitted_paisa, short_paisa, courier_id, awb, cn, notes, reference_date)
       VALUES (?, ?, ?, NULL, NULL, 'short', 100000, 90000, 10000, ?, 'AWB1', 'CN1', NULL, ?)`
    ).run(matchId, orgId, runId, courierId, now);

    const otherRun = crypto.randomUUID();
    db.prepare(
      `INSERT INTO match_runs (id, org_id, created_at, created_by, summary_json) VALUES (?, ?, ?, ?, '{}')`
    ).run(otherRun, otherOrgId, now, otherOwner);
    otherMatchId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO matches (id, org_id, match_run_id, order_id, settlement_line_id, status,
        expected_paisa, remitted_paisa, short_paisa, courier_id, awb, cn, notes, reference_date)
       VALUES (?, ?, ?, NULL, NULL, 'unpaid', 50000, 0, 50000, NULL, 'AWB-X', NULL, NULL, ?)`
    ).run(otherMatchId, otherOrgId, otherRun, now);

    patchMatch = (await import("@/app/api/matches/[id]/route")).PATCH;
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

  function req(notes: string) {
    return {
      json: async () => ({ notes }),
    } as unknown as import("next/server").NextRequest;
  }

  function params(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("ops can PATCH notes", async () => {
    sessionCookie = opsSession;
    const res = await patchMatch(req("called TCS"), params(matchId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match.notes).toBe("called TCS");
  });

  it("accountant gets 403 on PATCH", async () => {
    sessionCookie = acctSession;
    const res = await patchMatch(req("should fail"), params(matchId));
    expect(res.status).toBe(403);
  });

  it("cross-org match id returns 404", async () => {
    sessionCookie = ownerSession;
    const res = await patchMatch(req("nope"), params(otherMatchId));
    expect(res.status).toBe(404);
  });

  it("rejects notes over 500 chars", async () => {
    sessionCookie = opsSession;
    const res = await patchMatch(req("x".repeat(501)), params(matchId));
    expect(res.status).toBe(400);
  });
});
