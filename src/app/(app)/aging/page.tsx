import { getSessionUser } from "@/lib/auth";
import { getAgingBoard } from "@/lib/match";
import { formatPkr } from "@/lib/money";
import Link from "next/link";

const BUCKETS = [
  { key: "<7", title: "Under 7 days", description: "Recently due", color: "border-emerald-200 bg-emerald-50 text-emerald-800", bar: "bg-emerald-500" },
  { key: "7-14", title: "7–14 days", description: "Follow up soon", color: "border-amber-200 bg-amber-50 text-amber-800", bar: "bg-amber-500" },
  { key: ">14", title: "Over 14 days", description: "Needs attention", color: "border-rose-200 bg-rose-50 text-rose-800", bar: "bg-rose-500" },
] as const;

export default async function AgingPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const buckets = getAgingBoard(user.org_id);
  const byBucket: Record<string, typeof buckets> = { "<7": [], "7-14": [], ">14": [] };
  for (const item of buckets) (byBucket[item.bucket] ||= []).push(item);

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Receivables · Follow-up</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">Aging board</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Prioritize unpaid and short COD receivables by age. Select a courier to open its filtered match list.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {BUCKETS.map((bucket) => {
          const items = byBucket[bucket.key] || [];
          const total = items.reduce((sum, item) => sum + item.amount_paisa, 0);
          const lines = items.reduce((sum, item) => sum + item.count, 0);
          return (
            <section key={bucket.key} className="card !p-0">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900">{bucket.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">{bucket.description}</p>
                  </div>
                  <span className={`grid h-9 w-9 place-items-center rounded-xl border text-xs font-bold ${bucket.color}`}>{items.length}</span>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Receivable</p>
                    <p className="mt-1 text-xl font-bold tracking-tight text-slate-900 tabular-nums">{formatPkr(total)}</p>
                  </div>
                  <p className="pb-1 text-xs text-slate-500">{lines} {lines === 1 ? "line" : "lines"}</p>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full w-full rounded-full ${bucket.bar}`} />
                </div>
              </div>
              <div className="space-y-2 p-3">
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-500">Nothing in this bucket</p>
                ) : (
                  items.map((item) => (
                    <Link
                      key={`${item.courier_code}-${item.bucket}`}
                      href={`/matches?aging=${encodeURIComponent(bucket.key)}&courier=${encodeURIComponent(item.courier_code)}`}
                      className="group block rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 transition hover:border-emerald-200 hover:bg-emerald-50/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold uppercase text-slate-800 group-hover:text-emerald-800">{item.courier_code}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{formatPkr(item.amount_paisa)}</span>
                      </div>
                      <p className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                        <span>{item.count} {item.count === 1 ? "line" : "lines"}</span>
                        <span className="font-medium text-emerald-700">Open matches →</span>
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
