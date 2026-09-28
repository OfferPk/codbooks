# CodBooks — QA Report (Unreleased improve delta)

**Date:** 2026-09-28 16:42 PKT (Asia/Karachi)  
**Result: PASS**  
**Scope:** Improve delta only atop v0.1.0 `92bd84f` (improve commit `260f765`). Auth hygiene, Health empty-state checklist, Matches `q`+courier(+status) filters, Team invite owner-only.  
**Prior:** `QA-REPORT.md` / `QA-REPORT-R2.md` (**PASS**) — v0.1.0 dual-clear stays; this report does **not** re-litigate R2.  
**Constraint:** Report only — no product source changes, no GitHub push, no agent messages.

## Executive summary

SE1 READY_FOR_QA claim holds. All four Master-assigned improve items verified live against `COOKIE_SECURE=false npm run start` (:3000) after `npm run db:reset`. Automated suite **43/43** (10 files); production build green (Next.js 15.5.25). No new P0/P1. **CLEAR for improve merge/publish from QA.**

## Gates

| Gate | Result | Evidence |
|------|--------|----------|
| `npm test` | **PASS** | 10 files, **43/43** (incl. `auth-hygiene` 2, `matches-filter` 4, `team-invite` 4) |
| `npm run build` | **PASS** | Next.js 15.5.25 — compiled, lint/types OK, 25/25 static pages |
| Seed / demo logins | **PASS** | `npm run db:reset`; owner / accountant / ops → `/api/auth/login` **200** + httpOnly `codbooks_session` (`COOKIE_SECURE=false`) |
| HEAD | `260f765` | `feat(unreleased): auth hygiene, health checklist, matches filters, team invite`; release `92bd84f` untouched |

## Scoped verify

### 1) Auth hygiene — password min 10 + login/register soft rate limit → 429 — **PASS**

| Check | Result | Evidence |
|-------|--------|----------|
| Register password &lt; 10 | **400** | `POST /api/auth/register` `password=short` / `123456789` → `{"error":"Password must be at least 10 characters"}` |
| Register UI `minLength` | **10** | `/register` HTML: `<input … type="password" … minLength="10" …>` |
| Team invite password floor | **400** | Owner `POST /api/users` `password=short` → same 10-char error |
| Seed passwords ≥10 | **OK** | `owner12345` / `acct12345` / `ops12345` in `scripts/seed.ts` |
| Login rate limit | **429** | 10× failed login (`ratelimit-qa@…`, IP `203.0.113.90`) → **401**; 11th → **429** + `Retry-After: 900` + `Too many failed login attempts…` |
| Register rate limit | **429** | 10× register with taken email (IP `203.0.113.91`) → **409**; 11th → **429** + `Retry-After: 900` |
| Unit coverage | **PASS** | `tests/auth-hygiene.test.ts` (short password + 429 after `RATE_LIMIT_MAX`) |

Soft in-memory, single-node (documented README Auth notes) — residual, not a blocker.

### 2) Health empty-state 3-step checklist (localStorage by user id) — **PASS**

| Check | Result | Evidence |
|-------|--------|----------|
| Empty org shows checklist | **PASS** | Fresh register `fresh-qa2@…`; `/health` RSC props: `{"show":true,"userId":"34c4af34-…","isOwner":true}` |
| Seeded org hides checklist | **PASS** | Owner on Demo COD Store: RSC `\"show\":false` (uploads + match runs present) |
| 3 steps + tip + dismiss key | **PASS** | Built chunk `health/page-*.js`: steps Upload orders → TCS/PostEx CPR → Exports/invite; tip `fixtures/` + `COURIER_TEMPLATES.md`; `localStorage` key `codbooks_health_checklist_dismissed_${userId}`; dismiss CTA `Dismiss / Chhupa do` |
| Client-only render | Note | Checklist text appears after hydration (`dismissed` starts true until `useEffect`); curl SSR proves props + bundle, not painted DOM |

### 3) Matches `q` + courier filter (+ status) — **PASS**

Owner `GET /api/matches` on seeded Demo org (11 rows: short 8, unpaid 3; couriers `tcs`/`postex`):

| Query | HTTP | Result |
|-------|------|--------|
| (none) | 200 | 11 matches; `couriers: ["postex","tcs"]` |
| `q=779400000003` (AWB) | 200 | **1** row; AWB match |
| `courier=TCS` (case-insensitive) | 200 | **7** rows, all `tcs` |
| `courier=postex` | 200 | **4** rows, all `postex` |
| `status=short` | 200 | **8** rows, all `short` |
| `status=short&courier=tcs` | 200 | **6** rows, all short+tcs |

UI: matches page chunk has search placeholder `Search AWB, CN, order id, customer…`, courier chips (All/tcs/postex), status select, Clear.  
Health deep links (seeded `/health` HTML): `/matches?status=unpaid|short|unmatched|…`, `/matches?courier=tcs|postex`, combined `status=…&courier=…`.  
Unit: `tests/matches-filter.test.ts` 4/4.

### 4) Team invite owner-only — **PASS**

| Actor | `GET /api/users` | `POST /api/users` | `/team` page | Nav `Team` link |
|-------|------------------|-------------------|--------------|-----------------|
| Owner | **200** roster (owner/ops/accountant) | **201** invite `invitee-qa@…` role=ops | **200** Team + Invite form | **Present** `href="/team">Team` |
| Ops | **403** `Forbidden` | **403** | **307** → `/health` | **Absent** |
| Accountant | **403** | **403** | **307** → `/health` | **Absent** |

Invite roles limited to ops|accountant; password min 10 on invite API + `TeamClient` `minLength={10}`. Nav gated `role === "owner"` (`Nav.tsx`). Unit: `tests/team-invite.test.ts` 4/4.

## P0 / new P1

**None.**

## Residuals / non-blockers

1. Rate limit is **in-memory / single-node** (resets on process restart; not shared across replicas) — documented in README; acceptable for MVP improve.
2. Health checklist is client-hydrated; empty-state copy is not in first HTML paint until JS runs (props + bundle verified).
3. Concurrent Security report file `SECURITY-REPORT-IMPROVE-20260928.md` observed untracked in working tree during this run — out of QA scope; not evaluated here.
4. Prior R2 residuals (stale upload dir modes from older runs, etc.) unchanged; not re-opened for this delta.

## Final disposition

**PASS — all four improve-scoped items hold; npm test 43/43; build green; no new P0/P1.**  
**CLEAR for improve merge/publish from QA.** (v0.1.0 dual-clear unchanged; push/token remains out of QA scope.)
