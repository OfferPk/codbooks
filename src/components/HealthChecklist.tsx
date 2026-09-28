"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STEPS = [
  {
    n: 1,
    en: "Upload orders CSV",
    ur: "Orders CSV upload karo",
    href: "/uploads",
    cta: "Open Uploads",
  },
  {
    n: 2,
    en: "Upload TCS / PostEx CPR",
    ur: "TCS ya PostEx CPR upload karo",
    href: "/uploads",
    cta: "Upload CPR",
  },
  {
    n: 3,
    en: "Open Exports / invite accountant",
    ur: "Exports kholo ya accountant invite karo",
    href: "/exports",
    cta: "Exports",
    secondaryHref: "/team",
    secondaryCta: "Team",
    ownerOnlySecondary: true,
  },
] as const;

function storageKey(userId: string) {
  return `codbooks_health_checklist_dismissed_${userId}`;
}

export function HealthChecklist({
  show,
  userId,
  isOwner,
}: {
  show: boolean;
  userId: string;
  isOwner: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey(userId));
      setDismissed(v === "1");
    } catch {
      setDismissed(false);
    }
    setReady(true);
  }, [userId]);

  if (!show || !ready || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="card space-y-3 border-sky-200 bg-gradient-to-br from-sky-50/80 to-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-sky-900">
            Get started in 3 steps
          </h2>
          <p className="text-xs text-sky-800/80">
            Pehli reconcile — upload, CPR, export / invite
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-700"
          onClick={dismiss}
        >
          Dismiss / Chhupa do
        </button>
      </div>
      <ol className="space-y-2">
        {STEPS.map((s) => (
          <li
            key={`${s.n}-${s.href}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
                {s.n}
              </span>
              <span className="font-medium text-slate-800">{s.en}</span>
              <div className="ml-7 text-xs text-slate-500">{s.ur}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={s.href} className="btn-secondary !px-2 !py-1 text-xs">
                {s.cta}
              </Link>
              {"secondaryHref" in s &&
                s.secondaryHref &&
                (!("ownerOnlySecondary" in s) ||
                  !s.ownerOnlySecondary ||
                  isOwner) && (
                  <Link
                    href={s.secondaryHref}
                    className="btn-secondary !px-2 !py-1 text-xs"
                  >
                    {s.secondaryCta}
                  </Link>
                )}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-600">
        Tip: try example files in{" "}
        <code className="rounded bg-slate-100 px-1">fixtures/</code> — e.g.{" "}
        <code className="rounded bg-slate-100 px-1">
          orders-tcs.example.csv
        </code>
        ,{" "}
        <code className="rounded bg-slate-100 px-1">
          tcs-payment-invoice.example.csv
        </code>
        ,{" "}
        <code className="rounded bg-slate-100 px-1">
          postex-settlement-portal.example.csv
        </code>
        . Column maps:{" "}
        <code className="rounded bg-slate-100 px-1">COURIER_TEMPLATES.md</code>.
      </p>
    </div>
  );
}
