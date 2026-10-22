"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicNav } from "@/components/PublicNav";
import { DICTIONARY, type Locale } from "@/lib/i18n";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annually">(
    "monthly"
  );
  const [locale, setLocale] = useState<Locale>("en");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    const savedLang = (localStorage.getItem("codbooks_lang") as Locale) || "en";
    setLocale(savedLang);
  }, []);

  const dict = DICTIONARY[locale] || DICTIONARY.en;

  const faqs = [
    {
      q: "How does CodBooks find money Pakistani couriers owe me?",
      a: "CodBooks imports your booked Shopify/WooCommerce orders and matches them against courier Customer Payment Receipts (CPRs). It detects short payments (when the courier pays less than booked), duplicate delivery fees, invalid return fees deducted on delivered parcels, and remittances held beyond standard payment SLA.",
    },
    {
      q: "Which Pakistani couriers can I reconcile?",
      a: "CodBooks natively parses settlements and CPRs from all major Pakistani logistics providers: TCS, PostEx, Leopards, M&P, Trax, Rider, Swyft Logistics, and Call Courier, with automatic format detection.",
    },
    {
      q: "Can I try before paying?",
      a: "Yes! The Solo Starter plan is free forever for up to 300 orders/month. You can also explore our interactive Live Demo without creating an account or uploading files.",
    },
    {
      q: "What payment methods are supported in Pakistan?",
      a: "We accept JazzCash, EasyPaisa, Raast instant transfers, direct bank account IBFT (1Link), Nayapay, Sadapay, and local debit/credit cards.",
    },
    {
      q: "Can I manage multiple branch stores or Shopify shops?",
      a: "Yes! The Scale plan includes multi-shop support with strict data isolation, role-based staff permissions, and consolidated dashboard health reports.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      <PublicNav />

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            🇵🇰 Built for Pakistani E-Commerce Sellers
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Stop losing hard-earned cash to courier billing mistakes
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Automate Cash-on-Delivery reconciliation, audit CPR settlements, and recover short remittances in minutes.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="pt-4 flex items-center justify-center">
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-lg px-4 py-1.5 text-xs sm:text-sm font-semibold transition ${
                  billingCycle === "monthly"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {dict.monthly || "Monthly"}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annually")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs sm:text-sm font-semibold transition ${
                  billingCycle === "annually"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {dict.annually || "Annually"}
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Tier 1: Starter */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {dict.starterPlan || "Solo Starter"}
                </h2>
                <span className="badge bg-slate-100 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  Free
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Ideal for new direct-to-consumer stores testing multi-courier shipping.
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight">PKR 0</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  / forever
                </span>
              </div>

              <ul className="mt-6 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  Up to 300 orders / month
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  2 couriers (e.g. TCS &amp; PostEx)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  Automated CPR reconciliation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  Basic Short-payment detection
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  Standard CSV export
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/register"
                className="w-full btn btn-secondary text-xs py-2 text-center"
              >
                Start Free
              </Link>
            </div>
          </div>

          {/* Tier 2: Growth Merchant (Highlighted) */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-sky-600 bg-white p-6 shadow-md transition dark:border-sky-500 dark:bg-slate-900">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs">
              Most Popular
            </span>
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-sky-950 dark:text-sky-300">
                  {dict.growthPlan || "Growth Merchant"}
                </h2>
                <span className="badge bg-sky-100 text-[11px] text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  Full Suite
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                For active Pakistani e-commerce brands wanting complete COD financial recovery.
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-sky-950 dark:text-white">
                  PKR {billingCycle === "monthly" ? "2,500" : "2,000"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  / month
                </span>
              </div>
              {billingCycle === "annually" && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Billed PKR 24,000 annually (2 months free)
                </p>
              )}

              <ul className="mt-6 space-y-2.5 text-xs text-slate-700 dark:text-slate-200">
                <li className="flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400">✓</span>
                  Up to 2,500 orders / month
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400">✓</span>
                  All 8 Pakistani couriers supported
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400">✓</span>
                  Shopify &amp; WooCommerce deduplication
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400">✓</span>
                  Full 5 Dispute Detection Rules
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400">✓</span>
                  1-Click WhatsApp &amp; Mail dispute drafts
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-bold text-sky-600 dark:text-sky-400">✓</span>
                  Official Courier dispute desk directory
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/register"
                className="w-full btn btn-primary text-xs py-2 text-center"
              >
                Claim 14-Day Free Trial
              </Link>
            </div>
          </div>

          {/* Tier 3: Scale / Multi-Shop */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {dict.scalePlan || "Scale / Multi-Shop"}
                </h2>
                <span className="badge bg-purple-100 text-[11px] text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Enterprise
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                For high-volume merchants, multi-branch operations, and agencies.
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight">
                  PKR {billingCycle === "monthly" ? "6,000" : "4,800"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  / month
                </span>
              </div>
              {billingCycle === "annually" && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Billed PKR 57,600 annually
                </p>
              )}

              <ul className="mt-6 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">✓</span>
                  Unlimited orders &amp; transactions
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">✓</span>
                  Multi-shop branch data isolation
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">✓</span>
                  Granular roles (Owner, Admin, Staff)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">✓</span>
                  Immutable audit event logging
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">✓</span>
                  Automated encrypted database backups
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-purple-600 dark:text-purple-400">✓</span>
                  Dedicated account rep &amp; WhatsApp SLA
                </li>
              </ul>
            </div>

            <div className="mt-8">
              <Link
                href="/register"
                className="w-full btn btn-secondary text-xs py-2 text-center"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>

        {/* Accepted Payment Methods Badge in Pakistan */}
        <div className="mt-12 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Pakistani Payment Options Accepted
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Zero international card friction. Settle invoices via your preferred Pakistani channel.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              <span className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                JazzCash
              </span>
              <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                Easypaisa
              </span>
              <span className="rounded-md bg-sky-50 border border-sky-200 px-2.5 py-1 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                Raast / 1Link IBFT
              </span>
              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200">
                Nayapay / Sadapay
              </span>
              <span className="rounded-md bg-slate-100 border border-slate-300 px-2.5 py-1 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                Visa &amp; Mastercard
              </span>
            </div>
          </div>
        </div>

        {/* Supported Couriers */}
        <div className="mt-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Reconciles All Major Pakistani Logistics Networks
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">TCS Express</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">PostEx</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">Leopards Courier</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">M&amp;P Logistics</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">Trax Logistics</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">Rider Pakistan</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">Swyft Logistics</span>
            <span className="rounded-lg bg-slate-100 px-3 py-1 dark:bg-slate-800">Call Courier</span>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-14 max-w-3xl mx-auto space-y-4">
          <h2 className="text-xl font-bold text-center text-slate-900 dark:text-slate-100">
            {dict.faq || "Frequently Asked Questions"}
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-4 transition dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  type="button"
                  onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-900 dark:text-slate-100"
                >
                  <span>{faq.q}</span>
                  <span className="text-slate-400 text-base font-bold ml-2">
                    {expandedFaq === idx ? "−" : "+"}
                  </span>
                </button>
                {expandedFaq === idx && (
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed dark:text-slate-400">
                    {faq.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 rounded-2xl bg-sky-900 p-8 text-center text-white dark:bg-sky-950">
          <h3 className="text-xl font-bold sm:text-2xl">
            Audit your courier settlements today
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-sky-100 max-w-xl mx-auto">
            Try CodBooks free with your next CPR. Recover short payments before courier claim windows expire.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="rounded-lg bg-white px-5 py-2.5 text-xs sm:text-sm font-bold text-sky-900 shadow-sm transition hover:bg-slate-100"
            >
              Get Started Free →
            </Link>
            <Link
              href="/demo"
              className="rounded-lg border border-sky-400 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition hover:bg-sky-800"
            >
              Explore Live Demo
            </Link>
          </div>
        </div>
      </main>

      <footer className="mt-16 border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p>© 2026 CodBooks. Built specifically for Pakistani e-commerce merchants.</p>
      </footer>
    </div>
  );
}
