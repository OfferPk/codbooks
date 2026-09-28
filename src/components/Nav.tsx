"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const BASE_LINKS = [
  { href: "/health", label: "Settlement Health" },
  { href: "/aging", label: "Aging" },
  { href: "/uploads", label: "Uploads" },
  { href: "/matches", label: "Matches" },
  { href: "/exports", label: "Exports" },
  { href: "/audit", label: "Audit" },
];

export function Nav({
  userName,
  orgName,
  role,
}: {
  userName: string;
  orgName: string;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links =
    role === "owner"
      ? [...BASE_LINKS, { href: "/team", label: "Team" }]
      : BASE_LINKS;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/health" className="text-lg font-semibold text-sky-800">
            CodBooks
          </Link>
          <nav className="flex flex-wrap gap-1">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm ${
                    active
                      ? "bg-sky-50 font-medium text-sky-800"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>
            {userName} · {orgName}{" "}
            <span className="badge bg-slate-100 text-slate-600">{role}</span>
          </span>
          <button type="button" className="btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
