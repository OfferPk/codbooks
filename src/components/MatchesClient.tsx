"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
const CHASE_STATUSES = new Set([
  "short",
  "unpaid",
  "unmatched",
  "double_paid",
]);
const AGING_LABELS: Record<string, string> = {
  "<7": "Under 7 days",
  "7-14": "7–14 days",
  ">14": "Over 14 days",
};

export function MatchesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [couriers, setCouriers] = useState<string[]>(DEFAULT_COURIERS);
  const [summary, setSummary] = useState("");
  const [qInput, setQInput] = useState(searchParams.get("q") || "");
  const [role, setRole] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const status = searchParams.get("status") || "";
  const courier = (searchParams.get("courier") || "").toLowerCase();
  const q = searchParams.get("q") || "";
  const aging = searchParams.get("aging") || "";

  const canEditNotes = role === "owner" || role === "ops";

  const courierChips = useMemo(() => {
    const set = new Set([...DEFAULT_COURIERS, ...couriers]);
    return Array.from(set).filter(Boolean);
  }, [couriers]);

  function updateParams(next: {
    status?: string;
    courier?: string;
    q?: string;
    aging?: string;
  }) {
    const p = new URLSearchParams();
    const st = next.status !== undefined ? next.status : status;
    const co = next.courier !== undefined ? next.courier : courier;
    const qq = next.q !== undefined ? next.q : q;
    const ag = next.aging !== undefined ? next.aging : aging;
    if (st) p.set("status", st);
    if (co) p.set("courier", co);
    if (qq) p.set("q", qq);
    if (ag) p.set("aging", ag);
    const qs = p.toString();
    router.replace(qs ? `/matches?${qs}` : "/matches");
  }

  useEffect(() => {
    setQInput(q);
  }, [q]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        setRole(d.user?.role || d.role || "");
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (courier) params.set("courier", courier);
    if (q) params.set("q", q);
    if (aging) params.set("aging", aging);
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
  }, [status, courier, q, aging]);

  useEffect(() => {
    load();
  }, [load]);

  function clearFilters() {
    setQInput("");
    router.replace("/matches");
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    updateParams({ q: qInput.trim() });
  }

  function startEdit(m: MatchRow) {
    setEditingId(m.id);
    setEditNotes(m.notes || "");
    setNoteError("");
  }

  async function saveNotes(id: string) {
    setNoteBusy(true);
    setNoteError("");
    const res = await fetch(`/api/matches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editNotes }),
    });
    const data = await res.json().catch(() => ({}));
    setNoteBusy(false);
    if (!res.ok) {
      setNoteError(data.error || "Save failed");
      return;
    }
    setEditingId(null);
    setMatches((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, notes: data.match?.notes ?? editNotes } : m
      )
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Match results</h1>
          <p className="text-sm text-slate-500">
            Latest match run — search AWB / CN / order / customer; filter
            courier, status, aging. Annotate chase notes (owner/ops).
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
        {aging && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              Aging: {AGING_LABELS[aging] || aging} (unpaid + short)
            </span>
            <button
              type="button"
              className="text-xs text-sky-700 hover:underline"
              onClick={() => updateParams({ aging: "" })}
            >
              Clear aging
            </button>
          </div>
        )}
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

      {noteError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {noteError}
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
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {matches.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-slate-400">
                  No matches for this filter — upload fixtures and run match, or
                  clear filters.
                </td>
              </tr>
            )}
            {matches.map((m) => {
              const editable =
                canEditNotes &&
                (CHASE_STATUSES.has(m.status) || m.status === "matched");
              return (
                <tr key={m.id} className="border-t border-slate-100 align-top">
                  <td className="py-2">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="uppercase">{m.courier_code || "—"}</td>
                  <td>
                    <div>{m.external_order_id || "—"}</div>
                    <div className="text-xs text-slate-500">
                      {m.customer_name}
                    </div>
                  </td>
                  <td className="font-mono text-xs">{m.awb || m.cn || "—"}</td>
                  <td>{pkr(m.expected_paisa)}</td>
                  <td>{pkr(m.remitted_paisa < 0 ? 0 : m.remitted_paisa)}</td>
                  <td>{pkr(m.short_paisa)}</td>
                  <td className="min-w-[140px]">
                    {editingId === m.id ? (
                      <div className="space-y-1">
                        <textarea
                          className="input text-xs"
                          rows={2}
                          maxLength={500}
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="btn-primary !px-2 !py-0.5 text-xs"
                            disabled={noteBusy}
                            onClick={() => saveNotes(m.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-secondary !px-2 !py-0.5 text-xs"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="whitespace-pre-wrap text-xs text-slate-700">
                          {m.notes || (
                            <span className="text-slate-400">—</span>
                          )}
                        </p>
                        {editable && (
                          <button
                            type="button"
                            className="text-xs text-sky-700 hover:underline"
                            onClick={() => startEdit(m)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
