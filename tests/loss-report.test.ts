import { describe, expect, it } from "vitest";
import {
  detectShortPayments,
  detectDoubleChargedFees,
  detectReturnsMarkedDelivered,
  detectHeldPayments,
  compileLossReport,
  exportLossReportCsv,
  classifyHeldDays,
  type MatchInput,
  type OrderInput,
  type SettlementInput,
} from "@/lib/loss-report";
import { buildCourierComplaint } from "@/lib/loss-complaint";

describe("Loss Report - Detection Rules", () => {
  describe("Rule 1: detectShortPayments", () => {
    it("flags short matches and computes discrepancy in paisa and PKR", () => {
      const matches: MatchInput[] = [
        {
          id: "m1",
          order_id: "o1",
          settlement_line_id: "s1",
          status: "short",
          expected_paisa: 255000, // PKR 2550.00
          remitted_paisa: 243200, // PKR 2432.00
          short_paisa: 11800,     // PKR 118.00
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "779400000101",
          cn: "779400000101",
          notes: null,
          reference_date: "2026-09-09",
        },
        {
          id: "m2",
          order_id: "o2",
          settlement_line_id: "s2",
          status: "matched",
          expected_paisa: 189900,
          remitted_paisa: 189900,
          short_paisa: 0,
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "779400000102",
          cn: "779400000102",
          notes: null,
          reference_date: "2026-09-09",
        },
      ];

      const orders: OrderInput[] = [
        {
          id: "o1",
          external_order_id: "ORD-10001",
          awb: "779400000101",
          cn: "779400000101",
          customer_name: "Ahmad Raza",
          order_amount_paisa: 255000,
          ordered_at: "2026-09-09",
          status: "delivered",
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
        },
      ];

      const items = detectShortPayments({ matches, orders });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("short_payment");
      expect(items[0].courier_code).toBe("tcs");
      expect(items[0].external_order_id).toBe("ORD-10001");
      expect(items[0].customer_name).toBe("Ahmad Raza");
      expect(items[0].loss_paisa).toBe(11800);
      expect(items[0].loss_pkr).toBe(118);
      expect(items[0].reason).toContain("underpaid by PKR 118.00");
    });
  });

  describe("Rule 2: detectDoubleChargedFees", () => {
    it("flags duplicate delivery fees on the same tracking number", () => {
      const settlements: SettlementInput[] = [
        {
          id: "s1",
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "779400000501",
          cn: "779400000501",
          order_ref: "ORD-DUP-1",
          remitted_paisa: 200000,
          fee_delivery_paisa: 15000, // PKR 150 (initial legit fee)
          fee_return_paisa: 0,
          settled_at: "2026-09-10",
          settlement_id: "INV-101",
          delivery_status: "Delivered",
        },
        {
          id: "s2",
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "779400000501",
          cn: "779400000501",
          order_ref: "ORD-DUP-1",
          remitted_paisa: 0,
          fee_delivery_paisa: 15000, // PKR 150 (duplicate fee!)
          fee_return_paisa: 0,
          settled_at: "2026-09-17",
          settlement_id: "INV-102",
          delivery_status: "Delivered",
        },
      ];

      const items = detectDoubleChargedFees({ settlements });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("double_charged_fee");
      expect(items[0].loss_paisa).toBe(15000);
      expect(items[0].loss_pkr).toBe(150);
      expect(items[0].reason).toContain("Duplicate delivery fee of PKR 150.00");
    });

    it("flags return fee charged on a successfully delivered order", () => {
      const settlements: SettlementInput[] = [
        {
          id: "s3",
          courier_id: "c_postex",
          courier_code: "postex",
          courier_name: "PostEx",
          awb: "PX-777",
          cn: "PX-777",
          order_ref: "ORD-RET-ERR",
          remitted_paisa: 300000,
          fee_delivery_paisa: 18000,
          fee_return_paisa: 12000, // PKR 120 return fee deducted on delivered shipment!
          settled_at: "2026-09-12",
          settlement_id: "CPR-1",
          delivery_status: "Delivered",
        },
      ];

      const items = detectDoubleChargedFees({ settlements });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("double_charged_fee");
      expect(items[0].loss_paisa).toBe(12000);
      expect(items[0].loss_pkr).toBe(120);
      expect(items[0].reason).toContain("Invalid return fee");
    });
  });

  describe("Rule 3: detectReturnsMarkedDelivered", () => {
    it("flags orders marked RTO by merchant but claimed Delivered by courier with 0 remitted", () => {
      const orders: OrderInput[] = [
        {
          id: "o3",
          external_order_id: "ORD-RTO-DISPUTE",
          awb: "AWB-888",
          cn: "AWB-888",
          customer_name: "Usman Ali",
          order_amount_paisa: 350000, // PKR 3500
          ordered_at: "2026-09-01",
          status: "rto", // Merchant marked RTO
          courier_id: "c_tcs",
          courier_code: "tcs",
        },
      ];

      const settlements: SettlementInput[] = [
        {
          id: "s4",
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "AWB-888",
          cn: "AWB-888",
          order_ref: "ORD-RTO-DISPUTE",
          remitted_paisa: 0, // Zero COD remitted
          fee_delivery_paisa: 10000,
          fee_return_paisa: 0,
          settled_at: "2026-09-10",
          settlement_id: "INV-RTO",
          delivery_status: "Delivered", // Courier claims delivered!
        },
      ];

      const items = detectReturnsMarkedDelivered({ orders, settlements });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("return_marked_delivered");
      expect(items[0].loss_paisa).toBe(350000);
      expect(items[0].loss_pkr).toBe(3500);
      expect(items[0].reason).toContain("Merchant marked rto, but courier claims Delivered");
    });

    it("flags courier Delivered status with zero remitted COD on non-returned orders", () => {
      const orders: OrderInput[] = [
        {
          id: "o4",
          external_order_id: "ORD-FAKE-DELIVERY",
          awb: "AWB-999",
          cn: "AWB-999",
          customer_name: "Zainab Bibi",
          order_amount_paisa: 420000, // PKR 4200
          ordered_at: "2026-09-02",
          status: "shipped",
          courier_id: "c_postex",
          courier_code: "postex",
        },
      ];

      const settlements: SettlementInput[] = [
        {
          id: "s5",
          courier_id: "c_postex",
          courier_code: "postex",
          courier_name: "PostEx",
          awb: "AWB-999",
          cn: "AWB-999",
          order_ref: "ORD-FAKE-DELIVERY",
          remitted_paisa: 0,
          fee_delivery_paisa: 15000,
          fee_return_paisa: 0,
          settled_at: "2026-09-10",
          settlement_id: "CPR-99",
          delivery_status: "Delivered",
        },
      ];

      const items = detectReturnsMarkedDelivered({ orders, settlements });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("return_marked_delivered");
      expect(items[0].loss_paisa).toBe(420000);
      expect(items[0].reason).toContain("Courier reported Delivered, but remitted PKR 0.00 COD");
    });
  });

  describe("Rule 4: detectHeldPayments (7 / 14 / 30 days)", () => {
    it("correctly buckets held payments and ignores under 7 days", () => {
      expect(classifyHeldDays(0)).toBeNull();
      expect(classifyHeldDays(6)).toBeNull();
      expect(classifyHeldDays(7)).toBe("7-13");
      expect(classifyHeldDays(13)).toBe("7-13");
      expect(classifyHeldDays(14)).toBe("14-29");
      expect(classifyHeldDays(29)).toBe("14-29");
      expect(classifyHeldDays(30)).toBe("30+");
      expect(classifyHeldDays(60)).toBe("30+");
    });

    it("flags unpaid matches held beyond 7, 14, and 30 days", () => {
      const asOf = new Date("2026-09-30T12:00:00Z");

      const matches: MatchInput[] = [
        // 8 days ago -> 7-13 bucket
        {
          id: "m_held_8",
          order_id: "o_held_8",
          settlement_line_id: null,
          status: "unpaid",
          expected_paisa: 200000,
          remitted_paisa: 0,
          short_paisa: 200000,
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "HELD-8",
          cn: "HELD-8",
          notes: null,
          reference_date: "2026-09-22T00:00:00Z",
        },
        // 18 days ago -> 14-29 bucket
        {
          id: "m_held_18",
          order_id: "o_held_18",
          settlement_line_id: null,
          status: "unpaid",
          expected_paisa: 350000,
          remitted_paisa: 0,
          short_paisa: 350000,
          courier_id: "c_postex",
          courier_code: "postex",
          courier_name: "PostEx",
          awb: "HELD-18",
          cn: "HELD-18",
          notes: null,
          reference_date: "2026-09-12T00:00:00Z",
        },
        // 35 days ago -> 30+ bucket
        {
          id: "m_held_35",
          order_id: "o_held_35",
          settlement_line_id: null,
          status: "unpaid",
          expected_paisa: 500000,
          remitted_paisa: 0,
          short_paisa: 500000,
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "HELD-35",
          cn: "HELD-35",
          notes: null,
          reference_date: "2026-08-26T00:00:00Z",
        },
        // 3 days ago -> under 7 days -> SHOULD BE IGNORED
        {
          id: "m_fresh_3",
          order_id: "o_fresh_3",
          settlement_line_id: null,
          status: "unpaid",
          expected_paisa: 150000,
          remitted_paisa: 0,
          short_paisa: 150000,
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "FRESH-3",
          cn: "FRESH-3",
          notes: null,
          reference_date: "2026-09-27T00:00:00Z",
        },
      ];

      const items = detectHeldPayments({ matches, asOf });
      expect(items).toHaveLength(3);

      const item8 = items.find((i) => i.awb === "HELD-8");
      expect(item8?.held_bucket).toBe("7-13");
      expect(item8?.days_held).toBe(8);
      expect(item8?.loss_paisa).toBe(200000);

      const item18 = items.find((i) => i.awb === "HELD-18");
      expect(item18?.held_bucket).toBe("14-29");
      expect(item18?.days_held).toBe(18);

      const item35 = items.find((i) => i.awb === "HELD-35");
      expect(item35?.held_bucket).toBe("30+");
      expect(item35?.days_held).toBe(35);
    });
  });

  describe("Aggregations & Totals in PKR", () => {
    it("computes totals in PKR per courier and per category", () => {
      const items = [
        {
          id: "1",
          category: "short_payment" as const,
          courier_code: "tcs",
          courier_name: "TCS",
          order_id: "o1",
          external_order_id: "ORD-1",
          awb: "AWB-1",
          cn: "CN-1",
          customer_name: "Customer A",
          expected_paisa: 250000,
          remitted_paisa: 200000,
          loss_paisa: 50000, // PKR 500
          loss_pkr: 500,
          reference_date: "2026-09-01",
          days_held: null,
          held_bucket: null,
          reason: "Short payment",
        },
        {
          id: "2",
          category: "double_charged_fee" as const,
          courier_code: "tcs",
          courier_name: "TCS",
          order_id: "o2",
          external_order_id: "ORD-2",
          awb: "AWB-2",
          cn: "CN-2",
          customer_name: "Customer B",
          expected_paisa: 0,
          remitted_paisa: 0,
          loss_paisa: 15000, // PKR 150
          loss_pkr: 150,
          reference_date: "2026-09-02",
          days_held: null,
          held_bucket: null,
          reason: "Double fee",
        },
        {
          id: "3",
          category: "held_payment" as const,
          courier_code: "postex",
          courier_name: "PostEx",
          order_id: "o3",
          external_order_id: "ORD-3",
          awb: "AWB-3",
          cn: "CN-3",
          customer_name: "Customer C",
          expected_paisa: 300000,
          remitted_paisa: 0,
          loss_paisa: 300000, // PKR 3000
          loss_pkr: 3000,
          reference_date: "2026-08-15",
          days_held: 20,
          held_bucket: "14-29" as const,
          reason: "Held payment",
        },
      ];

      const report = compileLossReport(items);
      expect(report.total_loss_paisa).toBe(365000);
      expect(report.total_loss_pkr).toBe(3650);
      expect(report.total_issues).toBe(3);

      // By category
      expect(report.by_category.short_payment.count).toBe(1);
      expect(report.by_category.short_payment.loss_pkr).toBe(500);
      expect(report.by_category.double_charged_fee.count).toBe(1);
      expect(report.by_category.double_charged_fee.loss_pkr).toBe(150);
      expect(report.by_category.held_payment.count).toBe(1);
      expect(report.by_category.held_payment.loss_pkr).toBe(3000);

      // By courier
      expect(report.by_courier.tcs.total_loss_pkr).toBe(650);
      expect(report.by_courier.tcs.total_issues).toBe(2);
      expect(report.by_courier.postex.total_loss_pkr).toBe(3000);
      expect(report.by_courier.postex.total_issues).toBe(1);
    });
  });

  describe("CSV Export", () => {
    it("generates well-formatted CSV with headers and sanitized cells", () => {
      const items = [
        {
          id: "1",
          category: "short_payment" as const,
          courier_code: "tcs",
          courier_name: "TCS",
          order_id: "o1",
          external_order_id: "ORD-1",
          awb: "AWB-100",
          cn: "CN-100",
          customer_name: "Fatima Noor",
          expected_paisa: 250000,
          remitted_paisa: 200000,
          loss_paisa: 50000,
          loss_pkr: 500,
          reference_date: "2026-09-01T10:00:00Z",
          days_held: null,
          held_bucket: null,
          reason: "Short remitted COD",
        },
      ];

      const csv = exportLossReportCsv(items);
      expect(csv).toContain("Category,Courier,Order ID,Tracking AWB");
      expect(csv).toContain("Short Payment,TCS,ORD-1,AWB-100,CN-100,Fatima Noor,2026-09-01,,2500.00,2000.00,500.00,Short remitted COD");
    });
  });

  describe("Complaint Text Builder", () => {
    it("generates ready-to-copy dispute email and WhatsApp draft", () => {
      const items = [
        {
          id: "1",
          category: "short_payment" as const,
          courier_code: "tcs",
          courier_name: "TCS",
          order_id: "o1",
          external_order_id: "ORD-TCS-001",
          awb: "779400000101",
          cn: "779400000101",
          customer_name: "Muhammad Ali",
          expected_paisa: 255000,
          remitted_paisa: 243200,
          loss_paisa: 11800,
          loss_pkr: 118,
          reference_date: "2026-09-09",
          days_held: null,
          held_bucket: null,
          reason: "Short remitted COD",
        },
        {
          id: "2",
          category: "double_charged_fee" as const,
          courier_code: "tcs",
          courier_name: "TCS",
          order_id: "o2",
          external_order_id: "ORD-TCS-002",
          awb: "779400000102",
          cn: "779400000102",
          customer_name: "Kashif Mahmood",
          expected_paisa: 0,
          remitted_paisa: 0,
          loss_paisa: 15000,
          loss_pkr: 150,
          reference_date: "2026-09-10",
          days_held: null,
          held_bucket: null,
          reason: "Duplicate delivery fee",
        },
      ];

      const report = compileLossReport(items);
      const draft = buildCourierComplaint(report, {
        courier_code: "tcs",
        category: "all",
        merchant_name: "Shahdara Store",
        contact_person: "Muhammad Usman",
        contact_phone: "03001234567",
      });

      expect(draft.courier_name).toBe("TCS");
      expect(draft.affected_order_count).toBe(2);
      expect(draft.total_claims_pkr).toBe(268);
      expect(draft.subject).toContain("[DISPUTE CLAIM]");
      expect(draft.subject).toContain("TCS");
      expect(draft.subject).toContain("PKR 268.00");

      // Verify email body contains key details
      expect(draft.body).toContain("To: TCS Finance, Billing & COD Reconciliation Desk");
      expect(draft.body).toContain("ORD-TCS-001");
      expect(draft.body).toContain("779400000101");
      expect(draft.body).toContain("ORD-TCS-002");
      expect(draft.body).toContain("Muhammad Usman");
      expect(draft.body).toContain("Shahdara Store");

      // Verify WhatsApp text is concise and formatted
      expect(draft.whatsapp_text).toContain("*COD Dispute Claim — Shahdara Store vs TCS*");
      expect(draft.whatsapp_text).toContain("*Total Disputed Amount: PKR 268.00*");
      expect(draft.whatsapp_text).toContain("*Affected Shipments: 2*");
      expect(draft.whatsapp_text).toContain("779400000101");
    });
  });

  describe("Database Integration: getLossReport", () => {
    let dbFile: string;
    let orgId: string;
    let userId: string;

    it("generates full report from ingested fixtures and matches", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const { closeDb, getDb } = await import("@/lib/db");
      const { ingestOrders, ingestCpr } = await import("@/lib/ingest");
      const { runMatch } = await import("@/lib/match");
      const { hashPassword } = await import("@/lib/auth");
      const { getLossReport } = await import("@/lib/loss-report");

      closeDb();
      dbFile = path.join(
        os.tmpdir(),
        `codbooks-loss-test-${Date.now()}-${Math.random()}.db`
      );
      process.env.DATABASE_PATH = dbFile;
      const db = getDb();
      orgId = crypto.randomUUID();
      userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Test Store', 'seller', ?)`
      ).run(orgId, now);
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)`
      ).run(userId, "store@test.local", hashPassword("secret123"), "Store Owner", now);
      db.prepare(
        `INSERT INTO memberships (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')`
      ).run(crypto.randomUUID(), orgId, userId);

      const readFx = (name: string) =>
        fs.readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");

      // Ingest TCS orders and payment detail
      ingestOrders(orgId, userId, "orders-tcs.example.csv", readFx("orders-tcs.example.csv"));
      ingestCpr(orgId, userId, "tcs-payment-detail.example.csv", readFx("tcs-payment-detail.example.csv"));

      // Run reconciliation match
      runMatch(orgId, userId);

      // Run Loss Report with asOf set to a future date to test held payments
      const futureDate = new Date("2026-10-15T00:00:00Z");
      const report = getLossReport(orgId, futureDate);

      expect(report.total_issues).toBeGreaterThan(0);
      expect(report.total_loss_pkr).toBeGreaterThan(0);
      expect(report.by_courier.tcs).toBeDefined();
      expect(report.by_courier.tcs.total_loss_pkr).toBeGreaterThan(0);

      // Verify complaint draft generation works against DB report
      const complaint = buildCourierComplaint(report, {
        courier_code: "tcs",
        category: "all",
        merchant_name: "Test Store",
      });
      expect(complaint.affected_order_count).toBeGreaterThan(0);
      expect(complaint.subject).toContain("TCS");

      closeDb();
      for (const s of ["", "-wal", "-shm"]) {
        try {
          fs.unlinkSync(dbFile + s);
        } catch {
          /* ignore */
        }
      }
    });
  });
});
