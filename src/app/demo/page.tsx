"use client";

import { useState } from "react";
import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";

interface DemoItem {
  id: string;
  category: "short_payment" | "double_charged_fee" | "held_payment" | "excess_fee_overcharge";
  categoryLabel: string;
  courier: string;
  orderId: string;
  tracking: string;
  customerName: string;
  expectedPkr: number;
  remittedPkr: number;
  lossPkr: number;
  reason: string;
  daysHeld?: number;
}

const DEMO_ITEMS: DemoItem[] = [
  {
    id: "d1",
    category: "short_payment",
    categoryLabel: "Short Payment",
    courier: "TCS",
    orderId: "ORD-9412",
    tracking: "779400000812",
    customerName: "Ayesha Malik (Lahore)",
    expectedPkr: 3850,
    remittedPkr: 3200,
    lossPkr: 650,
    reason: "Underpaid COD: Courier remitted PKR 3,200 vs booked invoice PKR 3,850",
  },
  {
    id: "d2",
    category: "double_charged_fee",
    categoryLabel: "Double Fee",
    courier: "PostEx",
    orderId: "ORD-9388",
    tracking: "PX-992140",
    customerName: "Bilal Tariq (Karachi)",
    expectedPkr: 0,
    remittedPkr: 2400,
    lossPkr: 180,
    reason: "Duplicate delivery fee deducted on tracking PX-992140 in successive CPRs",
  },
  {
    id: "d3",
    category: "held_payment",
    categoryLabel: "Held > 14 Days",
    courier: "Rider",
    orderId: "ORD-9210",
    tracking: "RDR-554109",
    customerName: "Hamza Farooq (Islamabad)",
    expectedPkr: 6200,
    remittedPkr: 0,
    lossPkr: 6200,
    daysHeld: 19,
    reason: "Delivered shipment unpaid: Remittance held for 19 days (SLA: 5 days)",
  },
  {
    id: "d4",
    category: "excess_fee_overcharge",
    categoryLabel: "Fee Overcharge",
    courier: "Swyft",
    orderId: "ORD-9104",
    tracking: "SWY-110294",
    customerName: "Zainab Bibi (Rawalpindi)",
    expectedPkr: 0,
    remittedPkr: 1950,
    lossPkr: 320,
    reason: "Arbitrary weight surcharge: Delivery fee PKR 720 exceeds PKR 400 standard tariff",
  },
  {
    id: "d5",
    category: "short_payment",
    categoryLabel: "Short Payment",
    courier: "Leopards",
    orderId: "ORD-9022",
    tracking: "LEO-448192",
    customerName: "Kamran Akmal (Peshawar)",
    expectedPkr: 4500,
    remittedPkr: 3750,
    lossPkr: 750,
    reason: "Short remittance on delivered COD parcel: PKR 750 deficit",
  },
  {
    id: "d6",
    category: "double_charged_fee",
    categoryLabel: "Invalid Return Fee",
    courier: "TCS",
    orderId: "ORD-8941",
    tracking: "779400000955",
    customerName: "Usman Ghani (Faisalabad)",
    expectedPkr: 0,
    remittedPkr: 2100,
    lossPkr: 150,
    reason: "Invalid return fee deducted on successfully delivered parcel",
  },
];

export default function DemoPage() {
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<DemoItem | null>(null);
  const [copied, setCopied] = useState(false);

  const filteredItems = DEMO_ITEMS.filter(
    (item) => courierFilter === "all" || item.courier.toLowerCase() === courierFilter.toLowerCase()
  );

  const totalDisputedPkr = DEMO_ITEMS.reduce((sum, i) => sum + i.lossPkr, 0);

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <PublicNav />

      {/* Demo Banner */}
      <div className="border-b border-sky-200 bg-sky-50/70 px-4 py-2.5 text-center text-xs font-medium text-sky-900 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-200">
        ✨ <strong>Interactive Demo Store</strong> — Showing real-world reconciliation scenarios from Pakistani logistics CPRs.
      </div>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              COD Settlement Audit &amp; Recovery Demo
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sample store shipping with TCS, PostEx, Rider, Swyft, and Leopards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/register" className="btn btn-primary text-xs py-2 px-4 shadow-sm">
              Audit My Store Free →
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card border-sky-200 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Total Disputed Claim
            </p>
            <p className="mt-2 text-2xl font-bold text-sky-950 dark:text-white">
              PKR {totalDisputedPkr.toLocaleString("en-PK")}.00
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Across {DEMO_ITEMS.length} flagged shipments
            </p>
          </div>

          <div className="card border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Short Payments
              </p>
              <span className="badge bg-amber-100 text-amber-900 text-[10px] dark:bg-amber-900 dark:text-amber-200">
                2 pcs
              </span>
            </div>
            <p className="mt-2 text-xl font-bold">PKR 1,400.00</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Underpaid COD remittances</p>
          </div>

          <div className="card border-purple-200 bg-purple-50/30 dark:border-purple-900 dark:bg-purple-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                Double / Invalid Fees
              </p>
              <span className="badge bg-purple-100 text-purple-900 text-[10px] dark:bg-purple-900 dark:text-purple-200">
                2 pcs
              </span>
            </div>
            <p className="mt-2 text-xl font-bold">PKR 330.00</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Deducted twice or erroneously</p>
          </div>

          <div className="card border-orange-200 bg-orange-50/30 dark:border-orange-900 dark:bg-orange-950/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                Held Over SLA
              </p>
              <span className="badge bg-orange-100 text-orange-900 text-[10px] dark:bg-orange-900 dark:text-orange-200">
                1 pc
              </span>
            </div>
            <p className="mt-2 text-xl font-bold text-red-700 dark:text-red-400">PKR 6,200.00</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Held 19 days without payment</p>
          </div>
        </div>

        {/* Courier Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500 mr-1">Filter Courier:</span>
            {["all", "tcs", "postex", "rider", "swyft", "leopards"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCourierFilter(c)}
                className={`rounded-lg px-2.5 py-1 font-medium uppercase transition ${
                  courierFilter === c
                    ? "bg-sky-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">
            Showing {filteredItems.length} of {DEMO_ITEMS.length} demo disputes
          </span>
        </div>

        {/* Table of Discrepancies */}
        <div className="card p-0 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Courier</th>
                  <th className="px-3 py-2.5">Order / Tracking</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5 text-right">Expected</th>
                  <th className="px-3 py-2.5 text-right">Remitted</th>
                  <th className="px-3 py-2.5 text-right text-red-600 dark:text-red-400">Claim Loss</th>
                  <th className="px-3 py-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="badge bg-slate-100 text-slate-800 border text-[11px] dark:bg-slate-800 dark:text-slate-200">
                        {item.categoryLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold uppercase text-slate-800 dark:text-slate-200">
                      {item.courier}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{item.orderId}</div>
                      <div className="font-mono text-[11px] text-slate-400">{item.tracking}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                      {item.customerName}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {item.expectedPkr > 0 ? `PKR ${item.expectedPkr.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      PKR {item.remittedPkr.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-red-700 dark:text-red-400 tabular-nums">
                      PKR {item.lossPkr.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDrawerItem(item)}
                        className="btn btn-secondary text-[11px] py-1 px-2 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                      >
                        Draft Claim ✍️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dispute Drawer Modal Preview */}
        {selectedDrawerItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="card w-full max-w-xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">
                    Dispute Draft Preview: {selectedDrawerItem.courier}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Claim for {selectedDrawerItem.orderId} ({selectedDrawerItem.tracking})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDrawerItem(null)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 text-xs font-mono space-y-1">
                <div><strong>To:</strong> {selectedDrawerItem.courier} COD Billing &amp; Reconciliation Desk</div>
                <div><strong>Subject:</strong> [DISPUTE] {selectedDrawerItem.categoryLabel} — {selectedDrawerItem.tracking} — PKR {selectedDrawerItem.lossPkr}.00</div>
              </div>

              <textarea
                readOnly
                rows={7}
                value={`Dear ${selectedDrawerItem.courier} Billing Team,\n\nDuring our regular COD reconciliation via CodBooks, we identified a discrepancy on consignment ${selectedDrawerItem.tracking} (Order ID: ${selectedDrawerItem.orderId}):\n\nReason: ${selectedDrawerItem.reason}\nDisputed Amount: PKR ${selectedDrawerItem.lossPkr}.00\n\nPlease verify against your CPR records and credit this amount in our upcoming payment cycle.\n\nRegards,\nFinance Team (Apex Store)`}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 outline-none"
              />

              {copied && (
                <div className="rounded-md bg-emerald-50 p-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ✓ Copied to clipboard!
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      `*COD Dispute — ${selectedDrawerItem.courier}*\nTracking: ${selectedDrawerItem.tracking}\nAmount: PKR ${selectedDrawerItem.lossPkr}\nReason: ${selectedDrawerItem.reason}`
                    )
                  }
                  className="btn btn-secondary text-xs py-1.5"
                >
                  📋 Copy Text
                </button>
                <Link
                  href="/register"
                  className="btn btn-primary text-xs py-1.5"
                >
                  Audit My Own CPRs →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 text-center dark:border-sky-900 dark:bg-sky-950/40">
          <h2 className="text-lg font-bold sm:text-xl">
            Ready to stop losing cash to courier settlement errors?
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto">
            CodBooks reconciles your daily TCS, PostEx, Rider, and Leopards CPRs in seconds.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="btn btn-primary text-xs py-2 px-4 font-bold">
              Start Free Today
            </Link>
            <Link href="/pricing" className="btn btn-secondary text-xs py-2 px-4">
              View Pricing Plans
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>© 2026 CodBooks. Built specifically for Pakistani e-commerce merchants.</p>
      </footer>
    </div>
  );
}
