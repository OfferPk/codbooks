# CodBooks — Security Report IMPROVE (auth + team invite)

**Date:** 2026-09-28 16:40 PKT (Asia/Karachi)  
**Project:** `/workspace/factory/projects/codbooks`  
**HEAD reviewed:** `260f765` — `feat(unreleased): auth hygiene, health checklist, matches filters, team invite`  
**Prior release:** `92bd84f` — Security R2 **PASS_WITH_NOTES** (`SECURITY-REPORT-R2.md`)  
**Scope:** Delta — password min 10; login/register rate limit → 429; owner-only Team invite (ops|accountant); spot-check Health checklist + matches filters. Regression of R2 controls.  
**Method:** Read FIX-NOTES / CHANGELOG / STATUS; inspect routes + libs; review new tests; `npm test`; `npm audit --omit=dev`; secrets/gitignore/`stat` on data. **No product code edits. No git push.**

## Overall verdict: **PASS_WITH_NOTES**

## Ship blockers

**None.**

---

## Delta findings

### 1. Password minimum length 10 — **PASS**

| Path | Evidence |
|------|----------|
| Constant | `MIN_PASSWORD_LENGTH = 10` in `src/lib/rate-limit.ts:59` |
| Register API | `register/route.ts:51-57` → 400 if `< MIN_PASSWORD_LENGTH` |
| Register UI | `register/page.tsx:87` `minLength={10}` |
| Team invite API | `users/route.ts:47-53` same floor |
| Team invite UI | `TeamClient.tsx:145` `minLength={10}` |
| Seed | Demo PWs ≥10: `owner12345` / `acct12345` / `ops12345` (`scripts/seed.ts:62-64,96-98`) |
| Tests | Register short → 400 (`auth-hygiene.test.ts:92-103`); invite short → 400 (`team-invite.test.ts:153-163`) |

**Note:** No change-password endpoint exists in this app; floor applies to all password-set paths (register + invite create).

### 2. Login / register rate limit → 429 — **PASS** (process-local)

| Item | Evidence |
|------|----------|
| Implementation | Soft in-memory `Map` buckets; ≤10 failures / 15 min (`rate-limit.ts:7-45,57-58`) |
| Login | IP + email keys; check before verify; record on bad creds; clear on success; **429** + `Retry-After` (`login/route.ts:34-50,58-60,81-82`) |
| Register | IP key; 429 when limited; failure recorded on email conflict (`register/route.ts:30-42,63-64`) |
| Test | 10× 401 then 429 (`auth-hygiene.test.ts:105-124`) |

**Note (non-blocking):** Process-local only — not shared across replicas/workers. Trusts `X-Forwarded-For` / `X-Real-Ip` as-is. Acceptable for single-node MVP; add edge limit + trusted proxy before multi-instance / public prod.

### 3. Owner-only Team invite — **PASS**

| Check | Evidence |
|-------|----------|
| API authz (not UI-only) | GET + POST `/api/users` → `requireRoles("owner")` (`users/route.ts:11,32`) |
| Page gate | `/team` → `requireRoles("owner")`; non-owner → `/health` (`team/page.tsx:9-13`) |
| Nav gate | Team link only if `role === "owner"` (`Nav.tsx:26-29`) |
| Role allowlist | `INVITE_ROLES = ["ops","accountant"]`; else 400 (`users/route.ts:7,55-59`) |
| Cannot mint `owner` | Rejected by allowlist; test expects 400 (`team-invite.test.ts:164-172`) |
| Org scope | Memberships inserted with `actor.org_id` only (`users/route.ts:94`) |
| Conflict | Existing member in same org → 409 (`users/route.ts:77-81`) |
| Tests | Ops/accountant GET/POST 403; owner list + invite 201 (`team-invite.test.ts`) |

**Note:** Attaching an existing email into the org does not reset that user's password (password validated for length but unused on attach path) — intentional; still requires owner session.

### 4. Health checklist + matches filters — **PASS** (low risk)

| Area | Finding |
|------|---------|
| Health checklist | Static copy + `localStorage` dismiss keyed by `userId` (`HealthChecklist.tsx:33-67`). No privileged API; Team secondary CTA owner-gated via `isOwner`. No `dangerouslySetInnerHTML`. |
| Health API | `requireUser()` + `getHealthSummary(user.org_id)` (`health/route.ts:7-8`) — org-scoped. |
| Matches filters | `requireUser()`; SQL always `m.org_id = ?`; `status` / `courier` / `q` bound as parameters (`matches/route.ts:7-42`). No string-concat injection. |
| LIKE wildcards | User `%`/`_` in `q` act as LIKE metacharacters — information-narrowing within own org only; non-blocking for MVP. |

---

## Regression check vs Security R2

| R2 control | Status | Evidence |
|------------|--------|----------|
| `requireRoles` / `ROLE_MATRIX` on mutate, audit, export | **Still OK** | `auth.ts:146-158`; uploads/match `owner,ops` (`uploads/route.ts:33`, `match/route.ts:7`); audit `owner,accountant` (`audit/route.ts:7`); export `requireAction("export")`. Authz suite still green (9 tests). |
| Upload path UUID-only + containment | **Still OK** | `resolveSafeUploadPath` (`ingest.ts:27-48`); write `mode: 0o600` + `ensurePrivateDir`. |
| `sanitizeCsvCell` / `csvLine` on exports | **Still OK** | `csv.ts:51-65`; export routes unchanged pattern. |
| Seed blocked in production; login no prefill | **Still OK** | `scripts/seed.ts:15-24` + `ALLOW_DEMO_SEED`; login empty state (`login/page.tsx:9-11`); demo hint only non-prod (`:80-84`). |
| fs-perms 0700/0600 | **Still OK** (legacy note) | Code: `fs-perms.ts` MODE_DIR/FILE. Observed: `data/` **0700**, `codbooks.db` **0600**, `uploads/` **0700**, files **0600**. Some legacy org dirs still **0755** (R2 note; parent 0700). |
| Session cookies httpOnly / SameSite / secure-in-prod | **Still OK** | `auth.ts:98-104` `httpOnly`, `sameSite: "lax"`, `secure: shouldUseSecureCookie`. |
| Unpaid match `courier_id` attribution | **Still OK** | Unpaid insert uses `o.courier_id` (`match.ts:322`). |

---

## Secrets & supply chain

- `.gitignore`: `data/*.db`, `data/*.db-*`, `data/uploads/**`, `.env`, `.env*.local` (keep `.env.example`).
- `.env.example`: placeholders only (`COOKIE_SECURE=false` for local).
- No DB/env committed (`git check-ignore` confirms).
- No hardcoded API keys/secrets in `src`/`scripts` (demo seed passwords documented as local/dev only).
- `npm audit --omit=dev`: **0** vulnerabilities.
- `npm test`: **43/43** passed (10 files).

---

## Notes (non-blocking)

1. **Rate limit** is process-local `Map`; fine for single-node MVP. Document / add shared or edge limiting before multi-replica deploy. Forwarded IP headers must come from a trusted proxy.
2. **Legacy upload org dirs** at 0755 remain from pre-chmod era (same R2 note); parent `uploads/` is 0700.
3. **Invite UX:** owner sets temp password for new users (no email token flow) — acceptable MVP; ops should rotate after first login in shared environments.
4. **Matches `q` LIKE:** `%`/`_` not escaped — within-org only; sanitize if ever exposed cross-tenant.
5. Do not set `COOKIE_SECURE=false` on HTTPS production (R2 deployment gate still applies).

---

## Sign-off

**CLEAR** for this Unreleased improve (auth hygiene + team invite + checklist/filters).  
**Verdict:** **PASS_WITH_NOTES** — **no ship blockers**. R2 controls not regressed.

Reviewed against `RELEASE_GATE.md`, `SECURITY-REPORT-R2.md`, FIX-NOTES / CHANGELOG Unreleased section.  
**Explicit:** no product code edits; no git push.
