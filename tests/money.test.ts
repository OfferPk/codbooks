import { describe, expect, it } from "vitest";
import { pkrToPaisa, paisaToPkr, formatPkr, withinTolerance } from "@/lib/money";

describe("money", () => {
  it("converts PKR to paisa", () => {
    expect(pkrToPaisa(2550)).toBe(255000);
    expect(pkrToPaisa("1,899.50")).toBe(189950);
    expect(pkrToPaisa("")).toBe(0);
  });
  it("formats PKR", () => {
    expect(formatPkr(255000)).toContain("2,550.00");
    expect(formatPkr(-100)).toContain("-");
  });
  it("tolerance PKR 1", () => {
    expect(withinTolerance(10000, 9900, 100)).toBe(true);
    expect(withinTolerance(10000, 9800, 100)).toBe(false);
  });
  it("round-trips", () => {
    expect(paisaToPkr(pkrToPaisa(12.34))).toBeCloseTo(12.34);
  });
});
