import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getHealthSummary } from "@/lib/match";
import { formatPkr } from "@/lib/money";
import { HealthChecklist } from "@/components/HealthChecklist";
import Link from "next/link";

export default async function HealthPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const health = getHealthSummary(user.org_id);
  const db = getDb();
  const uploadRow = db
    .prepare(`SELECT COUNT(*) as c FROM uploads WHERE org_id = ?`)
    .get(user.org_id) as { c: number };
  const runRow = db
    .prepare(`SELECT COUNT(*) as c FROM match_runs WHERE org_id = ?`)
    .get(user.org_id) as { c: number };
  const showChecklist = uploadRow.c === 0 || runRow.c === 0;

  const cards = [
    {
      label: "PKR owed (unpaid + short)",
      value: formatPkr(health.owed_paisa),
      tone: "text-red-700",
      href: "/matches?status=unpaid",
    },
    {
      label: "PKR short",
      value: formatPkr(health.short_paisa),
      tone: "text-amber-700",
      href: "/matches?status=short",
    },
    {
      label: "PKR >14 days aging",
      value: formatPkr(health.aging_over_14_paisa),
      tone: "text-orange-700",
      href: "/aging",
    },
    {
      label: "Unmatched settlements",
      value: String(health.unmatched_count),
      tone: "text-purple-700",
      href: "/matches?status=unmatched",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Settlement Health
          </h1>
          <p className="text-sm text-slate-500">
            What each courier owes, deducted, and delayed — to the rupee.
          </p>
        </div>
        <Link href="/uploads" className="btn-primary">
          Upload CSVs
        </Link>
      </div>

      <HealthChecklist
        show={showChecklist}
        userId={user.id}
        isOwner={user.role === "owner"}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card block hover:border-sky-200">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {c.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${c.tone}`}>{c.value}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <h2 className="font-medium text-slate-800">Status counts</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/matches?status=matched" className="hover:text-sky-700">
            Matched: <strong>{health.matched_count}</strong>
          </Link>
          <Link href="/matches?status=short" className="hover:text-sky-700">
            Short: <strong>{health.short_count}</strong>
          </Link>
          <Link href="/matches?status=unpaid" className="hover:text-sky-700">
            Unpaid: <strong>{health.unpaid_count}</strong>
          </Link>
          <Link href="/matches?status=unmatched" className="hover:text-sky-700">
            Unmatched: <strong>{health.unmatched_count}</strong>
          </Link>
          <Link href="/matches?status=double_paid" className="hover:text-sky-700">
            Double-paid: <strong>{health.double_paid_count}</strong>
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="font-medium text-slate-800">By courier</h2>
        {Object.keys(health.by_courier).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No match run yet. Upload orders + CPR files, then run match.
          </p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Courier</th>
                <th>Owed</th>
                <th>Short</th>
                <th>Unpaid #</th>
                <th>Unmatched #</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(health.by_courier).map(([code, v]) => (
                <tr key={code} className="border-t border-slate-100">
                  <td className="py-2 font-medium uppercase">
                    <Link
                      href={`/matches?courier=${encodeURIComponent(code)}`}
                      className="hover:text-sky-700"
                    >
                      {code}
                    </Link>
                  </td>
                  <td>{formatPkr(v.owed_paisa)}</td>
                  <td>{formatPkr(v.short_paisa)}</td>
                  <td>
                    <Link
                      href={`/matches?status=unpaid&courier=${encodeURIComponent(code)}`}
                      className="hover:text-sky-700"
                    >
                      {v.unpaid_count}
                    </Link>
                  </td>
                  <td>
                    <Link
                      href={`/matches?status=unmatched&courier=${encodeURIComponent(code)}`}
                      className="hover:text-sky-700"
                    >
                      {v.unmatched_count}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
