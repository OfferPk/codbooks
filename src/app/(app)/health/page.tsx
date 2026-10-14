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
      label: "Unpaid + short",
      detail: "Total receivable to chase",
      value: formatPkr(health.owed_paisa),
      href: "/matches?status=unpaid",
      tone: "text-rose-700",
      marker: "bg-rose-500",
    },
    {
      label: "Short remittances",
      detail: "Settlements below expected",
      value: formatPkr(health.short_paisa),
      href: "/matches?status=short",
      tone: "text-amber-700",
      marker: "bg-amber-500",
    },
    {
      label: "Over 14 days",
      detail: "Aged receivables",
      value: formatPkr(health.aging_over_14_paisa),
      href: "/aging",
      tone: "text-orange-700",
      marker: "bg-orange-500",
    },
    {
      label: "Unmatched lines",
      detail: "Need order reference review",
      value: String(health.unmatched_count),
      href: "/matches?status=unmatched",
      tone: "text-violet-700",
      marker: "bg-violet-500",
    },
  ];

  const statuses = [
    { label: "Matched", value: health.matched_count, tone: "text-emerald-800", dot: "bg-emerald-500", status: "matched" },
    { label: "Short", value: health.short_count, tone: "text-amber-800", dot: "bg-amber-500", status: "short" },
    { label: "Unpaid", value: health.unpaid_count, tone: "text-rose-800", dot: "bg-rose-500", status: "unpaid" },
    { label: "Unmatched", value: health.unmatched_count, tone: "text-violet-800", dot: "bg-violet-500", status: "unmatched" },
    { label: "Double-paid", value: health.double_paid_count, tone: "text-orange-800", dot: "bg-orange-500", status: "double_paid" },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
            Overview · COD receivables
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">
            Settlement health
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            See what each courier owes, where amounts fall short, and which settlements need attention.
          </p>
        </div>
        <Link href="/uploads" className="btn-primary">
          Upload settlement files <span aria-hidden="true">→</span>
        </Link>
      </div>

      <HealthChecklist
        show={showChecklist}
        userId={user.id}
        isOwner={user.role === "owner"}
      />

      <section aria-label="Receivables summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(22,42,32,0.045)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_32px_rgba(22,42,32,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-700">{card.label}</span>
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${card.marker}`} />
            </div>
            <p className={`mt-5 break-words text-[1.65rem] font-bold leading-none tracking-tight tabular-nums ${card.tone}`}>
              {card.value}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>{card.detail}</span>
              <span className="font-semibold text-emerald-700 transition group-hover:translate-x-0.5">Review →</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="card !p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Latest match run</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Status snapshot</h2>
          </div>
          <Link href="/matches" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
            View matches <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-b-2xl bg-slate-100 sm:grid-cols-2 lg:grid-cols-5">
          {statuses.map((item) => (
            <Link
              key={item.status}
              href={`/matches?status=${item.status}`}
              className="group bg-white px-5 py-4 transition hover:bg-emerald-50/50"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${item.dot}`} />
                {item.label}
              </span>
              <span className={`mt-2 block text-2xl font-bold tabular-nums ${item.tone}`}>{item.value}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card !p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Courier breakdown</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Receivables by courier</h2>
          </div>
          <span className="text-xs text-slate-500">Amounts shown in PKR</span>
        </div>
        <div className="overflow-x-auto px-2 pb-2 sm:px-4">
          {Object.keys(health.by_courier).length === 0 ? (
            <div className="m-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
              <p className="font-semibold text-slate-700">No reconciliation yet</p>
              <p className="mt-1 text-sm text-slate-500">Upload order and settlement CSVs to see your courier breakdown.</p>
              <Link href="/uploads" className="mt-4 inline-flex text-sm font-semibold text-emerald-700 hover:underline">Go to uploads →</Link>
            </div>
          ) : (
            <table className="data-table min-w-[620px]">
              <thead>
                <tr>
                  <th className="!bg-white">Courier</th>
                  <th className="!bg-white">Owed</th>
                  <th className="!bg-white">Short</th>
                  <th className="!bg-white">Unpaid lines</th>
                  <th className="!bg-white">Unmatched lines</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(health.by_courier).map(([code, values]) => (
                  <tr key={code}>
                    <td className="font-semibold uppercase text-slate-900">
                      <Link href={`/matches?courier=${encodeURIComponent(code)}`} className="text-emerald-800 hover:underline">{code}</Link>
                    </td>
                    <td className="numeric font-semibold">{formatPkr(values.owed_paisa)}</td>
                    <td className="numeric">{formatPkr(values.short_paisa)}</td>
                    <td>
                      <Link href={`/matches?status=unpaid&courier=${encodeURIComponent(code)}`} className="font-semibold text-slate-700 hover:text-emerald-800">{values.unpaid_count}</Link>
                    </td>
                    <td>
                      <Link href={`/matches?status=unmatched&courier=${encodeURIComponent(code)}`} className="font-semibold text-slate-700 hover:text-emerald-800">{values.unmatched_count}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
