import { describe, expect, it } from "vitest";
import {
  detectShortPayments,
  detectDoubleChargedFees,
  detectReturnsMarkedDelivered,
  detectHeldPayments,
  detectExcessFeeOvercharges,
  compileLossReport,
  exportLossReportCsv,
  classifyHeldDays,
  type MatchInput,
  type OrderInput,
  type SettlementInput,
} from "@/lib/loss-report";
import {
  buildCourierComplaint,
  buildWhatsAppShareUrl,
  getPrintableDisputeSummary,
  COURIER_DISPUTE_EMAILS,
  getCourierDisputeContact,
} from "@/lib/loss-complaint";

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

  describe("Rule 5: detectExcessFeeOvercharges", () => {
    it("flags freight delivery charges exceeding PKR 400 ceiling", () => {
      const settlements: SettlementInput[] = [
        {
          id: "s_over_1",
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "TCS-HIGH-FEE",
          cn: "TCS-HIGH-FEE",
          order_ref: "ORD-HIGH-1",
          remitted_paisa: 250000,
          fee_delivery_paisa: 62000, // PKR 620 vs 400 standard ceiling
          fee_return_paisa: 0,
          fee_cash_handling_paisa: 4000,
          settled_at: "2026-09-18",
          settlement_id: "CPR-O1",
          delivery_status: "Delivered",
        },
        {
          id: "s_normal_1",
          courier_id: "c_tcs",
          courier_code: "tcs",
          courier_name: "TCS",
          awb: "TCS-NORMAL",
          cn: "TCS-NORMAL",
          order_ref: "ORD-NORM-1",
          remitted_paisa: 250000,
          fee_delivery_paisa: 22000, // PKR 220 (normal)
          fee_return_paisa: 0,
          fee_cash_handling_paisa: 3000,
          settled_at: "2026-09-18",
          settlement_id: "CPR-O1",
          delivery_status: "Delivered",
        },
      ];

      const items = detectExcessFeeOvercharges({ settlements });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("excess_fee_overcharge");
      expect(items[0].loss_paisa).toBe(22000); // 62000 - 40000
      expect(items[0].loss_pkr).toBe(220);
      expect(items[0].reason).toContain("Excessive delivery/freight charge");
    });

    it("flags cash handling deduction exceeding 2.5% contractual SLA", () => {
      const settlements: SettlementInput[] = [
        {
          id: "s_cash_over",
          courier_id: "c_postex",
          courier_code: "postex",
          courier_name: "PostEx",
          awb: "PX-CASH-OVER",
          cn: "PX-CASH-OVER",
          order_ref: "ORD-CASH-1",
          remitted_paisa: 200000, // PKR 2,000 base
          fee_delivery_paisa: 20000,
          fee_return_paisa: 0,
          fee_cash_handling_paisa: 15000, // PKR 150 (7.5%!) vs 2.5% (PKR 50)
          settled_at: "2026-09-19",
          settlement_id: "CPR-P2",
          delivery_status: "Delivered",
        },
      ];

      const items = detectExcessFeeOvercharges({ settlements });
      expect(items).toHaveLength(1);
      expect(items[0].category).toBe("excess_fee_overcharge");
      expect(items[0].loss_paisa).toBe(10000); // 15000 - 5000
      expect(items[0].loss_pkr).toBe(100);
      expect(items[0].reason).toContain("Excessive cash handling deduction");
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
      expect(draft.recipient_email).toBe("cod.support@tcs.com.pk");
      expect(draft.body).toContain("cod.support@tcs.com.pk");
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

    it("maps all supported Pakistani couriers to official dispute desks and emails", () => {
      const couriers = [
        { code: "tcs", email: "cod.support@tcs.com.pk" },
        { code: "postex", email: "support@postex.pk" },
        { code: "leopards", email: "billing@leopardscourier.com" },
        { code: "mnp", email: "codcare@mulphilog.com" },
        { code: "trax", email: "billing@trax.pk" },
        { code: "callcourier", email: "cod@callcourier.com.pk" },
        { code: "rider", email: "support@withrider.com" },
        { code: "swyft", email: "finance@swyftlogistics.com" },
      ];

      for (const c of couriers) {
        const contact = getCourierDisputeContact(c.code);
        expect(contact.email).toBe(c.email);
        expect(contact.desk).toBeTruthy();
      }
    });

    it("generates WhatsApp dispatch link with optional phone number", () => {
      const urlWithoutPhone = buildWhatsAppShareUrl("Test message");
      expect(urlWithoutPhone).toBe("https://api.whatsapp.com/send?text=Test%20message");

      const urlWithPhone = buildWhatsAppShareUrl("Test message", "+92-300-1234567");
      expect(urlWithPhone).toBe("https://api.whatsapp.com/send?phone=923001234567&text=Test%20message");
    });

    it("compiles structured printable dispute summary for PDF printout", () => {
      const report = compileLossReport([
        {
          id: "item1",
          category: "short_payment",
          courier_code: "tcs",
          courier_name: "TCS",
          order_id: "o1",
          external_order_id: "ORD-001",
          awb: "AWB-001",
          cn: null,
          customer_name: "Ali",
          expected_paisa: 100000,
          remitted_paisa: 80000,
          loss_paisa: 20000,
          loss_pkr: 200,
          reference_date: "2026-09-01",
          days_held: null,
          held_bucket: null,
          reason: "Short remittance",
        },
      ]);

      const printable = getPrintableDisputeSummary(report, {
        merchant_name: "Apex Retail",
        contact_person: "Zaid Khan",
      });

      expect(printable.title).toContain("COD DISPUTE & LOSS RECONCILIATION SUMMARY");
      expect(printable.merchant_name).toBe("Apex Retail");
      expect(printable.contact_person).toBe("Zaid Khan");
      expect(printable.total_issues).toBe(1);
      expect(printable.total_loss_pkr).toBe(200);
      expect(printable.category_totals).toHaveLength(5);
      expect(printable.courier_breakdown[0].code).toBe("tcs");
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

    it("enforces multi-shop isolation when shopId is provided", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const { closeDb, getDb } = await import("@/lib/db");
      const { createShop } = await import("@/lib/shops");
      const { getLossReport } = await import("@/lib/loss-report");

      closeDb();
      const testDbFile = path.join(
        os.tmpdir(),
        `codbooks-loss-shop-test-${Date.now()}-${Math.random()}.db`
      );
      process.env.DATABASE_PATH = testDbFile;
      const db = getDb();
      const testOrgId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        `INSERT INTO orgs (id, name, type, created_at) VALUES (?, 'Multi-Shop Store', 'seller', ?)`
      ).run(testOrgId, now);

      const testUserId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, 'multishop@test.local', 'hash', 'Multi Owner', ?)`
      ).run(testUserId, now);

      const shop1 = createShop(testOrgId, "Lahore Branch", "LHE", true);
      const shop2 = createShop(testOrgId, "Karachi Branch", "KHI", false);

      const courierRow = db
        .prepare("SELECT id FROM couriers WHERE code = 'tcs'")
        .get() as { id: string } | undefined;
      const courierId = courierRow
        ? courierRow.id
        : (() => {
            const id = crypto.randomUUID();
            db.prepare(
              "INSERT INTO couriers (id, code, name) VALUES (?, 'tcs', 'TCS')"
            ).run(id);
            return id;
          })();

      // Create a match run for each shop
      const run1Id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO match_runs (id, org_id, shop_id, created_by, summary_json, created_at) VALUES (?, ?, ?, ?, '{}', ?)`
      ).run(run1Id, testOrgId, shop1.id, testUserId, now);

      const run2Id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO match_runs (id, org_id, shop_id, created_by, summary_json, created_at) VALUES (?, ?, ?, ?, '{}', ?)`
      ).run(run2Id, testOrgId, shop2.id, testUserId, now);

      // Disputed order in Shop 1: short by 500 PKR
      const o1Id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, shop_id, external_order_id, awb, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, ?, 'ORD-SHOP1-1', 'AWB-SHOP1', 'Customer 1', 200000, ?)`
      ).run(o1Id, testOrgId, shop1.id, now);

      db.prepare(
        `INSERT INTO matches (id, org_id, shop_id, match_run_id, order_id, courier_id, status, expected_paisa, remitted_paisa, short_paisa, awb, reference_date)
         VALUES (?, ?, ?, ?, ?, ?, 'short', 200000, 150000, 50000, 'AWB-SHOP1', ?)`
      ).run(crypto.randomUUID(), testOrgId, shop1.id, run1Id, o1Id, courierId, now);

      // Disputed order in Shop 2: short by 800 PKR
      const o2Id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO orders (id, org_id, shop_id, external_order_id, awb, customer_name, order_amount_paisa, created_at)
         VALUES (?, ?, ?, 'ORD-SHOP2-1', 'AWB-SHOP2', 'Customer 2', 300000, ?)`
      ).run(o2Id, testOrgId, shop2.id, now);

      db.prepare(
        `INSERT INTO matches (id, org_id, shop_id, match_run_id, order_id, courier_id, status, expected_paisa, remitted_paisa, short_paisa, awb, reference_date)
         VALUES (?, ?, ?, ?, ?, ?, 'short', 300000, 220000, 80000, 'AWB-SHOP2', ?)`
      ).run(crypto.randomUUID(), testOrgId, shop2.id, run2Id, o2Id, courierId, now);

      // Query scoped to Shop 1
      const reportShop1 = getLossReport(testOrgId, new Date(), shop1.id);
      expect(reportShop1.total_issues).toBe(1);
      expect(reportShop1.total_loss_pkr).toBe(500);
      expect(reportShop1.items[0].external_order_id).toBe("ORD-SHOP1-1");

      // Query scoped to Shop 2
      const reportShop2 = getLossReport(testOrgId, new Date(), shop2.id);
      expect(reportShop2.total_issues).toBe(1);
      expect(reportShop2.total_loss_pkr).toBe(800);
      expect(reportShop2.items[0].external_order_id).toBe("ORD-SHOP2-1");

      // Query across all shops (org-level)
      const reportAll = getLossReport(testOrgId, new Date(), null);
      expect(reportAll.total_issues).toBe(2);
      expect(reportAll.total_loss_pkr).toBe(1300);

      closeDb();
      for (const s of ["", "-wal", "-shm"]) {
        try {
          fs.unlinkSync(testDbFile + s);
        } catch {
          /* ignore */
        }
      }
    });
  });
});
