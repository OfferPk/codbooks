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

  return (
    <header className="border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-3">
        {/* Top Bar: Brand, User Info, Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/health"
              className="text-lg font-bold tracking-tight text-sky-800 transition hover:text-sky-700 dark:text-sky-400"
            >
              {dict.appName || "CodBooks"}
            </Link>
            <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-600">|</span>
            <span className="hidden sm:inline text-xs font-medium text-slate-500 dark:text-slate-400">
              {orgName}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* Urdu / English Language Toggle */}
            <button
              type="button"
              id="langToggleBtn"
              onClick={toggleLanguage}
              aria-label="Toggle language"
              className="rounded-lg border border-slate-200 px-2 py-1 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {locale === "en" ? "اردو" : "English"}
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              id="themeToggleBtn"
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {mounted && darkMode ? "☀️" : "🌙"}
            </button>

            {/* User Profile & Role */}
            <div className="hidden md:flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="font-medium">{userName}</span>
              <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {role}
              </span>
            </div>

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

        {/* Navigation Bar (Mobile horizontal swipe, desktop inline) */}
        <div className="mt-3 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <nav className="flex items-center gap-1 min-w-max pb-0.5">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              const label = dict[l.labelKey] || l.defaultLabel;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-2.5 py-1 text-xs sm:text-sm font-medium transition ${
                    active
                      ? "bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
