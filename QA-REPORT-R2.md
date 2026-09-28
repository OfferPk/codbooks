# CodBooks MVP — QA Report R2 (re-verify)

**Date:** 2026-09-28 16:23 PKT  
**Result: PASS**  
**Scope:** Live re-verify of R1 P1 blockers + claimed security fixes from `STATUS.md` / `FIX-NOTES.md`. Report only — no product source changes, no GitHub push, no agent messages.

## Executive summary

All prior P1 / ship blockers from QA R1 and the security report are closed under live curl checks against `COOKIE_SECURE=false npm run start` (port 3456) after `npm run db:reset`. Automated suite is **33/33**; production build is green. TCS + PostEx order/CPR reconcile still works on a fresh seller org. **CLEAR for publish from QA side** (product code already fixed; push is out of QA scope).

## Gates

| Gate | Result | Evidence |
|------|--------|----------|
| `npm test` | **PASS** | 7 files, **33/33** (incl. `authz-security.test.ts` 9) |
| `npm run build` | **PASS** | Next.js 15.5.25 production build succeeded |
| Seed / demo logins | **PASS** | `npm run db:reset`; owner / accountant / ops login + `/api/auth/me` |
| Unauth APIs | **PASS** | `GET /api/health` → 401; `POST /api/match` → 401; bad password → 401 |

## Prior findings (must re-verify)

| ID | Finding | R2 | Live evidence |
|----|---------|----|---------------|
| **P1-1** | Mutation routes used `requireUser()` only; accountant/ops could `POST /api/match` | **PASS** | Accountant `POST /api/match` → **403** `{"error":"Forbidden"}`; accountant upload → **403**; ops `POST /api/match` → **200**; owner match → **200**; ops `GET /api/audit` → **403**; accountant audit → **200**. Routes use `requireRoles("owner","ops")` for mutate; audit `owner`+`accountant`. |
| **P1-2** | Unpaid orders lost courier → `unknown` on health/aging | **PASS** | Seeded health `by_courier`: tcs unpaid_count=1, postex unpaid_count=2; **no `unknown`**. Aging unpaid AWBs: `779400000199`→`tcs`, `CX-EXAMPLE000003`/`CX-EXAMPLE000099`→`postex`. Matches API same. |
| Security: path traversal | Client filename in storage path | **PASS** | Upload with `filename=../../../../tmp/codbooks-evil.csv` → **200**; file at `data/uploads/<orgId>/<uuid>.csv` mode **0600**; `/tmp/codbooks-evil.csv` **does not exist**. |
| Security: CSV injection | Export cells not formula-sanitized | **PASS** | Uploaded `=1+1`, `=HYPERLINK(...)`, `+CMD`, `@SUM(1)`; receivable export cells neutralized with leading `'` (e.g. `'=1+1`, `'@SUM(1)`); **zero** raw leading `=+/@` cells after CSV parse. |
| Security: demo creds | Prefill + seedable in production | **PASS** | Login HTML: empty `value=""` on email/password; no demo passwords in production page; demo hint gated `NODE_ENV !== "production"`. `NODE_ENV=production` seed → refuse + **exit 1** unless `ALLOW_DEMO_SEED=1`. README marks local/dev only. |
| Security: file perms | DB/uploads world-readable | **PASS** | After seed/live writes: `data/` **0700**, `codbooks.db` **0600**, `data/uploads/` **0700**, new org upload dirs **0700**, new CSV files **0600**. |

## Smoke: TCS + PostEx CSV reconcile (fresh org)

Registered `qa-r2-fresh@example.com` / new seller org. Uploads (`kind=orders|cpr`):

| Upload | HTTP | Rows | Errors |
|--------|------|------|--------|
| orders TCS | 200 | 7 | [] |
| orders PostEx | 200 | 4 | [] |
| CPR TCS invoice | 200 | 3 | [] |
| CPR PostEx portal | 200 | 3 | [] |
| CPR TCS detail | 200 | 3 | [] |
| CPR PostEx payment-status | 200 | 3 | [] |

Final match summary after all CPRs: short/unpaid/double_paid present (duplicate CPR → `double_paid: 6` as expected). Health by_courier still **tcs** + **postex** only; unpaid retain couriers; exports 200 (receivable 14 lines, fees 12 lines).

## Residuals / non-blockers

1. **Stale upload dirs:** Under `data/uploads/`, ~39 pre-fix UUID dirs remain mode **0755** (orphaned from older runs). **New** dirs/files created by current code are **0700/0600**. Optional cleanup: `chmod -R go-rwx data/uploads` or wipe uploads on seed; not a ship blocker for the create-path fix.
2. Demo passwords remain in README/GUIDE as **local/dev only** documentation (intentional).
3. AWB normalizer may strip an `AWB` prefix (cosmetic; not a security/QA P1).

## P0 / new P1

None.

## Final disposition

**PASS — prior P1-1, P1-2, and claimed security ship blockers are closed. CLEAR for publish from QA side.**
