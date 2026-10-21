import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";
import {
  detectTemplate,
  parseOrdersCsv,
  parseSettlementByTemplate,
  parseLeopards,
  parseMnp,
  parseTrax,
  parseCallCourier,
} from "@/lib/parsers";
import { parseSettlement, detectCourierCode } from "@/lib/importers";
import { getCourierIdByCode, getDb, closeDb } from "@/lib/db";

const sampleFx = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "fixtures", "samples", name), "utf8");
const fixtureFx = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");

describe("Courier Importers & Auto-Detection (Issue #3)", () => {
  describe("1. Header Auto-Detection", () => {
    it("detects Leopards Courier from settlement headers", () => {
      const text = sampleFx("leopards-settlement.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("leopards");
      expect(detectCourierCode("leopards")).toBe("leopards");
    });

    it("detects M&P Express Logistics from settlement headers", () => {
      const text = sampleFx("mnp-settlement.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("mnp");
      expect(detectCourierCode("mnp")).toBe("mnp");
    });

    it("detects Trax Logistics from settlement headers", () => {
      const text = sampleFx("trax-settlement.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("trax");
      expect(detectCourierCode("trax")).toBe("trax");
    });

    it("detects Call Courier from settlement headers", () => {
      const text = sampleFx("callcourier-settlement.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("callcourier");
      expect(detectCourierCode("callcourier")).toBe("callcourier");
    });

    it("keeps existing TCS and PostEx auto-detection working", () => {
      const tcsInv = fixtureFx("tcs-payment-invoice.example.csv");
      expect(detectTemplate(parseCsv(tcsInv).headers)).toBe("tcs_invoice");

      const tcsDet = fixtureFx("tcs-payment-detail.example.csv");
      expect(detectTemplate(parseCsv(tcsDet).headers)).toBe("tcs_detail");

      const postexPortal = fixtureFx("postex-settlement-portal.example.csv");
      expect(detectTemplate(parseCsv(postexPortal).headers)).toBe("postex_portal");

      const postexApi = fixtureFx("postex-payment-status.example.csv");
      expect(detectTemplate(parseCsv(postexApi).headers)).toBe("postex");
    });

    it("returns unknown and clear error for unrecognized headers", () => {
      const randomCsv = "foo,bar,baz\n1,2,3";
      const { headers } = parseCsv(randomCsv);
      expect(detectTemplate(headers)).toBe("unknown");

      const res = parseSettlementByTemplate(randomCsv);
      expect(res.template).toBe("unknown");
      expect(res.rows.length).toBe(0);
      expect(res.errors[0]).toContain("Unrecognized CPR/settlement CSV headers");
    });
  });

  describe("2. Leopards Importer", () => {
    it("parses Leopards settlement rows with amounts, fees, and RTO detection", () => {
      const text = sampleFx("leopards-settlement.sample.csv");
      const { rows, errors } = parseLeopards(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(4);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("LE7020000001");
      expect(rows[0].order_ref).toBe("ORD-LEO-101");
      expect(rows[0].cod_booked_paisa).toBe(350000); // 3500 PKR
      expect(rows[0].fee_delivery_paisa).toBe(18000); // 180 PKR
      expect(rows[0].fee_gst_paisa).toBe(2880); // 28.80 PKR
      expect(rows[0].remitted_paisa).toBe(329120); // 3291.20 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].delivery_status).toBe("Delivered");
      expect(rows[0].settled_at).toBe("2026-10-15");
      expect(rows[0].settlement_id).toBe("LEO-ST-99101");

      // Row 3: Return to Origin (RTO)
      expect(rows[2].cn).toBe("LE7020000003");
      expect(rows[2].remitted_paisa).toBe(0);
      expect(rows[2].settle_flag).toBe(false);
      expect(rows[2].fee_return_paisa).toBe(15000);
    });
  });

  describe("3. M&P Importer", () => {
    it("parses M&P reimbursement rows with FED, WHT, and net amounts", () => {
      const text = sampleFx("mnp-settlement.sample.csv");
      const { rows, errors } = parseMnp(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(4);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("2000881901");
      expect(rows[0].order_ref).toBe("ORD-MNP-201");
      expect(rows[0].cod_booked_paisa).toBe(420000); // 4200 PKR
      expect(rows[0].fee_delivery_paisa).toBe(19000); // 190 PKR
      expect(rows[0].fee_gst_paisa).toBe(3040); // 30.40 PKR (FED)
      expect(rows[0].remitted_paisa).toBe(397960); // 3979.60 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].settlement_id).toBe("MNP-VCH-88201");

      // Row 3: RTO
      expect(rows[2].cn).toBe("2000881903");
      expect(rows[2].remitted_paisa).toBe(0);
      expect(rows[2].settle_flag).toBe(false);
    });
  });

  describe("4. Trax Importer", () => {
    it("parses Trax disbursement rows with cash handling fee and delivery status", () => {
      const text = sampleFx("trax-settlement.sample.csv");
      const { rows, errors } = parseTrax(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(4);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("TRX8910001");
      expect(rows[0].order_ref).toBe("ORD-TRX-301");
      expect(rows[0].cod_booked_paisa).toBe(560000); // 5600 PKR
      expect(rows[0].fee_delivery_paisa).toBe(21000); // 210 PKR
      expect(rows[0].fee_cash_handling_paisa).toBe(5000); // 50 PKR
      expect(rows[0].fee_gst_paisa).toBe(3360); // 33.60 PKR
      expect(rows[0].remitted_paisa).toBe(530640); // 5306.40 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].settlement_id).toBe("TRX-DISB-77301");

      // Row 3: Returned to Shipper
      expect(rows[2].cn).toBe("TRX8910003");
      expect(rows[2].remitted_paisa).toBe(0);
      expect(rows[2].settle_flag).toBe(false);
    });
  });

  describe("5. Call Courier Importer", () => {
    it("parses Call Courier reimbursement rows with bank charges and balance", () => {
      const text = sampleFx("callcourier-settlement.sample.csv");
      const { rows, errors } = parseCallCourier(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(4);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("CC654001");
      expect(rows[0].order_ref).toBe("ORD-CC-401");
      expect(rows[0].cod_booked_paisa).toBe(320000); // 3200 PKR
      expect(rows[0].fee_delivery_paisa).toBe(16000); // 160 PKR
      expect(rows[0].fee_gst_paisa).toBe(2560); // 25.60 PKR
      expect(rows[0].fee_cash_handling_paisa).toBe(2000); // 20 PKR bank charges
      expect(rows[0].remitted_paisa).toBe(299440); // 2994.40 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].settlement_id).toBe("CC-ST-55401");

      // Row 3: Return
      expect(rows[2].cn).toBe("CC654003");
      expect(rows[2].remitted_paisa).toBe(0);
      expect(rows[2].settle_flag).toBe(false);
    });
  });

  describe("6. Unified parseSettlementByTemplate & Database Courier Resolution", () => {
    it("parses all couriers through parseSettlementByTemplate without manual hint", () => {
      const leopards = parseSettlementByTemplate(sampleFx("leopards-settlement.sample.csv"));
      expect(leopards.template).toBe("leopards");
      expect(leopards.courierCode).toBe("leopards");
      expect(leopards.rows).toHaveLength(4);

      const mnp = parseSettlementByTemplate(sampleFx("mnp-settlement.sample.csv"));
      expect(mnp.template).toBe("mnp");
      expect(mnp.courierCode).toBe("mnp");
      expect(mnp.rows).toHaveLength(4);

      const trax = parseSettlementByTemplate(sampleFx("trax-settlement.sample.csv"));
      expect(trax.template).toBe("trax");
      expect(trax.courierCode).toBe("trax");
      expect(trax.rows).toHaveLength(4);

      const cc = parseSettlementByTemplate(sampleFx("callcourier-settlement.sample.csv"));
      expect(cc.template).toBe("callcourier");
      expect(cc.courierCode).toBe("callcourier");
      expect(cc.rows).toHaveLength(4);
    });

    it("resolves courier database IDs dynamically for all couriers", () => {
      expect(getCourierIdByCode("tcs")).toBeTruthy();
      expect(getCourierIdByCode("postex")).toBeTruthy();
      expect(getCourierIdByCode("leopards")).toBeTruthy();
      expect(getCourierIdByCode("mnp")).toBeTruthy();
      expect(getCourierIdByCode("trax")).toBeTruthy();
      expect(getCourierIdByCode("callcourier")).toBeTruthy();
      expect(getCourierIdByCode("unknown_courier")).toBeNull();
    });

    it("attributes new couriers in parseOrdersCsv", () => {
      const orderCsv = `order_id,awb,cod_amount_pkr,courier
ORD-101,LE101,2500,Leopards
ORD-102,MNP102,3000,M&P
ORD-103,TRX103,1500,Trax
ORD-104,CC104,4000,Call Courier`;

      const { rows, errors } = parseOrdersCsv(orderCsv);
      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(4);
      expect(rows[0].courier_code).toBe("leopards");
      expect(rows[1].courier_code).toBe("mnp");
      expect(rows[2].courier_code).toBe("trax");
      expect(rows[3].courier_code).toBe("callcourier");
    });
  });
});
