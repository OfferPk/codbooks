import fs from "fs";
import path from "path";
import os from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const tmpDb = path.join(
  os.tmpdir(),
  `codbooks-team-invite-${Date.now()}-${Math.random()}.db`
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

describe("Team invite API (owner-only)", () => {
  let orgId: string;
  let ownerSession: string;
  let opsSession: string;
  let acctSession: string;
  let closeDb: typeof import("@/lib/db").closeDb;
  let getUsers: typeof import("@/app/api/users/route").GET;
  let postUsers: typeof import("@/app/api/users/route").POST;

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
    const opsId = crypto.randomUUID();
    const acctId = crypto.randomUUID();
    ownerSession = crypto.randomUUID();
    opsSession = crypto.randomUUID();
    acctSession = crypto.randomUUID();

    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Team Org', 'seller', ?)`
    ).run(orgId, now);
    const insUser = db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    insUser.run(ownerId, "owner-t@t.local", bcrypt.hashSync("password12", 4), "Owner", now);
    insUser.run(opsId, "ops-t@t.local", bcrypt.hashSync("password12", 4), "Ops", now);
    insUser.run(acctId, "acct-t@t.local", bcrypt.hashSync("password12", 4), "Acct", now);
    const insMem = db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`
    );
    insMem.run(crypto.randomUUID(), orgId, ownerId, "owner");
    insMem.run(crypto.randomUUID(), orgId, opsId, "ops");
    insMem.run(crypto.randomUUID(), orgId, acctId, "accountant");
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const insSess = db.prepare(
      `INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)`
    );
    insSess.run(ownerSession, ownerId, orgId, expires.toISOString());
    insSess.run(opsSession, opsId, orgId, expires.toISOString());
    insSess.run(acctSession, acctId, orgId, expires.toISOString());

    getUsers = (await import("@/app/api/users/route")).GET;
    postUsers = (await import("@/app/api/users/route")).POST;
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

  function postReq(body: unknown) {
    return {
      json: async () => body,
    } as unknown as import("next/server").NextRequest;
  }

  it("ops cannot GET or POST /api/users (403)", async () => {
    sessionCookie = opsSession;
    const g = await getUsers();
    expect(g.status).toBe(403);
    const p = await postUsers(
      postReq({
        name: "New",
        email: "new-ops@t.local",
        password: "password12",
        role: "ops",
      })
    );
    expect(p.status).toBe(403);
  });

  it("accountant cannot invite (403)", async () => {
    sessionCookie = acctSession;
    const p = await postUsers(
      postReq({
        name: "New",
        email: "new-acct@t.local",
        password: "password12",
        role: "accountant",
      })
    );
    expect(p.status).toBe(403);
  });

  it("owner can list roster and invite ops", async () => {
    sessionCookie = ownerSession;
    const list = await getUsers();
    expect(list.status).toBe(200);
    const before = await list.json();
    expect(before.users.length).toBeGreaterThanOrEqual(3);

    const res = await postUsers(
      postReq({
        name: "New Ops",
        email: "invite-ops@t.local",
        password: "password12",
        role: "ops",
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("invite-ops@t.local");
    expect(body.user.role).toBe("ops");

    const after = await (await getUsers()).json();
    expect(after.users.some((u: { email: string }) => u.email === "invite-ops@t.local")).toBe(
      true
    );
  });

  it("owner invite rejects short password and owner role", async () => {
    sessionCookie = ownerSession;
    const short = await postUsers(
      postReq({
        name: "X",
        email: "short-invite@t.local",
        password: "short",
        role: "ops",
      })
    );
    expect(short.status).toBe(400);
    const ownerRole = await postUsers(
      postReq({
        name: "X",
        email: "owner-invite@t.local",
        password: "password12",
        role: "owner",
      })
    );
    expect(ownerRole.status).toBe(400);
  });
});
