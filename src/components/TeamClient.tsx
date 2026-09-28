"use client";

import { FormEvent, useEffect, useState } from "react";

type Row = {
  id: string;
  email: string;
  name: string;
  role: string;
  membership_id: string;
  created_at?: string;
};

export function TeamClient() {
  const [users, setUsers] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ops",
  });

  function load() {
    fetch("/api/users")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setError(d.error || "Failed to load team");
          return;
        }
        setUsers(d.users || []);
      })
      .catch(() => setError("Failed to load team"));
  }

  useEffect(() => {
    load();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Invite failed");
      return;
    }
    setForm({ name: "", email: "", password: "", role: "ops" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
        <p className="text-sm text-slate-500">
          Invite ops or accountant into this seller org. Owner only.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="font-medium text-slate-800">Roster</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-slate-400">
                  No members yet.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.membership_id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-600">
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={invite} className="card max-w-lg space-y-3">
        <h2 className="font-medium text-slate-800">Invite teammate</h2>
        <p className="text-xs text-slate-500">
          Roles: ops (upload/match) or accountant (read + export). Password min
          10.
        </p>
        <div>
          <label className="label" htmlFor="invite-name">
            Name
          </label>
          <input
            id="invite-name"
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="invite-email">
            Email
          </label>
          <input
            id="invite-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="invite-password">
            Temp password
          </label>
          <input
            id="invite-password"
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={10}
          />
        </div>
        <div>
          <label className="label" htmlFor="invite-role">
            Role
          </label>
          <select
            id="invite-role"
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="ops">ops</option>
            <option value="accountant">accountant</option>
          </select>
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Inviting…" : "Invite"}
        </button>
      </form>
    </div>
  );
}
