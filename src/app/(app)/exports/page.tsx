"use client";

import { useMemo, useState } from "react";

type StatusPreset = "all" | "chase" | "short" | "unpaid";

export default function ExportsPage() {
  const [preset, setPreset] = useState<StatusPreset>("chase");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const receivableHref = useMemo(() => {
    const params = new URLSearchParams();
    if (preset === "chase") params.set("status", "short,unpaid");
    else if (preset === "short") params.set("status", "short");
    else if (preset === "unpaid") params.set("status", "unpaid");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return query ? `/api/export/receivable?${query}` : "/api/export/receivable";
  }, [preset, from, to]);

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Reports · CSV</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">Accountant exports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Create clean, filterable ledgers from your reconciliation data and share them with your bookkeeper or accountant.
        </p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className="card space-y-5">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-800">₨</span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Receivables ledger</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">COD receivable register</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Status, courier, order, AWB, expected and remitted amounts, and any shortfall.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="status-preset">Include statuses</label>
              <select id="status-preset" className="input" value={preset} onChange={(e) => setPreset(e.target.value as StatusPreset)}>
                <option value="all">All statuses</option>
                <option value="chase">Needs follow-up (short + unpaid)</option>
                <option value="short">Short only</option>
                <option value="unpaid">Unpaid only</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="from">From date</label>
                <input id="from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="to">To date</label>
                <input id="to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">CSV format · Filtered by reference date</p>
            <a className="btn-primary" href={receivableHref}>
              Download register <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section className="card flex h-full flex-col space-y-5">
          <div className="flex items-start gap-4">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-lg font-bold text-amber-800">%</span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Settlement costs</p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Courier fee breakdown</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Delivery, return, GST, WHT, cash handling and other fees by settlement line.</p>
            </div>
          </div>
          <div className="flex flex-1 items-end justify-between gap-4 border-t border-slate-100 pt-4">
            <p className="max-w-xs text-xs leading-5 text-slate-500">Uses the latest completed match run and its settlement lines.</p>
            <a className="btn-secondary shrink-0" href="/api/export/fees">Download fees CSV <span aria-hidden="true">↓</span></a>
          </div>
        </section>
      </div>
    </div>
  );
}
