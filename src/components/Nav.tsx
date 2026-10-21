"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DICTIONARY, type Locale, type TranslationDictionary } from "@/lib/i18n";

interface NavLinkItem {
  href: string;
  labelKey: keyof TranslationDictionary;
  defaultLabel: string;
}

const BASE_LINKS: NavLinkItem[] = [
  { href: "/health", labelKey: "settlementHealth", defaultLabel: "Settlement Health" },
  { href: "/aging", labelKey: "aging", defaultLabel: "Aging" },
  { href: "/loss-report", labelKey: "lossReport", defaultLabel: "Loss Report" },
  { href: "/uploads", labelKey: "uploads", defaultLabel: "Uploads" },
  { href: "/matches", labelKey: "matches", defaultLabel: "Matches" },
  { href: "/exports", labelKey: "exports", defaultLabel: "Exports" },
  { href: "/audit", labelKey: "audit", defaultLabel: "Audit" },
];

export type NavProps = {
  userName: string;
  orgName: string;
  role: string;
};

export function Nav({ userName, orgName, role }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    // Initialize Theme
    const savedTheme = localStorage.getItem("codbooks_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Initialize Locale
    const savedLang = (localStorage.getItem("codbooks_lang") as Locale) || "en";
    setLocale(savedLang);
    document.documentElement.lang = savedLang;
    document.documentElement.dir = savedLang === "ur" ? "rtl" : "ltr";
  }, []);

  function toggleTheme() {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("codbooks_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("codbooks_theme", "light");
    }
  }

  function toggleLanguage() {
    const nextLocale: Locale = locale === "en" ? "ur" : "en";
    setLocale(nextLocale);
    localStorage.setItem("codbooks_lang", nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "ur" ? "rtl" : "ltr";
  }

  const links: NavLinkItem[] =
    role === "owner"
      ? [...BASE_LINKS, { href: "/team", labelKey: "team", defaultLabel: "Team" }]
      : BASE_LINKS;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const dict = DICTIONARY[locale] || DICTIONARY.en;

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  function renderLinks() {
    return links.map((link) => {
      const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
      const label = dict[link.labelKey] || link.defaultLabel;
      return (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active ? "page" : undefined}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition ${
            active
              ? "bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
          }`}
        >
          {active && (
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-sky-600 dark:bg-sky-400"
            />
          )}
          {label}
        </Link>
      );
    });
  }

  return (
    <header className="app-header sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/90 print:hidden">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[64px] items-center justify-between gap-4 py-2">
          {/* Brand Logo & Name */}
          <Link href="/health" className="group inline-flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-800 text-xs font-extrabold tracking-tight text-white shadow-sm transition group-hover:scale-105 dark:bg-sky-600">
              CB
            </span>
            <div className="min-w-0">
              <span className="block text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                {dict.appName || "CodBooks"}
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:block">
                {orgName}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
            {renderLinks()}
          </nav>

          {/* Right Toolbar: Theme Toggle, Urdu Toggle, User Info, Logout */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={dict.toggleTheme || "Toggle theme"}
              title={dict.toggleTheme || "Toggle theme"}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {mounted ? (darkMode ? "☀️" : "🌙") : "🌙"}
            </button>

            {/* Language Toggle (Urdu / English) */}
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={dict.toggleLanguage || "Toggle language"}
              title={dict.toggleLanguage || "Toggle language"}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {locale === "en" ? "اردو" : "English"}
            </button>

            {/* User Avatar & Info */}
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-[140px] truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                {userName}
              </p>
              <span className="badge bg-slate-100 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {role}
              </span>
            </div>

            <span
              aria-label={`Role: ${role}`}
              className="hidden h-8 w-8 place-items-center rounded-full border border-sky-200 bg-sky-50 text-xs font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300 sm:grid"
            >
              {initials || "U"}
            </span>

            {/* Logout Button */}
            <button
              type="button"
              className="btn btn-secondary text-xs py-1 px-2.5"
              onClick={logout}
            >
              {dict.logOut || "Log out"}
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Navigation Bar */}
        <nav
          aria-label="Mobile navigation"
          className="app-nav-scroll -mx-2 flex gap-1 overflow-x-auto border-t border-slate-100 py-1.5 dark:border-slate-800 lg:hidden"
        >
          {renderLinks()}
        </nav>
      </div>
    </header>
  );
}
