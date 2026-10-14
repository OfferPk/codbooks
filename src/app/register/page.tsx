"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, org_name: orgName }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Register failed");
      return;
    }
    router.push("/health");
    router.refresh();
  }

  return (
    <main className="min-h-dvh px-4 py-5 sm:px-6 sm:py-8">
      <div className="auth-frame mx-auto grid min-h-[min(760px,calc(100dvh-2.5rem))] max-w-6xl overflow-hidden rounded-[30px] border border-white/80 bg-white lg:grid-cols-[1.04fr_.96fr]">
        <aside className="auth-panel relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/10 text-sm font-extrabold">CB</span>
            <div>
              <p className="font-bold tracking-tight">CodBooks</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-100/70">Settlement workspace</p>
            </div>
          </div>
          <div className="relative max-w-lg">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/80">A better start for your books</p>
            <h2 className="text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">Every courier settlement, in one clear view.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-emerald-50/80">Set up a seller workspace to reconcile COD orders, spot short payments, and prepare accountant-ready exports.</p>
            <div className="mt-9 space-y-3">
              {[
                "Upload order and settlement files",
                "Find short, unpaid, and unmatched lines",
                "Export a clean receivable ledger",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3 backdrop-blur-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/15 text-[10px] font-bold">{index + 1}</span>
                  <span className="text-sm font-medium text-emerald-50">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-emerald-100/65">A clearer paper trail for every settlement.</p>
        </aside>

        <section className="flex items-center justify-center px-6 py-9 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-emerald-800 text-xs font-extrabold text-white">CB</span>
              <div>
                <p className="font-bold tracking-tight text-slate-900">CodBooks</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Settlement workspace</p>
              </div>
            </div>
            <div className="mb-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">New workspace</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Create your account</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Set up a seller workspace to start reconciling settlements.</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label" htmlFor="name">Your name</label>
                <input id="name" className="input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="org">Store or organization name <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="org" className="input" autoComplete="organization" value={orgName} onChange={(event) => setOrgName(event.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input id="password" className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} aria-describedby="password-hint" />
                <p id="password-hint" className="mt-1.5 text-xs text-slate-500">Use at least 10 characters.</p>
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
              <button type="submit" className="btn-primary w-full !py-3" disabled={busy} aria-busy={busy}>
                {busy ? "Creating workspace…" : "Create seller account"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline">Sign in</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
