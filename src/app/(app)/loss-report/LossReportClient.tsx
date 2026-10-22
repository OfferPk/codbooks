"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LossCategory,
  LossReportSummary,
} from "@/lib/loss-report";
import {
  buildWhatsAppShareUrl,
  type ComplaintDraft,
} from "@/lib/loss-complaint";

function formatMoney(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const CATEGORY_META: Record<
  LossCategory,
  { label: string; badgeClass: string; description: string }
> = {
  short_payment: {
    label: "Short Payment",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-200",
    description: "Courier remitted less cash than the booked order amount",
  },
  double_charged_fee: {
    label: "Double-Charged Fee",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-200",
    description: "Duplicate delivery fee or return fee deducted on delivered shipment",
  },
  return_marked_delivered: {
    label: "Return Discrepancy",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-200",
    description: "Conflicting return/delivered status or delivered with zero COD paid",
  },
  held_payment: {
    label: "Held Over SLA",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-200",
    description: "Unpaid COD held 7, 14, or 30+ days beyond settlement SLA",
  },
  excess_fee_overcharge: {
    label: "Fee Overcharge",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-200",
    description: "Freight exceeding standard PKR 400 ceiling or cash handling fee over 2.5%",
  },
};

export function LossReportClient() {
  const [data, setData] = useState<LossReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Complaint Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [complaintCourier, setComplaintCourier] = useState<string>("");
  const [complaintCategory, setComplaintCategory] = useState<string>("all");
  const [complaintDraft, setComplaintDraft] = useState<ComplaintDraft | null>(
    null
  );
  const [loadingComplaint, setLoadingComplaint] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"email" | "whatsapp">("email");

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        const res = await fetch("/api/loss-report");
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json: LossReportSummary = await res.json();
        setData(json);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load loss report";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }
      if (
        courierFilter !== "all" &&
        item.courier_code.toLowerCase() !== courierFilter.toLowerCase()
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAwb = item.awb?.toLowerCase().includes(q);
        const matchesCn = item.cn?.toLowerCase().includes(q);
        const matchesRef = item.external_order_id?.toLowerCase().includes(q);
        const matchesCust = item.customer_name?.toLowerCase().includes(q);
        const matchesReason = item.reason.toLowerCase().includes(q);
        if (
          !matchesAwb &&
          !matchesCn &&
          !matchesRef &&
          !matchesCust &&
          !matchesReason
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data, categoryFilter, courierFilter, searchQuery]);

  const filteredLossPkr = useMemo(() => {
    return filteredItems.reduce((acc, i) => acc + i.loss_pkr, 0);
  }, [filteredItems]);

  // Open complaint generator for a courier
  async function openComplaintModal(courierCode?: string) {
    const code =
      courierCode ||
      (courierFilter !== "all"
        ? courierFilter
        : Object.keys(data?.by_courier || {})[0] || "");
    setComplaintCourier(code);
    setComplaintCategory(categoryFilter !== "all" ? categoryFilter : "all");
    setModalOpen(true);
    await fetchComplaint(code, categoryFilter !== "all" ? categoryFilter : "all");
  }

  async function fetchComplaint(courier: string, category: string) {
    if (!courier) return;
    try {
      setLoadingComplaint(true);
      const url = `/api/loss-report?complaint=true&courier=${encodeURIComponent(
        courier
      )}&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not generate complaint draft");
      const json = await res.json();
      setComplaintDraft(json.complaint);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate complaint draft";
      alert(msg);
    } finally {
      setLoadingComplaint(false);
    }
  }

  function handleComplaintParamsChange(courier: string, cat: string) {
    setComplaintCourier(courier);
    setComplaintCategory(cat);
    fetchComplaint(courier, cat);
  }

  function copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopyFeedback(""), 3000);
  }

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (courierFilter !== "all") params.set("courier", courierFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    return `/api/loss-report/export?${params.toString()}`;
  }, [courierFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p className="text-sm">Analyzing settlements and detecting financial losses…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
        <h2 className="font-semibold">Unable to load Loss Report</h2>
        <p className="text-sm">{error || "No data returned."}</p>
      </div>
    );
  }

  const couriersList = Object.values(data.by_courier || {});

  return (
    <div className="space-y-6">
      {/* Printable Letterhead (visible only in print/PDF mode) */}
      <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
              COD Dispute &amp; Loss Reconciliation Summary
            </h1>
            <p className="text-xs text-slate-600">
              CodBooks Automated Courier Audit &amp; Settlement Discrepancy Ledger
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div><strong>Generated:</strong> {new Date().toLocaleDateString("en-PK")}</div>
            <div><strong>As of:</strong> {data.as_of ? new Date(data.as_of).toLocaleDateString("en-PK") : "Today"}</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 rounded border border-slate-300 p-2.5 text-xs bg-slate-50">
          <div>
            <div><strong>Total Disputed Amount:</strong> <span className="text-red-700 font-bold">{formatMoney(data.total_loss_pkr)}</span></div>
            <div><strong>Affected Shipments:</strong> {data.total_issues} parcels</div>
          </div>
          <div className="text-right">
            <div><strong>Dispute Scope:</strong> Short Remittances, Duplicate Fees, Return Discrepancies, Held COD</div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Loss Report &amp; Courier Disputes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Audit short payments, double-charged fees, fake return discrepancies, and overdue COD with ready-to-send dispute drafts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
            title="Print or Save as PDF Summary"
          >
            🖨️ Print / PDF
          </button>
          <a
            href={exportUrl}
            download
            className="btn btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            📥 Export CSV
          </a>
          <button
            type="button"
            onClick={() => openComplaintModal()}
            className="btn btn-primary inline-flex items-center gap-1.5 text-xs font-semibold"
          >
            ✍️ Draft Complaint
          </button>
        </div>
      </div>

      {/* KPI Cards: Totals in PKR */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {/* Total Disputed Loss */}
        <div className="card border-sky-200 bg-sky-50/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-800">
            Total Disputed Claim
          </p>
          <p className="mt-2 text-2xl font-bold text-sky-950">
            {formatMoney(data.total_loss_pkr)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {data.total_issues} shipment issue(s) detected
          </p>
        </div>

        {/* Short Payments */}
        <div className="card border-amber-200 bg-amber-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Short Payments
            </p>
            <span className="badge bg-amber-100 text-amber-800 text-[10px]">
              {data.by_category.short_payment.count} pcs
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatMoney(data.by_category.short_payment.loss_pkr)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Underpaid COD cash</p>
        </div>

        {/* Double-Charged Fees */}
        <div className="card border-purple-200 bg-purple-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-800">
              Double Fees
            </p>
            <span className="badge bg-purple-100 text-purple-800 text-[10px]">
              {data.by_category.double_charged_fee.count} pcs
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatMoney(data.by_category.double_charged_fee.loss_pkr)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Duplicate / invalid fees</p>
        </div>

        {/* Return Discrepancies */}
        <div className="card border-rose-200 bg-rose-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              Returns vs Delivered
            </p>
            <span className="badge bg-rose-100 text-rose-800 text-[10px]">
              {data.by_category.return_marked_delivered.count} pcs
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatMoney(data.by_category.return_marked_delivered.loss_pkr)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Status dispute / zero COD</p>
        </div>

        {/* Payments Held */}
        <div className="card border-orange-200 bg-orange-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-800">
              Held &gt; 7 Days
            </p>
            <span className="badge bg-orange-100 text-orange-800 text-[10px]">
              {data.by_category.held_payment.count} pcs
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatMoney(data.by_category.held_payment.loss_pkr)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Overdue unpaid cash</p>
        </div>

        {/* Fee Overcharges */}
        <div className="card border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">
              Fee Overcharges
            </p>
            <span className="badge bg-blue-100 text-blue-800 text-[10px]">
              {data.by_category.excess_fee_overcharge?.count || 0} pcs
            </span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {formatMoney(data.by_category.excess_fee_overcharge?.loss_pkr || 0)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Weight &amp; cash handling</p>
        </div>
      </div>

      {/* Courier Breakdown Row */}
      {couriersList.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Loss &amp; Dispute Breakdown by Courier
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {couriersList.map((c) => (
              <div
                key={c.courier_code}
                className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase text-slate-900">
                      {c.courier_name}
                    </span>
                    <span className="badge bg-slate-200 text-slate-700">
                      {c.total_issues} disputed item(s)
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-red-700">
                    {formatMoney(c.total_loss_pkr)}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Short COD:</span>
                      <span className="font-medium">
                        {formatMoney(c.by_category.short_payment.loss_pkr)} ({c.by_category.short_payment.count})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Duplicate Fees:</span>
                      <span className="font-medium">
                        {formatMoney(c.by_category.double_charged_fee.loss_pkr)} ({c.by_category.double_charged_fee.count})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status Discrepancies:</span>
                      <span className="font-medium">
                        {formatMoney(c.by_category.return_marked_delivered.loss_pkr)} ({c.by_category.return_marked_delivered.count})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Held Over SLA:</span>
                      <span className="font-medium">
                        {formatMoney(c.by_category.held_payment.loss_pkr)} ({c.by_category.held_payment.count})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fee Overcharges:</span>
                      <span className="font-medium">
                        {formatMoney(c.by_category.excess_fee_overcharge?.loss_pkr || 0)} ({c.by_category.excess_fee_overcharge?.count || 0})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 print:hidden">
                  <button
                    type="button"
                    onClick={() => openComplaintModal(c.courier_code)}
                    className="w-full btn btn-secondary text-xs py-1.5 text-sky-800 border-sky-200 bg-sky-50/50 hover:bg-sky-100"
                  >
                    Draft {c.courier_name} Complaint →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card space-y-4 print:hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Category:</span>
            {[
              { id: "all", label: "All Categories" },
              { id: "short_payment", label: "Short Payments" },
              { id: "double_charged_fee", label: "Double Fees" },
              { id: "return_marked_delivered", label: "Return vs Delivered" },
              { id: "held_payment", label: "Held COD" },
              { id: "excess_fee_overcharge", label: "Fee Overcharges" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  categoryFilter === cat.id
                    ? "bg-sky-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Courier:</span>
            <select
              value={courierFilter}
              onChange={(e) => setCourierFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:border-sky-500"
            >
              <option value="all">All Couriers</option>
              {couriersList.map((c) => (
                <option key={c.courier_code} value={c.courier_code}>
                  {c.courier_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by Order ID, Tracking AWB, CN, Customer name, or Reason…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full text-sm pl-9"
          />
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong>{filteredItems.length}</strong> disputed shipment(s)
            {categoryFilter !== "all" || courierFilter !== "all" || searchQuery
              ? " (filtered)"
              : ""}
          </span>
          <span>
            Total in selection:{" "}
            <strong className="text-red-600 font-semibold">
              {formatMoney(filteredLossPkr)}
            </strong>
          </span>
        </div>
      </div>

      {/* Disputed Orders Drill-Down Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Courier</th>
                <th className="px-3 py-2.5">Order / AWB / CN</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5 text-right">Expected</th>
                <th className="px-3 py-2.5 text-right">Remitted</th>
                <th className="px-3 py-2.5 text-right font-semibold text-red-600">
                  Loss / Claim
                </th>
                <th className="px-3 py-2.5">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No matching loss/dispute items found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const meta =
                    CATEGORY_META[item.category] || {
                      label: item.category,
                      badgeClass: "bg-slate-100 text-slate-700",
                    };
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className={`badge border text-[11px] ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium uppercase text-xs text-slate-700 whitespace-nowrap">
                        {item.courier_name}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-900">
                          {item.external_order_id || "—"}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {item.awb || item.cn || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs">
                        {item.customer_name || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-600 tabular-nums">
                        {item.expected_paisa > 0
                          ? formatMoney(item.expected_paisa / 100)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-600 tabular-nums">
                        {item.remitted_paisa > 0
                          ? formatMoney(item.remitted_paisa / 100)
                          : "PKR 0.00"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-red-700 tabular-nums text-xs">
                        {formatMoney(item.loss_pkr)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        <div>{item.reason}</div>
                        {item.reference_date && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Ref Date: {item.reference_date.substring(0, 10)}
                            {item.days_held !== null ? ` · ${item.days_held}d ago` : ""}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complaint Generator Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs print:hidden">
          <div className="card max-h-[90vh] w-full max-w-3xl overflow-hidden p-0 shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-900 text-base">
                  ✍️ Generate Courier Complaint Draft
                </h3>
                <p className="text-xs text-slate-500">
                  Ready-to-copy dispute letter and WhatsApp message for your courier rep.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Controls */}
            <div className="grid gap-3 sm:grid-cols-2 border-b border-slate-200 bg-white p-4">
              <div>
                <label className="label">Target Courier</label>
                <select
                  value={complaintCourier}
                  onChange={(e) =>
                    handleComplaintParamsChange(e.target.value, complaintCategory)
                  }
                  className="input text-xs"
                >
                  {couriersList.map((c) => (
                    <option key={c.courier_code} value={c.courier_code}>
                      {c.courier_name} ({formatMoney(c.total_loss_pkr)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Dispute Scope</label>
                <select
                  value={complaintCategory}
                  onChange={(e) =>
                    handleComplaintParamsChange(complaintCourier, e.target.value)
                  }
                  className="input text-xs"
                >
                  <option value="all">All Disputed Shipments</option>
                  <option value="short_payment">Short Payments Only</option>
                  <option value="double_charged_fee">Double-Charged Fees Only</option>
                  <option value="return_marked_delivered">
                    Return / Delivered Discrepancies
                  </option>
                  <option value="held_payment">Overdue Held COD Only</option>
                  <option value="excess_fee_overcharge">Fee Overcharges Only</option>
                </select>
              </div>
            </div>

            {/* Tabs for Email vs WhatsApp */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveTab("email")}
                className={`py-2 px-4 text-xs font-medium border-b-2 transition ${
                  activeTab === "email"
                    ? "border-sky-700 text-sky-800 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                📧 Formal Email / Letter
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("whatsapp")}
                className={`py-2 px-4 text-xs font-medium border-b-2 transition ${
                  activeTab === "whatsapp"
                    ? "border-emerald-600 text-emerald-800 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                📱 WhatsApp Draft
              </button>
            </div>

            {/* Text Preview Box */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {loadingComplaint ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Generating dispute text…
                </div>
              ) : complaintDraft ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span>
                      Claim Total:{" "}
                      <strong className="text-red-700 font-bold">
                        {complaintDraft.total_claims_formatted}
                      </strong>{" "}
                      across {complaintDraft.affected_order_count} shipment(s)
                    </span>
                    <div className="flex items-center gap-2">
                      {activeTab === "whatsapp" ? (
                        <>
                          <a
                            href={buildWhatsAppShareUrl(complaintDraft.whatsapp_text)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary text-xs py-1 inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                            title="Open WhatsApp Web or Mobile"
                          >
                            📲 Send to WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                complaintDraft.whatsapp_text,
                                "WhatsApp Draft"
                              )
                            }
                            className="btn btn-secondary text-xs py-1"
                          >
                            📋 Copy Text
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={`mailto:${encodeURIComponent(
                              complaintDraft.recipient_email || ""
                            )}?subject=${encodeURIComponent(
                              complaintDraft.subject
                            )}&body=${encodeURIComponent(complaintDraft.body)}`}
                            className="btn btn-secondary text-xs py-1 inline-flex items-center gap-1"
                            title="Open default email client"
                          >
                            📧 Open Mail
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                complaintDraft.body,
                                "Email Draft"
                              )
                            }
                            className="btn btn-secondary text-xs py-1"
                          >
                            📋 Copy Email
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {complaintDraft.recipient_email && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
                      <span className="font-semibold">Official Dispute Desk:</span>
                      <span>{complaintDraft.recipient_desk || complaintDraft.courier_name}</span>
                      <span className="font-mono text-sky-700 font-semibold underline">
                        &lt;{complaintDraft.recipient_email}&gt;
                      </span>
                    </div>
                  )}

                  {copyFeedback && (
                    <div className="rounded-md bg-emerald-50 p-2 text-xs font-semibold text-emerald-800 border border-emerald-200">
                      ✓ {copyFeedback}
                    </div>
                  )}

                  {activeTab === "email" && (
                    <div className="space-y-2">
                      <div className="rounded border border-slate-200 bg-white p-2 text-xs font-mono text-slate-700">
                        <strong>Subject:</strong> {complaintDraft.subject}
                      </div>
                      <textarea
                        readOnly
                        value={complaintDraft.body}
                        rows={16}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 outline-none"
                      />
                    </div>
                  )}

                  {activeTab === "whatsapp" && (
                    <textarea
                      readOnly
                      value={complaintDraft.whatsapp_text}
                      rows={14}
                      className="w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 outline-none"
                    />
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No disputes found for the selected courier and scope.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3">
              <span className="text-[11px] text-slate-500">
                ⚠️ Draft only. Never auto-sent. Verify amounts before submitting to courier.
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Sign-off & Declaration (visible only in print/PDF mode) */}
      <div className="hidden print:block mt-8 pt-6 border-t-2 border-slate-300 text-xs text-slate-700">
        <div className="grid grid-cols-2 gap-12">
          <div>
            <p className="font-semibold text-slate-900">Submitted by Merchant:</p>
            <div className="mt-10 border-t border-slate-400 pt-1 text-[11px] text-slate-500">
              Authorized Signature &amp; Date
            </div>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Acknowledged by Courier Representative:</p>
            <div className="mt-10 border-t border-slate-400 pt-1 text-[11px] text-slate-500">
              Courier Desk Signature &amp; Stamp
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-slate-400">
          Generated via CodBooks COD Reconciliation Platform · Confidential · For Official Dispute Resolution Only
        </p>
      </div>
    </div>
  );
}
