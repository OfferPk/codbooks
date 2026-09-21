import { describe, expect, it } from "vitest";
import { agingBucket, daysBetween, agingBucketFromDate } from "@/lib/aging";

describe("aging", () => {
  it("buckets days", () => {
    expect(agingBucket(0)).toBe("<7");
    expect(agingBucket(6)).toBe("<7");
    expect(agingBucket(7)).toBe("7-14");
    expect(agingBucket(14)).toBe("7-14");
    expect(agingBucket(15)).toBe(">14");
  });
  it("daysBetween", () => {
    const asOf = new Date("2026-09-21T12:00:00+05:00");
    expect(daysBetween("2026-09-14T00:00:00+05:00", asOf)).toBe(7);
  });
  it("from date", () => {
    const asOf = new Date("2026-09-21");
    expect(agingBucketFromDate("2026-08-01", asOf)).toBe(">14");
    expect(agingBucketFromDate(null)).toBeNull();
  });
});
