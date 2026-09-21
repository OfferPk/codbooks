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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("kind", kind);
    if (courier) fd.set("courier", courier);
    fd.set("auto_match", "true");
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Upload failed");
      return;
    }
    setMsg(
      `Uploaded ${data.rowCount} rows (${data.kind}${
        data.template ? ` / ${data.template}` : ""
      }).` +
        (data.match
          ? ` Match: ${JSON.stringify(data.match.summary)}`
          : "")
    );
    form.reset();
    load();
  }

  async function runMatch() {
    setBusy(true);
    const res = await fetch("/api/match", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setMsg(res.ok ? `Match complete: ${JSON.stringify(data.summary)}` : data.error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Uploads</h1>
        <p className="text-sm text-slate-500">
          Upload order CSV and TCS / PostEx CPR settlement files. Matching runs
          automatically after each successful upload.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-3">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="label">Kind</label>
            <select
              className="input"
              value={kind}
              onChange={(e) => setKind(e.target.value as "orders" | "cpr")}
            >
              <option value="orders">Orders</option>
              <option value="cpr">CPR / Settlement</option>
            </select>
          </div>
          {kind === "cpr" && (
            <div>
              <label className="label">Courier hint (optional)</label>
              <select
                className="input"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
              >
                <option value="">Auto-detect</option>
                <option value="tcs">TCS</option>
                <option value="postex">PostEx</option>
              </select>
            </div>
          )}
          <div className="min-w-[220px] flex-1">
            <label className="label">CSV file</label>
            <input className="input" type="file" name="file" accept=".csv,text/csv" required />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Working…" : "Upload & match"}
          </button>
          <button type="button" className="btn-secondary" onClick={runMatch} disabled={busy}>
            Re-run match
          </button>
        </div>
        {msg && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 whitespace-pre-wrap">
            {msg}
          </p>
        )}
      </form>

      <div className="card overflow-x-auto">
        <h2 className="font-medium">Recent uploads</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">When</th>
              <th>Kind</th>
              <th>File</th>
              <th>Courier</th>
              <th>Rows</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {uploads.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-slate-400">
                  No uploads yet
                </td>
              </tr>
            )}
            {uploads.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2 whitespace-nowrap">
                  {new Date(u.created_at).toLocaleString()}
                </td>
                <td>{u.kind}</td>
                <td>
                  {u.filename}
                  {u.error_summary && (
                    <p className="text-xs text-red-600">{u.error_summary}</p>
                  )}
                </td>
                <td className="uppercase">{u.courier_code || u.template_hint || "—"}</td>
                <td>{u.row_count}</td>
                <td>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
