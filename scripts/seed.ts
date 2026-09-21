/**
 * Seed CodBooks demo org + users + fixture CSVs matched.
 * Usage: npm run seed
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const root = process.cwd();
const dbPath = process.env.DATABASE_PATH
  ? path.isAbsolute(process.env.DATABASE_PATH)
    ? process.env.DATABASE_PATH
    : path.join(root, process.env.DATABASE_PATH)
  : path.join(root, "data", "codbooks.db");

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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

  ingestOrders(orgId, ownerId, "orders-tcs.example.csv", read("orders-tcs.example.csv"));
  ingestOrders(orgId, ownerId, "orders-postex.example.csv", read("orders-postex.example.csv"));
  ingestCpr(orgId, ownerId, "tcs-payment-invoice.example.csv", read("tcs-payment-invoice.example.csv"), "tcs");
  ingestCpr(orgId, ownerId, "tcs-payment-detail.example.csv", read("tcs-payment-detail.example.csv"), "tcs");
  ingestCpr(orgId, ownerId, "postex-settlement-portal.example.csv", read("postex-settlement-portal.example.csv"), "postex");

  const { matchRunId, summary } = runMatch(orgId, ownerId);
  audit(orgId, ownerId, "seed_complete", { matchRunId, summary });

  closeDb();

  console.log("Seeded CodBooks at", dbPath);
  console.log("Org: Demo COD Store");
  console.log("");
  console.log("Demo logins:");
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
