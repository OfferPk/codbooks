import { describe, expect, it } from "vitest";
import { classifyMatch } from "@/lib/match";

describe("classifyMatch", () => {
  it("matched within tolerance", () => {
    expect(classifyMatch(255000, 255000)).toBe("matched");
    expect(classifyMatch(255000, 254950)).toBe("matched");
  });
  it("short when remitted less", () => {
    expect(classifyMatch(255000, 243200)).toBe("short");
  });
  it("unpaid when remitted 0", () => {
    expect(classifyMatch(400000, 0)).toBe("unpaid");
  });
  it("unmatched settlement", () => {
    expect(classifyMatch(0, 1000, { noOrder: true })).toBe("unmatched");
  });
  it("double paid", () => {
    expect(classifyMatch(1000, 1000, { doublePaid: true })).toBe("double_paid");
  });
  it("settle false → unpaid", () => {
    expect(classifyMatch(220000, 0, { settleFalse: true })).toBe("unpaid");
  });
  it("postex sentinel -1 → matched", () => {
    expect(classifyMatch(220000, -1)).toBe("matched");
  });
});
