"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPkr } from "@/lib/money";
import type { DashboardTrends, TrendTimeBucket } from "@/lib/trends";

export interface DashboardTrendsClientProps {
  initialWeeklyTrends: DashboardTrends;
  initialMonthlyTrends: DashboardTrends;
}

export function DashboardTrendsClient({
  initialWeeklyTrends,
  initialMonthlyTrends,
}: DashboardTrendsClientProps) {
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [selectedCourier, setSelectedCourier] = useState<string>("all");

  const currentTrends =
    periodType === "weekly" ? initialWeeklyTrends : initialMonthlyTrends;

  // Filter buckets by selected courier if applicable
  const displayBuckets = currentTrends.buckets.map((b: TrendTimeBucket) => {
    if (selectedCourier === "all") return b;
    const courierData = b.by_courier[selectedCourier];
    if (!courierData) {
      return {
        ...b,
        received_paisa: 0,
        pending_paisa: 0,
        expected_paisa: 0,
        recovery_rate: 0,
        matched_count: 0,
        unpaid_count: 0,
        short_count: 0,
        total_count: 0,
      };
    }
    return {
      ...b,
      received_paisa: courierData.received_paisa,
      pending_paisa: courierData.pending_paisa,
      expected_paisa: courierData.expected_paisa,
      recovery_rate: courierData.recovery_rate,
      matched_count: courierData.matched_count,
      unpaid_count: courierData.unpaid_count,
      short_count: courierData.short_count,
      total_count: courierData.total_count,
    };
  });

  // Calculate filtered totals
  const totalReceived = displayBuckets.reduce(
    (sum, b) => sum + b.received_paisa,
    0
  );
  const totalPending = displayBuckets.reduce(
    (sum, b) => sum + b.pending_paisa,
    0
  );
  const totalExpected = totalReceived + totalPending;
  const overallRate =
    totalExpected > 0
      ? Math.round((totalReceived / totalExpected) * 1000) / 10
      : totalReceived > 0
      ? 100
      : 0;

  const totalMatchedCount = displayBuckets.reduce(
    (sum, b) => sum + b.matched_count,
    0
  );
  const totalShortCount = displayBuckets.reduce(
    (sum, b) => sum + b.short_count,
    0
  );
  const totalUnpaidCount = displayBuckets.reduce(
    (sum, b) => sum + b.unpaid_count,
    0
  );

  return (
    <section className="card !p-0">
      {/* Header with Title and View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
            Performance & Recovery
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            COD settlement trends
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Courier Selector */}
          {currentTrends.couriers.length > 0 && (
            <select
              aria-label="Filter trends by courier"
              value={selectedCourier}
              onChange={(e) => setSelectedCourier(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Couriers ({currentTrends.couriers.length})</option>
              {currentTrends.couriers.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name || c.code.toUpperCase()}
                </option>
              ))}
            </select>
          )}

          {/* Period Toggle Button Group */}
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriodType("weekly")}
              className={`rounded-md px-3 py-1 transition ${
                periodType === "weekly"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setPeriodType("monthly")}
              className={`rounded-md px-3 py-1 transition ${
                periodType === "monthly"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid gap-px overflow-hidden border-b border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 sm:grid-cols-3">
        <div className="bg-white dark:bg-slate-900 px-5 py-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            COD Received / Settled
          </span>
          <span className="mt-2 block text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatPkr(totalReceived)}
          </span>
          <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
            {totalMatchedCount} matched / cleared shipment(s)
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 px-5 py-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            COD Pending / At-Risk
          </span>
          <span className="mt-2 block text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">
            {formatPkr(totalPending)}
          </span>
          <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
            {totalUnpaidCount} unpaid + {totalShortCount} short lines
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 px-5 py-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Settlement Recovery Rate
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {overallRate}%
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              of expected COD recovered
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, overallRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Time-Series Trend List */}
      <div className="p-5 sm:p-6">
        {displayBuckets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 px-5 py-8 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              No trend data available
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Run a match reconciliation or upload settlement sheets to view your weekly and monthly COD recovery trends.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayBuckets.map((bucket) => {
              const bExp = bucket.received_paisa + bucket.pending_paisa;
              const recPct =
                bExp > 0
                  ? Math.min(100, Math.round((bucket.received_paisa / bExp) * 100))
                  : 0;
              const pendPct = bExp > 0 ? 100 - recPct : 0;

              return (
                <div
                  key={bucket.period_key}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm transition hover:border-slate-200 dark:hover:border-slate-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {bucket.period_label}
                      </span>
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        {bucket.total_count} shipments
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Received: {formatPkr(bucket.received_paisa)}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        Pending: {formatPkr(bucket.pending_paisa)}
                      </span>
                      <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        {bucket.recovery_rate}% recovered
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Stacked Progress Bar */}
                  <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      title={`Received: ${recPct}%`}
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${recPct}%` }}
                    />
                    <div
                      title={`Pending: ${pendPct}%`}
                      className="h-full bg-rose-400 dark:bg-rose-500 transition-all duration-300"
                      style={{ width: `${pendPct}%` }}
                    />
                  </div>

                  {/* Courier Breakdown Chips within this period */}
                  {selectedCourier === "all" &&
                    Object.keys(bucket.by_courier).length > 1 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-50 dark:border-slate-800/60 text-xs">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Couriers:</span>
                        {Object.entries(bucket.by_courier).map(([cCode, cMetrics]) => (
                          <Link
                            key={cCode}
                            href={`/matches?courier=${encodeURIComponent(cCode)}`}
                            className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300 transition"
                          >
                            <span className="font-bold uppercase text-[10px] text-slate-500 dark:text-slate-400">
                              {cCode}:
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                              {formatPkr(cMetrics.received_paisa)}
                            </span>
                            {cMetrics.pending_paisa > 0 && (
                              <span className="text-rose-600 dark:text-rose-400">
                                / {formatPkr(cMetrics.pending_paisa)}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
