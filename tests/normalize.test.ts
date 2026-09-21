import { describe, expect, it } from "vitest";
import { normalizeAwb, normalizeCn, normalizeOrderId } from "@/lib/normalize";

describe("normalize", () => {
  it("uppercases and trims", () => {
    expect(normalizeAwb("  cx-example000001 ")).toBe("CX-EXAMPLE000001");
  });
  it("strips CN/AWB prefixes", () => {
    expect(normalizeCn("CN: 779400000001")).toBe("779400000001");
    expect(normalizeAwb("AWB-779400000001")).toBe("779400000001");
  });
  it("order ids", () => {
    expect(normalizeOrderId("Internet 591128")).toBe("INTERNET 591128");
  });
});
