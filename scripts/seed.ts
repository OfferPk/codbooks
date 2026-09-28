/**
 * Seed CodBooks demo org + users + fixture CSVs matched.
 * Usage: npm run seed
 *
 * Demo accounts are for local/dev only. Refuses to run when NODE_ENV=production
 * unless ALLOW_DEMO_SEED=1 is explicitly set.
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { chmodDbArtifacts, ensurePrivateDir } from "../src/lib/fs-perms";

const root = process.cwd();

if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_DEMO_SEED !== "1"
) {
  console.error(
    "Refusing to seed demo credentials in production.\n" +
      "Set ALLOW_DEMO_SEED=1 only for disposable demo environments."
  );
  process.exit(1);
}
const dbPath = process.env.DATABASE_PATH
  ? path.isAbsolute(process.env.DATABASE_PATH)
    ? process.env.DATABASE_PATH
    : path.join(root, process.env.DATABASE_PATH)
  : path.join(root, "data", "codbooks.db");

const dir = path.dirname(dbPath);
ensurePrivateDir(dir);
for (const suffix of ["", "-wal", "-shm"]) {
  const p = dbPath + suffix;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// Use app migrate via dynamic import after setting env
process.env.DATABASE_PATH = dbPath;

async function main() {
  // Reset module singleton by requiring after env set
  const { closeDb, getDb, audit } = await import("../src/lib/db");
  closeDb();
  const db = getDb();

  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const now = new Date().toISOString();

  const orgId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const acctId = crypto.randomUUID();
  const opsId = crypto.randomUUID();

  db.prepare(
    `INSERT INTO orgs (id, name, type, created_at) VALUES (?, ?, 'seller', ?)`
  ).run(orgId, "Demo COD Store", now);

  const insUser = db.prepare(
    `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
  );
  insUser.run(ownerId, "owner@codbooks.local", hash("owner123"), "Demo Owner", now);
  insUser.run(acctId, "accountant@codbooks.local", hash("acct123"), "Demo Accountant", now);
  insUser.run(opsId, "ops@codbooks.local", hash("ops123"), "Demo Ops", now);

  const insMem = db.prepare(
    `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, ?)`
  );
  insMem.run(crypto.randomUUID(), orgId, ownerId, "owner");
  insMem.run(crypto.randomUUID(), orgId, acctId, "accountant");
  insMem.run(crypto.randomUUID(), orgId, opsId, "ops");

  const { ingestOrders, ingestCpr } = await import("../src/lib/ingest");
  const { runMatch } = await import("../src/lib/match");

  const fixtures = path.join(root, "fixtures");
  const read = (name: string) =>
    fs.readFileSync(path.join(fixtures, name), "utf8");

  ingestOrders(orgId, ownerId, "orders-tcs.example.csv", read("orders-tcs.example.csv"), "tcs");
  ingestOrders(orgId, ownerId, "orders-postex.example.csv", read("orders-postex.example.csv"), "postex");
  ingestCpr(orgId, ownerId, "tcs-payment-invoice.example.csv", read("tcs-payment-invoice.example.csv"), "tcs");
  ingestCpr(orgId, ownerId, "tcs-payment-detail.example.csv", read("tcs-payment-detail.example.csv"), "tcs");
  ingestCpr(orgId, ownerId, "postex-settlement-portal.example.csv", read("postex-settlement-portal.example.csv"), "postex");

  const { matchRunId, summary } = runMatch(orgId, ownerId);
  audit(orgId, ownerId, "seed_complete", { matchRunId, summary });

  closeDb();
  chmodDbArtifacts(dbPath);

  console.log("Seeded CodBooks at", dbPath);
  console.log("Org: Demo COD Store");
  console.log("");
  console.log("LOCAL/DEV demo logins (never use in production):");
  console.log("  Owner:      owner@codbooks.local / owner123");
  console.log("  Accountant: accountant@codbooks.local / acct123");
  console.log("  Ops:        ops@codbooks.local / ops123");
  console.log("");
  console.log("Match summary:", summary);
  console.log("Run: npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
