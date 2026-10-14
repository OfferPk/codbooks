"use client";

import { useEffect, useState } from "react";

type Event = {
  id: string;
  action: string;
  meta_json: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
};

export default function AuditPage() {
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch("/api/audit")
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Workspace · Activity</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">Audit log</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">A chronological record of uploads and reconciliation runs for this organization.</p>
      </div>
      <section className="card !p-2 sm:!p-3">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr><th>When</th><th>Team member</th><th>Action</th><th>Details</th></tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="!py-12 text-center">
                    <span aria-hidden="true" className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-lg text-slate-500">⌁</span>
                    <p className="mt-3 font-semibold text-slate-700">No activity recorded yet</p>
                    <p className="mt-1 text-xs text-slate-500">Uploads and match runs will appear here.</p>
                  </td>
                </tr>
              )}
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</td>
                  <td className="font-medium text-slate-800">{event.user_name || event.user_email || "—"}</td>
                  <td><span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">{event.action}</span></td>
                  <td className="max-w-lg truncate font-mono text-xs text-slate-500" title={event.meta_json || undefined}>{event.meta_json || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
