import { getSessionUser } from "@/lib/auth";
import { getAgingBoard } from "@/lib/match";
import { formatPkr } from "@/lib/money";
import Link from "next/link";

export default async function AgingPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const buckets = getAgingBoard(user.org_id);
  const order = ["<7", "7-14", ">14"];
  const byBucket: Record<string, typeof buckets> = {
    "<7": [],
    "7-14": [],
    ">14": [],
  };
  for (const b of buckets) {
    (byBucket[b.bucket] ||= []).push(b);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aging board</h1>
        <p className="text-sm text-slate-500">
          Unpaid and short COD receivable by age bucket and courier — click a
          courier to open filtered Matches.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {order.map((key) => (
          <div key={key} className="card">
            <h2 className="font-semibold text-slate-800">
              {key === "<7"
                ? "Under 7 days"
                : key === "7-14"
                  ? "7–14 days"
                  : "Over 14 days"}
            </h2>
            {(byBucket[key] || []).length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No items</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {(byBucket[key] || []).map((b) => (
                  <li key={`${b.courier_code}-${b.bucket}`}>
                    <Link
                      href={`/matches?aging=${encodeURIComponent(key)}&courier=${encodeURIComponent(b.courier_code)}`}
                      className="block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm hover:border-sky-200 hover:bg-sky-50"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium uppercase">
                          {b.courier_code}
                        </span>
                        <span>{formatPkr(b.amount_paisa)}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {b.count} line(s) · open Matches
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
