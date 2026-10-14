"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const BASE_LINKS = [
  { href: "/health", label: "Overview" },
  { href: "/aging", label: "Aging" },
  { href: "/uploads", label: "Uploads" },
  { href: "/matches", label: "Matches" },
  { href: "/exports", label: "Exports" },
  { href: "/audit", label: "Audit" },
];

type NavProps = {
  userName: string;
  orgName: string;
  role: string;
};

export function Nav({ userName, orgName, role }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const links =
    role === "owner" ? [...BASE_LINKS, { href: "/team", label: "Team" }] : BASE_LINKS;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function renderLinks() {
    return links.map((link) => {
      const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? "page" : undefined}
          className={`app-nav-link inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
            active
              ? "bg-emerald-50 text-emerald-800 shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {active && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
          {link.label}
        </Link>
      );
    });
  }

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="app-header sticky top-0 z-40">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[70px] items-center justify-between gap-4">
          <Link href="/health" className="group inline-flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-emerald-800 text-xs font-extrabold tracking-tight text-white shadow-lg shadow-emerald-900/15 transition group-hover:-translate-y-0.5">
              CB
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold leading-tight tracking-tight text-slate-900">
                CodBooks
              </span>
              <span className="hidden text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">
                Settlement workspace
              </span>
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {renderLinks()}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-semibold text-slate-800">{orgName}</p>
              <p className="max-w-[180px] truncate text-[11px] text-slate-500">{userName}</p>
            </div>
            <span
              aria-label={`Role: ${role}`}
              className="hidden h-9 w-9 place-items-center rounded-full border border-emerald-100 bg-emerald-50 text-xs font-bold text-emerald-800 sm:grid"
            >
              {initials || "U"}
            </span>
            <button type="button" className="btn-secondary !px-3 !py-2 text-xs sm:text-sm" onClick={logout}>
              Log out
            </button>
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="app-nav-scroll -mx-1 flex gap-1 overflow-x-auto border-t border-slate-100 py-2 lg:hidden"
        >
          {renderLinks()}
        </nav>
      </div>
    </header>
  );
}
