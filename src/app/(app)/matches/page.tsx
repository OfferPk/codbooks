"use client";

import { useEffect, useState } from "react";
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

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [filter, setFilter] = useState("");
  const [summary, setSummary] = useState("");

  async function load(status?: string) {
    const q = status ? `?status=${status}` : "";
    const res = await fetch(`/api/matches${q}`);
    if (!res.ok) return;
    const data = await res.json();
    setMatches(data.matches || []);
    if (data.runs?.[0]) {
      setSummary(data.runs[0].summary_json);
    }
  }

  useEffect(() => {
    load(filter || undefined);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Match results</h1>
          <p className="text-sm text-slate-500">
            Latest match run — AWB → CN → order id.
          </p>
        </div>
        <select
          className="input w-auto"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="matched">matched</option>
          <option value="short">short</option>
          <option value="unpaid">unpaid</option>
          <option value="unmatched">unmatched</option>
          <option value="double_paid">double_paid</option>
        </select>
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
                  No matches yet — upload fixtures and run match.
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
                <td className="font-mono text-xs">
                  {m.awb || m.cn || "—"}
                </td>
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
