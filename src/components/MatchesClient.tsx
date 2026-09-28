"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";

type MatchRow = {
  id: string;
  status: string;
  awb: string | null;
  cn: string | null;
  expected_paisa: number;
  remitted_paisa: number;
  short_paisa: number;
  courier_code: string | null;
  external_order_id: string | null;
  customer_name: string | null;
  notes: string | null;
  reference_date: string | null;
};

function pkr(paisa: number) {
  return `PKR ${(paisa / 100).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const DEFAULT_COURIERS = ["tcs", "postex"];

export function MatchesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [couriers, setCouriers] = useState<string[]>(DEFAULT_COURIERS);
  const [summary, setSummary] = useState("");
  const [qInput, setQInput] = useState(searchParams.get("q") || "");

  const status = searchParams.get("status") || "";
  const courier = (searchParams.get("courier") || "").toLowerCase();
  const q = searchParams.get("q") || "";

  const courierChips = useMemo(() => {
    const set = new Set([...DEFAULT_COURIERS, ...couriers]);
    return Array.from(set).filter(Boolean);
  }, [couriers]);

  function updateParams(next: {
    status?: string;
    courier?: string;
    q?: string;
  }) {
    const p = new URLSearchParams();
    const st = next.status !== undefined ? next.status : status;
    const co = next.courier !== undefined ? next.courier : courier;
    const qq = next.q !== undefined ? next.q : q;
    if (st) p.set("status", st);
    if (co) p.set("courier", co);
    if (qq) p.set("q", qq);
    const qs = p.toString();
    router.replace(qs ? `/matches?${qs}` : "/matches");
  }

  useEffect(() => {
    setQInput(q);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (courier) params.set("courier", courier);
    if (q) params.set("q", q);
    const qs = params.toString();
    fetch(`/api/matches${qs ? `?${qs}` : ""}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setMatches(data.matches || []);
        if (Array.isArray(data.couriers) && data.couriers.length) {
          setCouriers(data.couriers);
        }
        if (data.runs?.[0]) {
          setSummary(data.runs[0].summary_json);
        }
      })
      .catch(() => {});
  }, [status, courier, q]);

  function clearFilters() {
    setQInput("");
    router.replace("/matches");
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    updateParams({ q: qInput.trim() });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Match results</h1>
          <p className="text-sm text-slate-500">
            Latest match run — search AWB / CN / order / customer; filter courier
            + status.
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
          <input
            className="input min-w-[200px] flex-1"
            placeholder="Search AWB, CN, order id, customer…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
          <button type="button" className="btn-secondary" onClick={clearFilters}>
            Clear
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase text-slate-500">
            Courier
          </span>
          <button
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${
              !courier
                ? "bg-sky-100 font-medium text-sky-800"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => updateParams({ courier: "" })}
          >
            All
          </button>
          {courierChips.map((code) => (
            <button
              key={code}
              type="button"
              className={`rounded-full px-3 py-1 text-xs uppercase ${
                courier === code
                  ? "bg-sky-100 font-medium text-sky-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() =>
                updateParams({ courier: courier === code ? "" : code })
              }
            >
              {code}
            </button>
          ))}
          <select
            className="input ml-auto w-auto"
            value={status}
            onChange={(e) => updateParams({ status: e.target.value })}
          >
            <option value="">All statuses</option>
            <option value="matched">matched</option>
            <option value="short">short</option>
            <option value="unpaid">unpaid</option>
            <option value="unmatched">unmatched</option>
            <option value="double_paid">double_paid</option>
          </select>
        </div>
      </div>

      {summary && (
        <p className="text-sm text-slate-600">
          Last run summary: <code className="text-xs">{summary}</code>
        </p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Status</th>
              <th>Courier</th>
              <th>Order</th>
              <th>AWB / CN</th>
              <th>Expected</th>
              <th>Remitted</th>
              <th>Short</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-slate-400">
                  No matches for this filter — upload fixtures and run match, or
                  clear filters.
                </td>
              </tr>
            )}
            {matches.map((m) => (
              <tr key={m.id} className="border-t border-slate-100 align-top">
                <td className="py-2">
                  <StatusBadge status={m.status} />
                </td>
                <td className="uppercase">{m.courier_code || "—"}</td>
                <td>
                  <div>{m.external_order_id || "—"}</div>
                  <div className="text-xs text-slate-500">{m.customer_name}</div>
                </td>
                <td className="font-mono text-xs">{m.awb || m.cn || "—"}</td>
                <td>{pkr(m.expected_paisa)}</td>
                <td>{pkr(m.remitted_paisa < 0 ? 0 : m.remitted_paisa)}</td>
                <td>{pkr(m.short_paisa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
