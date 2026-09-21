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
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-slate-500">
          Uploads and match runs for this organization.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-slate-400">
                  No events yet
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top">
                <td className="py-2 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td>{e.user_name || e.user_email || "—"}</td>
                <td className="font-mono text-xs">{e.action}</td>
                <td className="max-w-md truncate font-mono text-xs text-slate-500">
                  {e.meta_json}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
