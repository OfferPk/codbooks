"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DICTIONARY, type Locale } from "@/lib/i18n";

export function PublicNav() {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("codbooks_theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

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

  const dict = DICTIONARY[locale] || DICTIONARY.en;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/90 print:hidden">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[64px] items-center justify-between gap-3 py-2">
          {/* Logo & Brand */}
          <Link href="/login" className="group inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-800 text-xs font-extrabold tracking-tight text-white shadow-sm transition group-hover:scale-105 dark:bg-sky-600">
              CB
            </span>
            <div>
              <span className="block text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
                {dict.appName || "CodBooks"}
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:block">
                COD Reconciliation PK
              </span>
            </div>
          </Link>

          {/* Links */}
          <nav aria-label="Public navigation" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/demo"
              className={`rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition ${
                pathname === "/demo"
                  ? "bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              }`}
            >
              {dict.demo || "Live Demo"}
            </Link>
            <Link
              href="/pricing"
              className={`rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition ${
                pathname === "/pricing"
                  ? "bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              }`}
            >
              {dict.pricing || "Pricing"}
            </Link>
            <Link
              href="/login"
              className={`rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition ${
                pathname === "/login"
                  ? "bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              }`}
            >
              Log in
            </Link>
          </nav>

          {/* Right Controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={dict.toggleLanguage || "Toggle language"}
              title={dict.toggleLanguage || "Toggle language"}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {locale === "en" ? "اردو" : "English"}
            </button>

            <Link
              href="/register"
              className="btn btn-primary text-xs py-1 px-3 hidden sm:inline-flex"
            >
              {dict.choosePlan || "Get Started"}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
