# CodBooks MVP — Independent QA Report

**Date:** 2026-09-21 18:22 PKT  
**Result: FAIL**  
**Scope:** PRD `PRD-codbooks.md`, build brief `BUILD-codbooks.md`; no product source was modified.

## Executive summary

The core MVP path is functional: automated tests are green, the production build succeeds, demo authentication works for all three seeded roles, TCS and PostEx CSV uploads parse, matching/health/aging/audit endpoints respond, and both CSV exports open as valid CSV. The release is **FAIL** for two P1 findings: mutation APIs do not enforce role permissions, and unpaid orders cannot be attributed to a courier, so the required courier-level aging/health view is incomplete for unpaid orders.

## Verification results

| Area | Result | Evidence |
|---|---|---|
| `npm test` | **PASS** | 6 files, **24/24 tests passed** |
| `npm run build` | **PASS** | Next.js 15.5.25 production build completed; all listed routes generated |
| Owner auth | **PASS** | Valid login and `/api/auth/me`; bad password returns 401; unauthenticated health/export returns 401 |
| Accountant auth | **PASS** | Valid login and `/api/auth/me` return `role: accountant` in the demo seller org |
| Ops auth | **PASS** | Valid login and `/api/auth/me` return `role: ops` in the demo seller org |
| Orders + TCS CPR | **PASS** | Seed and fresh-org API flow accepted orders and TCS invoice/detail CSVs with parsed rows and no parser errors |
| Orders + PostEx CPR | **PASS** | Fresh-org API flow accepted PostEx portal and payment-status CSVs with parsed rows and no parser errors |
| Match statuses | **PASS with caveat** | Fresh PostEx API fixture produced `matched: 2, unpaid: 2`; duplicate settlement test produced `double_paid: 6`; orphan settlement produced `unmatched: 1`; seeded TCS/PostEx path produced short/unpaid rows |
| Settlement Health | **PASS with P1 limitation** | Returned owed, short, >14d, unmatched count and courier breakdown; seeded run values were PKR 13,440.76 owed, PKR 5,440.76 short, PKR 11,647.76 >14d, 0 unmatched |
| Aging | **PASS with P1 limitation** | Returned `<7`, `7-14`, `>14` buckets and courier codes; unpaid orders without a settlement were placed under `unknown` courier |
| Exports | **PASS** | Receivable CSV: 11 data rows / 11 columns; fees CSV: 9 data rows / 15 columns; headers and quoting parsed cleanly with a CSV reader |
| Audit | **PASS** | Upload and match-run events returned with user, action, metadata, and timestamp |
| Roman Urdu guide | **PASS** | `GUIDE-roman-urdu.md` covers install/run, demo accounts, every MVP page/feature, troubleshooting, CSV-only scope, and is linked from README |
| XLSX | **PASS (documented scope)** | Build brief explicitly permits CSV-only MVP; README/guide document CSV-first/no XLSX |

## Automated test count

- **24 passed, 0 failed** across 6 Vitest files:
  - aging: 3
  - match classifier: 7
  - money: 4
  - normalize: 3
  - parsers: 5
  - golden path: 2

## P0 findings

None.

## P1 findings

### P1-1 — Role permissions are not enforced on mutation APIs

All data routes use `requireUser()`; `requireRoles()` is defined but not used by the route handlers. In a live production-server check, both the seeded accountant and ops sessions received HTTP 200 from `POST /api/match` and were able to create match runs/audit events. The same pattern exposes upload/mutation routes to any authenticated membership.

**Impact:** A compromised or mistaken accountant/ops session can mutate the finance ledger by uploading files or rerunning matches. This undermines the stated owner/ops/accountant role model.

**Recommendation:** Define and enforce an action matrix at the API boundary (for example, owner/ops for uploads and reruns; accountant read/export access unless explicitly intended), and add route-level tests for 401/403 behavior.

### P1-2 — Unpaid orders lose courier attribution

Orders are ingested without a courier field, and shipments are assigned a courier only when a settlement line is matched. Orders with no settlement therefore receive `courier_id = NULL`; the seeded health/aging output showed the TCS/PostEx orphan orders under `unknown` rather than their courier. This makes required courier-level unpaid aging and health incomplete precisely for overdue receivables.

**Impact:** Sellers cannot reliably see unpaid receivables by TCS vs PostEx. The current `unknown` bucket also makes courier totals less actionable.

**Recommendation:** Preserve courier context from the order upload (courier hint/column or upload-level association), or add a deterministic courier mapping step before matching. Add a fixture/test asserting unpaid rows retain their courier.

## P2 findings

None blocking the MVP path. The fixture set does not naturally demonstrate every status in one seed run, but all five statuses were exercised through unit tests and targeted API checks during this QA pass.

## Manual test evidence

1. Reset/seed completed successfully using `npm run seed`; demo accounts were present.
2. Unauthenticated protected API requests returned 401; invalid credentials returned 401.
3. Owner, accountant, and ops logins returned the expected role and shared seller org.
4. Fresh seller org: uploaded TCS orders (7 rows), PostEx orders (4 rows), TCS CPR (3 rows), and PostEx CPR (3 rows); all returned `errors: []` and correct courier/template detection.
5. Fresh PostEx org: API-shaped settled rows classified as 2 matched and 2 unpaid; duplicated CPR rows classified as double-paid; an orphan CPR row classified as unmatched.
6. Health, aging, matches, uploads, and audit APIs returned scoped JSON data. Both export endpoints returned parseable CSV with accountant-facing headers.
7. README links to `GUIDE-roman-urdu.md`; guide includes all requested demo/run/feature documentation.

## Final disposition

**FAIL — not ready for sign-off until P1-1 role authorization and P1-2 courier attribution for unpaid orders are addressed.**
