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
const CHASE_STATUSES = new Set(["short", "unpaid", "unmatched", "double_paid"]);
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
  const [role, setRole] = useState("");
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
    const all = new Set([...DEFAULT_COURIERS, ...couriers]);
    return Array.from(all).filter(Boolean);
  }, [couriers]);

  function updateParams(next: { status?: string; courier?: string; q?: string; aging?: string }) {
    const params = new URLSearchParams();
    const nextStatus = next.status !== undefined ? next.status : status;
    const nextCourier = next.courier !== undefined ? next.courier : courier;
    const nextQuery = next.q !== undefined ? next.q : q;
    const nextAging = next.aging !== undefined ? next.aging : aging;
    if (nextStatus) params.set("status", nextStatus);
    if (nextCourier) params.set("courier", nextCourier);
    if (nextQuery) params.set("q", nextQuery);
    if (nextAging) params.set("aging", nextAging);
    const query = params.toString();
    router.replace(query ? `/matches?${query}` : "/matches");
  }

  useEffect(() => setQInput(q), [q]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setRole(data.user?.role || data.role || "");
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (courier) params.set("courier", courier);
    if (q) params.set("q", q);
    if (aging) params.set("aging", aging);
    const query = params.toString();
    fetch(`/api/matches${query ? `?${query}` : ""}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setMatches(data.matches || []);
        if (Array.isArray(data.couriers) && data.couriers.length) setCouriers(data.couriers);
        if (data.runs?.[0]) setSummary(data.runs[0].summary_json);
      })
      .catch(() => {});
  }, [status, courier, q, aging]);

  useEffect(() => load(), [load]);

  function clearFilters() {
    setQInput("");
    router.replace("/matches");
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateParams({ q: qInput.trim() });
  }

  function startEdit(match: MatchRow) {
    setEditingId(match.id);
    setEditNotes(match.notes || "");
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
    setMatches((previous) => previous.map((match) =>
      match.id === id ? { ...match, notes: data.match?.notes ?? editNotes } : match,
    ));
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Reconciliation · Review</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">Match results</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Search settlement lines, narrow them by courier or status, and add follow-up notes where needed.</p>
        </div>
        <span className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          {matches.length} {matches.length === 1 ? "line" : "lines"} shown
        </span>
      </div>

      <section className="card space-y-4">
        <form onSubmit={submitSearch} className="flex flex-wrap gap-2.5">
          <label className="sr-only" htmlFor="match-search">Search AWB, CN, order ID, or customer</label>
          <input
            id="match-search"
            className="input min-w-[220px] flex-1"
            placeholder="Search AWB, CN, order ID, customer…"
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
          />
          <button type="submit" className="btn-primary">Search</button>
          <button type="button" className="btn-secondary" onClick={clearFilters}>Clear</button>
        </form>

        {aging && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-xs font-semibold text-amber-900">Aging: {AGING_LABELS[aging] || aging} <span className="font-normal">(unpaid + short)</span></span>
            <button type="button" className="ml-auto text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2" onClick={() => updateParams({ aging: "" })}>Remove filter</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Courier</span>
          <button
            type="button"
            aria-pressed={!courier}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${!courier ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            onClick={() => updateParams({ courier: "" })}
          >All</button>
          {courierChips.map((code) => {
            const active = courier === code;
            return (
              <button
                key={code}
                type="button"
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase transition ${active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                onClick={() => updateParams({ courier: active ? "" : code })}
              >{code}</button>
            );
          })}
          <label className="sr-only" htmlFor="status-filter">Filter by match status</label>
          <select id="status-filter" className="input ml-auto w-auto min-w-[170px]" value={status} onChange={(event) => updateParams({ status: event.target.value })}>
            <option value="">All statuses</option>
            <option value="matched">Matched</option>
            <option value="short">Short</option>
            <option value="unpaid">Unpaid</option>
            <option value="unmatched">Unmatched</option>
            <option value="double_paid">Double-paid</option>
          </select>
        </div>
      </section>

      {summary && (
        <p className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-xs leading-5 text-slate-600">
          <span className="font-semibold text-slate-800">Latest run summary</span>
          <code className="ml-2 break-all font-mono text-[11px]">{summary}</code>
        </p>
      )}
      {noteError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{noteError}</p>}

      <section className="card !p-2 sm:!p-3">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[1100px]">
            <thead>
              <tr>
                <th>Status</th><th>Courier</th><th>Order</th><th>AWB / CN</th><th>Expected</th><th>Remitted</th><th>Short</th><th>Follow-up notes</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 && (
                <tr>
                  <td colSpan={8} className="!py-12 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-lg text-slate-500" aria-hidden="true">⌕</span>
                    <p className="mt-3 font-semibold text-slate-700">No match lines found</p>
                    <p className="mt-1 text-xs text-slate-500">Upload settlement files or clear filters to see more results.</p>
                  </td>
                </tr>
              )}
              {matches.map((match) => {
                const editable = canEditNotes && (CHASE_STATUSES.has(match.status) || match.status === "matched");
                return (
                  <tr key={match.id}>
                    <td><StatusBadge status={match.status} /></td>
                    <td className="font-semibold uppercase text-slate-700">{match.courier_code || "—"}</td>
                    <td>
                      <span className="font-semibold text-slate-800">{match.external_order_id || "—"}</span>
                      {match.customer_name && <span className="mt-1 block text-xs text-slate-500">{match.customer_name}</span>}
                    </td>
                    <td className="font-mono text-xs text-slate-600">{match.awb || match.cn || "—"}</td>
                    <td className="numeric font-medium">{pkr(match.expected_paisa)}</td>
                    <td className="numeric">{pkr(match.remitted_paisa < 0 ? 0 : match.remitted_paisa)}</td>
                    <td className="numeric font-semibold text-rose-700">{pkr(match.short_paisa)}</td>
                    <td className="min-w-[180px]">
                      {editingId === match.id ? (
                        <div className="space-y-2">
                          <label className="sr-only" htmlFor={`note-${match.id}`}>Follow-up note</label>
                          <textarea id={`note-${match.id}`} className="input min-w-[170px] text-xs" rows={2} maxLength={500} value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
                          <div className="flex gap-1.5">
                            <button type="button" className="btn-primary !px-2.5 !py-1.5 text-xs" disabled={noteBusy} onClick={() => saveNotes(match.id)}>{noteBusy ? "Saving…" : "Save note"}</button>
                            <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="whitespace-pre-wrap text-xs leading-5 text-slate-600">{match.notes || <span className="text-slate-400">No note added</span>}</p>
                          {editable && <button type="button" className="text-xs font-semibold text-emerald-700 hover:underline" onClick={() => startEdit(match)}>Edit note</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
