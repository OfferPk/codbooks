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
  parseRider,
  parseSwyft,
  parseShopifyOrders,
  parseWooCommerceOrders,
} from "@/lib/parsers";
import { parseSettlement, detectCourierCode } from "@/lib/importers";
import { getCourierIdByCode, getDb, closeDb } from "@/lib/db";

const sampleFx = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "fixtures", "samples", name), "utf8");
const fixtureFx = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");

describe("Courier Importers & Auto-Detection (Issue #3 & #24)", () => {
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

    it("detects Rider Pakistan from settlement headers", () => {
      const text = sampleFx("rider-settlement.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("rider");
      expect(detectCourierCode("rider")).toBe("rider");
    });

    it("detects Swyft Logistics from settlement headers", () => {
      const text = sampleFx("swyft-settlement.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("swyft");
      expect(detectCourierCode("swyft")).toBe("swyft");
    });

    it("detects Shopify orders export headers", () => {
      const text = sampleFx("shopify-orders.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("shopify_orders");
    });

    it("detects WooCommerce orders export headers", () => {
      const text = sampleFx("woocommerce-orders.sample.csv");
      const { headers } = parseCsv(text);
      expect(detectTemplate(headers)).toBe("woocommerce_orders");
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
      expect(rows[2].fee_return_paisa).toBe(15000);
      expect(rows[2].settle_flag).toBe(false);
    });
  });

  describe("3. M&P Express Importer", () => {
    it("parses M&P settlement rows with FED and net COD", () => {
      const text = sampleFx("mnp-settlement.sample.csv");
      const { rows, errors } = parseMnp(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(4);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("2000881901");
      expect(rows[0].order_ref).toBe("ORD-MNP-201");
      expect(rows[0].cod_booked_paisa).toBe(420000); // 4200 PKR
      expect(rows[0].fee_delivery_paisa).toBe(19000); // 190 PKR
      expect(rows[0].fee_gst_paisa).toBe(3040); // 30.40 PKR
      expect(rows[0].remitted_paisa).toBe(397960); // 3979.60 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].settlement_id).toBe("MNP-VCH-88201");

      // Row 3: RTO
      expect(rows[2].cn).toBe("2000881903");
      expect(rows[2].remitted_paisa).toBe(0);
      expect(rows[2].settle_flag).toBe(false);
    });
  });

  describe("4. Trax Logistics Importer", () => {
    it("parses Trax settlement rows with cash handling fee and sales tax", () => {
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

      // Row 3: Return
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

  describe("6. Rider Pakistan Importer", () => {
    it("parses Rider settlement rows with cash handling and net remittance", () => {
      const text = sampleFx("rider-settlement.sample.csv");
      const { rows, errors } = parseRider(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(3);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("RDR-901122");
      expect(rows[0].order_ref).toBe("ORD-SHP-101");
      expect(rows[0].cod_booked_paisa).toBe(350000); // 3500 PKR
      expect(rows[0].fee_delivery_paisa).toBe(22000); // 220 PKR
      expect(rows[0].fee_cash_handling_paisa).toBe(3500); // 35 PKR
      expect(rows[0].fee_gst_paisa).toBe(3500); // 35 PKR
      expect(rows[0].remitted_paisa).toBe(321000); // 3210 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].settlement_id).toBe("RDR-DISB-401");

      // Row 3: RTO
      expect(rows[2].cn).toBe("RDR-901124");
      expect(rows[2].remitted_paisa).toBe(0);
      expect(rows[2].delivery_status).toBe("RTO");
    });
  });

  describe("7. Swyft Logistics Importer", () => {
    it("parses Swyft settlement rows with fuel surcharge and net payable", () => {
      const text = sampleFx("swyft-settlement.sample.csv");
      const { rows, errors } = parseSwyft(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(3);

      // Row 1: Delivered
      expect(rows[0].cn).toBe("SWY-880011");
      expect(rows[0].order_ref).toBe("ORD-SWY-201");
      expect(rows[0].cod_booked_paisa).toBe(450000); // 4500 PKR
      expect(rows[0].fee_delivery_paisa).toBe(21000); // 210 PKR
      expect(rows[0].fee_cash_handling_paisa).toBe(4000); // 40 PKR fuel
      expect(rows[0].fee_gst_paisa).toBe(3200); // 32 PKR
      expect(rows[0].remitted_paisa).toBe(421800); // 4218 PKR
      expect(rows[0].settle_flag).toBe(true);
      expect(rows[0].settlement_id).toBe("SWY-VOUCH-88");

      // Row 3: Cancelled
      expect(rows[2].cn).toBe("SWY-880013");
      expect(rows[2].remitted_paisa).toBe(0);
    });
  });

  describe("8. Shopify & WooCommerce Orders Importers", () => {
    it("parses Shopify orders export with courier attribution and tracking", () => {
      const text = sampleFx("shopify-orders.sample.csv");
      const { rows, errors } = parseShopifyOrders(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(3);

      expect(rows[0].external_order_id).toBe("1001");
      expect(rows[0].customer_name).toBe("Usman Tariq");
      expect(rows[0].order_amount_paisa).toBe(350000);
      expect(rows[0].awb).toBe("RDR-901122");
      expect(rows[0].courier_code).toBe("rider");
      expect(rows[0].source).toBe("shopify");

      expect(rows[1].external_order_id).toBe("1002");
      expect(rows[1].courier_code).toBe("swyft");

      expect(rows[2].external_order_id).toBe("1003");
      expect(rows[2].courier_code).toBe("tcs");
    });

    it("parses WooCommerce orders export with shipping method courier extraction", () => {
      const text = sampleFx("woocommerce-orders.sample.csv");
      const { rows, errors } = parseWooCommerceOrders(text);

      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(2);

      expect(rows[0].external_order_id).toBe("1041");
      expect(rows[0].customer_name).toBe("Hassan Raza");
      expect(rows[0].order_amount_paisa).toBe(320000);
      expect(rows[0].awb).toBe("TRAX-554433");
      expect(rows[0].courier_code).toBe("trax");
      expect(rows[0].source).toBe("woocommerce");

      expect(rows[1].external_order_id).toBe("1042");
      expect(rows[1].courier_code).toBe("leopards");
    });

    it("automatically dispatches Shopify and WooCommerce orders in parseOrdersCsv", () => {
      const shopifyText = sampleFx("shopify-orders.sample.csv");
      const shopifyRes = parseOrdersCsv(shopifyText);
      expect(shopifyRes.rows).toHaveLength(3);
      expect(shopifyRes.rows[0].source).toBe("shopify");

      const wooText = sampleFx("woocommerce-orders.sample.csv");
      const wooRes = parseOrdersCsv(wooText);
      expect(wooRes.rows).toHaveLength(2);
      expect(wooRes.rows[0].source).toBe("woocommerce");
    });
  });

  describe("9. Unified parseSettlementByTemplate & Database Courier Resolution", () => {
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

      const rider = parseSettlementByTemplate(sampleFx("rider-settlement.sample.csv"));
      expect(rider.template).toBe("rider");
      expect(rider.courierCode).toBe("rider");
      expect(rider.rows).toHaveLength(3);

      const swyft = parseSettlementByTemplate(sampleFx("swyft-settlement.sample.csv"));
      expect(swyft.template).toBe("swyft");
      expect(swyft.courierCode).toBe("swyft");
      expect(swyft.rows).toHaveLength(3);
    });

    it("resolves courier database IDs dynamically for all couriers including Rider and Swyft", () => {
      expect(getCourierIdByCode("tcs")).toBeTruthy();
      expect(getCourierIdByCode("postex")).toBeTruthy();
      expect(getCourierIdByCode("leopards")).toBeTruthy();
      expect(getCourierIdByCode("mnp")).toBeTruthy();
      expect(getCourierIdByCode("trax")).toBeTruthy();
      expect(getCourierIdByCode("callcourier")).toBeTruthy();
      expect(getCourierIdByCode("rider")).toBeTruthy();
      expect(getCourierIdByCode("swyft")).toBeTruthy();
      expect(getCourierIdByCode("unknown_courier")).toBeNull();
    });

    it("attributes all couriers in parseOrdersCsv", () => {
      const orderCsv = `order_id,awb,cod_amount_pkr,courier
ORD-101,LE101,2500,Leopards
ORD-102,MNP102,3000,M&P
ORD-103,TRX103,1500,Trax
ORD-104,CC104,4000,Call Courier
ORD-105,RDR105,3500,Rider
ORD-106,SWY106,4200,Swyft`;

      const { rows, errors } = parseOrdersCsv(orderCsv);
      expect(errors).toHaveLength(0);
      expect(rows).toHaveLength(6);
      expect(rows[0].courier_code).toBe("leopards");
      expect(rows[1].courier_code).toBe("mnp");
      expect(rows[2].courier_code).toBe("trax");
      expect(rows[3].courier_code).toBe("callcourier");
      expect(rows[4].courier_code).toBe("rider");
      expect(rows[5].courier_code).toBe("swyft");
    });
  });
});
