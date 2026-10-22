import { describe, it, expect, beforeEach } from "vitest";
import {
  getIsoWeekKey,
  getMonthKey,
  formatWeekLabel,
  formatMonthLabel,
  computeRecoveryRate,
  getDashboardTrends,
} from "../src/lib/trends";
import { getDb } from "../src/lib/db";

describe("Dashboard Trends - Date helpers & Rate calculation", () => {
  it("computes ISO week keys and month keys correctly", () => {
    // 2026-10-14 is Wednesday of Week 42 in 2026
    expect(getIsoWeekKey("2026-10-14")).toBe("2026-W42");
    expect(getMonthKey("2026-10-14")).toBe("2026-10");

    // Edge cases
    expect(getIsoWeekKey(null)).toBeNull();
    expect(getIsoWeekKey("")).toBeNull();
    expect(getIsoWeekKey("invalid-date")).toBeNull();
    expect(getMonthKey(null)).toBeNull();
  });

  it("formats week and month labels into readable strings", () => {
    const weekLabel = formatWeekLabel("2026-W42");
    expect(weekLabel).toContain("W42");

    const monthLabel = formatMonthLabel("2026-10");
    expect(monthLabel).toContain("Oct");
    expect(monthLabel).toContain("2026");

    expect(formatWeekLabel("invalid")).toBe("invalid");
  });

  it("computes recovery rate accurately with boundary handling", () => {
    expect(computeRecoveryRate(50000, 100000)).toBe(50);
    expect(computeRecoveryRate(75500, 100000)).toBe(75.5);
    expect(computeRecoveryRate(100000, 100000)).toBe(100);
    expect(computeRecoveryRate(0, 100000)).toBe(0);
    expect(computeRecoveryRate(0, 0)).toBe(0);
    expect(computeRecoveryRate(5000, 0)).toBe(100);
  });
});

describe("Dashboard Trends - Database Aggregations", () => {
  const orgId = "org_trends_test";
  const shopA = "shop_trends_a";
  const shopB = "shop_trends_b";

  beforeEach(() => {
    const db = getDb();

    // Clean up
    db.prepare("DELETE FROM matches WHERE org_id = ?").run(orgId);
    db.prepare("DELETE FROM match_runs WHERE org_id = ?").run(orgId);
    db.prepare("DELETE FROM shops WHERE org_id = ?").run(orgId);
    db.prepare("DELETE FROM orgs WHERE id = ?").run(orgId);

    // Seed org and shops
    const now = new Date().toISOString();
    db.prepare("INSERT INTO orgs (id, name, type, created_at) VALUES (?, ?, ?, ?)").run(
      orgId,
      "Trends Org",
      "seller",
      now
    );

    db.prepare("INSERT OR IGNORE INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
      "user_test",
      "trends_user@example.com",
      "hash",
      "Test User",
      now
    );

    db.prepare("INSERT INTO shops (id, org_id, name, is_default, created_at) VALUES (?, ?, ?, 1, ?)").run(
      shopA,
      orgId,
      "Shop Alpha",
      now
    );
    db.prepare("INSERT INTO shops (id, org_id, name, is_default, created_at) VALUES (?, ?, ?, 0, ?)").run(
      shopB,
      orgId,
      "Shop Beta",
      now
    );

    // Seed match run
    const runId = "run_trends_test";
    db.prepare(
      "INSERT INTO match_runs (id, org_id, created_at, created_by, summary_json) VALUES (?, ?, ?, ?, ?)"
    ).run(runId, orgId, now, "user_test", "{}");

    // Ensure couriers exist and get real IDs
    const getCourierId = (code: string, name: string): string => {
      const existing = db
        .prepare("SELECT id FROM couriers WHERE code = ?")
        .get(code) as { id: string } | undefined;
      if (existing) return existing.id;
      const newId = `courier_${code}`;
      db.prepare("INSERT INTO couriers (id, code, name) VALUES (?, ?, ?)").run(
        newId,
        code,
        name
      );
      return newId;
    };

    const tcsId = getCourierId("tcs", "TCS");
    const postexId = getCourierId("postex", "PostEx");
    const leopardsId = getCourierId("leopards", "Leopards");

    // Seed matches across different weeks and couriers
    const insertMatch = db.prepare(`
      INSERT INTO matches
        (id, match_run_id, org_id, shop_id, status, expected_paisa, remitted_paisa, short_paisa, courier_id, reference_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Week 40 (2026-10-01) - TCS Matched
    insertMatch.run(
      "m1",
      runId,
      orgId,
      shopA,
      "matched",
      100000,
      100000,
      0,
      tcsId,
      "2026-10-01"
    );

    // Week 41 (2026-10-08) - PostEx Short
    insertMatch.run(
      "m2",
      runId,
      orgId,
      shopA,
      "short",
      200000,
      150000,
      50000,
      postexId,
      "2026-10-08"
    );

    // Week 42 (2026-10-15) - Leopards Unpaid
    insertMatch.run(
      "m3",
      runId,
      orgId,
      shopA,
      "unpaid",
      300000,
      0,
      0,
      leopardsId,
      "2026-10-15"
    );

    // Week 42 (2026-10-15) - TCS Matched in Shop B
    insertMatch.run(
      "m4",
      runId,
      orgId,
      shopB,
      "matched",
      50000,
      50000,
      0,
      tcsId,
      "2026-10-15"
    );
  });

  it("returns weekly aggregated trends across couriers", () => {
    const trends = getDashboardTrends(orgId, { period: "weekly", limit: 8 });

    expect(trends.period_type).toBe("weekly");
    expect(trends.buckets.length).toBeGreaterThanOrEqual(3);

    // Total expected = 100k (m1) + 200k (m2) + 300k (m3) + 50k (m4) = 650k paisa
    expect(trends.totals.expected_paisa).toBe(650000);
    // Total received = 100k + 150k + 0 + 50k = 300k paisa
    expect(trends.totals.received_paisa).toBe(300000);
    // Total pending = 0 + 50k + 300k + 0 = 350k paisa
    expect(trends.totals.pending_paisa).toBe(350000);

    // Recovery rate: 300k / 650k = ~46.2%
    expect(trends.totals.recovery_rate).toBeCloseTo(46.2, 0);

    // Couriers catalog includes tcs, postex, leopards
    const courierCodes = trends.couriers.map((c) => c.code);
    expect(courierCodes).toContain("tcs");
    expect(courierCodes).toContain("postex");
    expect(courierCodes).toContain("leopards");
  });

  it("returns monthly aggregated trends", () => {
    const trends = getDashboardTrends(orgId, { period: "monthly" });

    expect(trends.period_type).toBe("monthly");
    expect(trends.buckets.length).toBe(1); // all 2026-10
    expect(trends.buckets[0].period_key).toBe("2026-10");
    expect(trends.buckets[0].period_label).toContain("Oct");
    expect(trends.buckets[0].received_paisa).toBe(300000);
    expect(trends.buckets[0].pending_paisa).toBe(350000);
  });

  it("filters trends by shop_id when provided", () => {
    const shopATrends = getDashboardTrends(orgId, {
      period: "weekly",
      shopId: shopA,
    });

    // Shop A excludes m4 (50k)
    expect(shopATrends.totals.expected_paisa).toBe(600000);
    expect(shopATrends.totals.received_paisa).toBe(250000);
    expect(shopATrends.totals.pending_paisa).toBe(350000);
  });

  it("handles empty organizations gracefully", () => {
    const emptyTrends = getDashboardTrends("org_non_existent");
    expect(emptyTrends.buckets).toEqual([]);
    expect(emptyTrends.couriers).toEqual([]);
    expect(emptyTrends.totals.received_paisa).toBe(0);
    expect(emptyTrends.totals.pending_paisa).toBe(0);
    expect(emptyTrends.totals.recovery_rate).toBe(0);
  });
});
