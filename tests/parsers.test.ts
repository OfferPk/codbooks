import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  detectTemplate,
  parseOrdersCsv,
  parseTcsInvoice,
  parseTcsDetail,
  parsePostex,
} from "@/lib/parsers";
import { parseCsv } from "@/lib/csv";

const fx = (name: string) =>
  fs.readFileSync(path.join(process.cwd(), "fixtures", name), "utf8");

describe("parsers", () => {
  it("detects order template", () => {
    const { headers } = parseCsv(fx("orders-tcs.example.csv"));
    expect(detectTemplate(headers)).toBe("orders");
  });

  it("parses TCS invoice", () => {
    const { rows, errors } = parseTcsInvoice(
      fx("tcs-payment-invoice.example.csv")
    );
    expect(errors.length).toBe(0);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].cn).toBeTruthy();
    expect(rows[0].remitted_paisa).toBeGreaterThan(0);
  });

  it("parses TCS detail", () => {
    const { rows } = parseTcsDetail(fx("tcs-payment-detail.example.csv"));
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("parses PostEx portal", () => {
    const { rows } = parsePostex(fx("postex-settlement-portal.example.csv"));
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it("parses orders", () => {
    const { rows } = parseOrdersCsv(fx("orders-tcs.example.csv"));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0].order_amount_paisa).toBeGreaterThan(0);
  });
});
