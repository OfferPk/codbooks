"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
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
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/80">COD reconciliation, made clear</p>
            <h2 className="text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">Know what is owed. Follow up with confidence.</h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-emerald-50/80">Bring orders and courier settlements into one place, then turn every mismatch into a clear next step.</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[["01", "Upload"], ["02", "Reconcile"], ["03", "Export"]].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 backdrop-blur-sm">
                  <span className="text-[10px] font-bold tracking-[0.15em] text-emerald-100/70">{number}</span>
                  <p className="mt-2 text-sm font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-emerald-100/65">A clearer paper trail for every settlement.</p>
        </aside>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-emerald-800 text-xs font-extrabold text-white">CB</span>
              <div>
                <p className="font-bold tracking-tight text-slate-900">CodBooks</p>
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Settlement workspace</p>
              </div>
            </div>
            <div className="mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Welcome back</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sign in</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Access your seller workspace and settlement records.</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="label !mb-0" htmlFor="password">Password</label>
                </div>
                <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
              <button type="submit" className="btn-primary w-full !py-3" disabled={busy} aria-busy={busy}>
                {busy ? "Signing in…" : "Sign in to CodBooks"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              {process.env.NODE_ENV !== "production" ? <span className="mb-2 block text-xs">Local demo accounts: see README after <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run seed</code></span> : null}
              New to CodBooks? <Link href="/register" className="font-semibold text-emerald-700 hover:text-emerald-900 hover:underline">Create a seller account</Link>
            </p>
            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-400">
              <Link href="/demo" className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline">Live Demo</Link>
              <span>·</span>
              <Link href="/pricing" className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline">Pricing Plans</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
