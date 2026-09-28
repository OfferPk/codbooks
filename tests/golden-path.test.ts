import fs from "fs";
import path from "path";
import os from "os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { ingestOrders, ingestCpr } from "@/lib/ingest";
import { runMatch, getHealthSummary } from "@/lib/match";
import { hashPassword } from "@/lib/auth";

const fx = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");

describe("fixture golden path", () => {
  let dbFile: string;
  let orgId: string;
  let userId: string;

  beforeEach(() => {
    closeDb();
    dbFile = path.join(
      os.tmpdir(),
      `codbooks-test-${Date.now()}-${Math.random()}.db`
    );
    process.env.DATABASE_PATH = dbFile;
    const db = getDb();
    orgId = crypto.randomUUID();
    userId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Test', 'seller', ?)`
    ).run(orgId, now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run(userId, "t@test.local", hashPassword("x"), "T", now);
    db.prepare(
      `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`
    ).run(crypto.randomUUID(), orgId, userId);
  });

  afterEach(() => {
    closeDb();
    for (const s of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(dbFile + s);
      } catch {
        /* ignore */
      }
    }
  });

  it("TCS invoice + orders → statuses", () => {
    ingestOrders(orgId, userId, "orders-tcs.csv", fx("orders-tcs.example.csv"), "tcs");
    ingestCpr(
      orgId,
      userId,
      "tcs-inv.csv",
      fx("tcs-payment-invoice.example.csv"),
      "tcs"
    );
    const { summary } = runMatch(orgId, userId);
    expect(
      summary.matched +
        summary.short +
        summary.unpaid +
        summary.unmatched +
        summary.double_paid
    ).toBeGreaterThan(0);
    const health = getHealthSummary(orgId);
    expect(
      health.matched_count + health.short_count + health.unpaid_count
    ).toBeGreaterThan(0);
  });

  it("PostEx portal + orders", () => {
    ingestOrders(
      orgId,
      userId,
      "orders-px.csv",
      fx("orders-postex.example.csv"),
      "postex"
    );
    ingestCpr(
      orgId,
      userId,
      "px.csv",
      fx("postex-settlement-portal.example.csv"),
      "postex"
    );
    const { summary } = runMatch(orgId, userId);
    expect(
      summary.matched + summary.short + summary.unpaid + summary.unmatched
    ).toBeGreaterThan(0);
  });
});
