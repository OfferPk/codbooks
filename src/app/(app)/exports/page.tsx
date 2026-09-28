"use client";

import { useMemo, useState } from "react";

type StatusPreset = "all" | "chase" | "short" | "unpaid";

export default function ExportsPage() {
  const [preset, setPreset] = useState<StatusPreset>("chase");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const receivableHref = useMemo(() => {
    const p = new URLSearchParams();
    if (preset === "chase") p.set("status", "short,unpaid");
    else if (preset === "short") p.set("status", "short");
    else if (preset === "unpaid") p.set("status", "unpaid");
    // "all" → omit status
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const qs = p.toString();
    return qs ? `/api/export/receivable?${qs}` : "/api/export/receivable";
  }, [preset, from, to]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accountant exports</h1>
        <p className="text-sm text-slate-500">
          Download CSV ledgers from the latest match run / settlement lines.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="font-medium">COD receivable register</h2>
          <p className="text-sm text-slate-500">
            Status, courier, order, AWB, expected / remitted / short PKR. Filter
            by chase status and reference date window.
          </p>
          <div className="space-y-2">
            <label className="label">Status preset</label>
            <select
              className="input"
              value={preset}
              onChange={(e) => setPreset(e.target.value as StatusPreset)}
            >
              <option value="all">All statuses</option>
              <option value="chase">Chase (short + unpaid)</option>
              <option value="short">Short only</option>
              <option value="unpaid">Unpaid only</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="from">
                From (reference date)
              </label>
              <input
                id="from"
                type="date"
                className="input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="to">
                To
              </label>
              <input
                id="to"
                type="date"
                className="input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <a className="btn-primary inline-flex" href={receivableHref}>
            Download receivable.csv
          </a>
        </div>
        <div className="card space-y-3">
          <h2 className="font-medium">Fee breakdown</h2>
          <p className="text-sm text-slate-500">
            Delivery, return, GST, WHT, cash handling, other — per settlement
            line (full latest run).
          </p>
          <a className="btn-primary inline-flex" href="/api/export/fees">
            Download fees.csv
          </a>
        </div>
      </div>
    </div>
  );
}
