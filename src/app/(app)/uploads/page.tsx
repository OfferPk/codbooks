"use client";

import { FormEvent, useEffect, useState } from "react";

type UploadRow = {
  id: string;
  kind: string;
  filename: string;
  row_count: number;
  status: string;
  courier_code: string | null;
  template_hint: string | null;
  created_at: string;
  uploaded_by_name: string | null;
  error_summary: string | null;
};

export default function UploadsPage() {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [kind, setKind] = useState<"orders" | "cpr">("orders");
  const [courier, setCourier] = useState("");
  const [msg, setMsg] = useState("");
  const [msgIsError, setMsgIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/uploads");
    if (res.ok) {
      const data = await res.json();
      setUploads(data.uploads || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("kind", kind);
    if (courier) formData.set("courier", courier);
    formData.set("auto_match", "true");
    setBusy(true);
    setMsg("");
    setMsgIsError(false);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsgIsError(true);
        setMsg(data.error || "Upload failed");
        return;
      }
      setMsg(
        `Uploaded ${data.rowCount} rows (${data.kind}${data.template ? ` / ${data.template}` : ""}).` +
          (data.match ? ` Match: ${JSON.stringify(data.match.summary)}` : ""),
      );
      form.reset();
      setKind("orders");
      setCourier("");
      load();
    } catch {
      setMsgIsError(true);
      setMsg("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function runMatch() {
    setBusy(true);
    setMsg("");
    setMsgIsError(false);
    try {
      const res = await fetch("/api/match", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsgIsError(true);
      setMsg(res.ok ? `Match complete: ${JSON.stringify(data.summary)}` : data.error || "Matching failed");
    } catch {
      setMsgIsError(true);
      setMsg("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Data intake · Reconciliation</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">Upload settlement files</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Add order exports and TCS or PostEx settlement files. A match run starts automatically after a successful upload.</p>
        </div>
        <span className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          {uploads.length} {uploads.length === 1 ? "upload" : "uploads"} in history
        </span>
      </div>

      <form onSubmit={onSubmit} className="card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Add CSV file</h2>
            <p className="mt-1 text-sm text-slate-500">Choose the file type and courier, then select a CSV to process.</p>
          </div>
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">CSV only</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(150px,.75fr)_minmax(190px,1fr)_minmax(280px,1.6fr)]">
          <div>
            <label className="label" htmlFor="upload-kind">File type</label>
            <select id="upload-kind" className="input" value={kind} onChange={(event) => setKind(event.target.value as "orders" | "cpr")}>
              <option value="orders">Order export</option>
              <option value="cpr">CPR / settlement</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="courier-hint">Courier {kind === "orders" ? "(optional; helps attribute unpaid orders)" : "(optional)"}</label>
            <select id="courier-hint" className="input" value={courier} onChange={(event) => setCourier(event.target.value)}>
              <option value="">{kind === "orders" ? "Use CSV column" : "Auto-detect"}</option>
              <option value="tcs">TCS</option>
              <option value="postex">PostEx</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="csv-file">CSV file</label>
            <input id="csv-file" className="input file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-800" type="file" name="file" accept=".csv,text/csv" required />
            <p className="mt-1.5 text-xs text-slate-400">Select a .csv file from your device.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="max-w-lg text-xs leading-5 text-slate-500">Order and courier files are reconciled using reference IDs and settlement amounts.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={runMatch} disabled={busy}>Re-run matching</button>
            <button type="submit" className="btn-primary" disabled={busy} aria-busy={busy}>
              {busy ? "Processing…" : "Upload & match"} <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
        {msg && (
          <p role={msgIsError ? "alert" : "status"} aria-live={msgIsError ? "assertive" : "polite"} className={`whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-6 ${msgIsError ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            {msg}
          </p>
        )}
      </form>

      <section className="card !p-2 sm:!p-3">
        <div className="flex flex-wrap items-end justify-between gap-3 px-2 pb-3 pt-1 sm:px-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">History</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Recent uploads</h2>
          </div>
          <span className="text-xs text-slate-500">Newest first</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[820px]">
            <thead>
              <tr><th>Uploaded</th><th>Type</th><th>File</th><th>Courier</th><th>Rows</th><th>Status</th></tr>
            </thead>
            <tbody>
              {uploads.length === 0 && (
                <tr>
                  <td colSpan={6} className="!py-12 text-center">
                    <span aria-hidden="true" className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-lg text-slate-500">↑</span>
                    <p className="mt-3 font-semibold text-slate-700">No uploads yet</p>
                    <p className="mt-1 text-xs text-slate-500">Your processed CSV files will appear here.</p>
                  </td>
                </tr>
              )}
              {uploads.map((upload) => (
                <tr key={upload.id}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{new Date(upload.created_at).toLocaleString()}</td>
                  <td><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold capitalize text-slate-700">{upload.kind}</span></td>
                  <td className="max-w-sm">
                    <span className="block truncate font-medium text-slate-800" title={upload.filename}>{upload.filename}</span>
                    {upload.error_summary && <span className="mt-1 block text-xs text-rose-700">{upload.error_summary}</span>}
                  </td>
                  <td className="font-semibold uppercase text-slate-600">{upload.courier_code || upload.template_hint || "—"}</td>
                  <td className="numeric">{upload.row_count}</td>
                  <td><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{upload.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
