# CodBooks — Status

**Version:** 0.1.0 (Active development on `master`)  
**Updated:** 2026-10-21T20:10:00-05:00  
**Status:** READY / ACTIVE

## Current Status & Verification
- **Continuous Integration**: `.github/workflows/ci.yml` validates `npm ci`, `npm run lint`, `npm test`, and `npm run build` on PRs and pushes to `master`.
- **Test Suite**: **118/118 passing** (18 test files) across golden-path, parsers, courier-importers, matching, aging, dashboard-trends, loss-report, auth-hygiene, multi-shop isolation, and security gates.
- **Framework**: Next.js 15.5.28 + React 18 + Tailwind CSS + SQLite (`better-sqlite3` ^13.0.3 with Node 24 prebuilds).
- **Features Active**:
  - Multi-courier settlement importers (TCS, PostEx, Leopards, M&P, Trax, Call Courier, Rider, Swyft) + Shopify & WooCommerce orders with auto-detection.
  - Loss Report with 5 dispute classification rules, printable PDF dispute summary, official courier dispute desk directory, export audit logging, and 1-click WhatsApp dispatch.
  - Multi-shop data isolation with scoped uploads, orders, and sessions.
  - Settlement health dashboard with weekly & monthly COD recovery trends per courier.
  - Public Pricing tiers (Starter, Growth Merchant, Scale) with monthly/annual billing and Pakistani payment methods (JazzCash, Easypaisa, Raast, IBFT).
  - Interactive Live Demo with realistic Pakistani seller dataset and dispute generator preview.
  - Production multi-stage Docker container & automated online SQLite backup rotation.

| Gate | Result | Notes |
|------|--------|-------|
| `npm test` | **118/118 PASS** (18 files) | Golden path, parsers, importers, loss report, trends, isolation, authz |
| `npx tsc --noEmit` | **PASS** | Strict TypeScript check |
| `npm run lint` | **PASS** | ESLint clean |
| `npm run build` | **PASS** | All 31 static & dynamic routes compiled |
| GitHub CI | **Configured** | `.github/workflows/ci.yml` |
| Security Review | **Run 2 Complete** | `audits/codbooks/run-2/` |
