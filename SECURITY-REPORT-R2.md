# CodBooks — Security Report R2

**Date:** 2026-09-28 16:23 PKT (Asia/Karachi)  
**Round:** R2 (re-review of R1 FAIL / ship blockers)  
**Scope:** Prior FAIL areas only — authz, upload traversal, CSV injection, demo creds, file perms, session cookies, unpaid `courier_id`. No product code edited; no git push.  
**Overall verdict:** **PASS_WITH_NOTES**

## Ship blockers

**None.**

## Prior FAIL re-verify

| Item | Status | Evidence |
|------|--------|----------|
| Authz `requireRoles` / ROLE_MATRIX | **Fixed** | `ROLE_MATRIX` + `requireAction` in `src/lib/auth.ts:146-158`. POST uploads/match: `requireRoles("owner","ops")` (`uploads/route.ts:33`, `match/route.ts:7`). Audit: `requireRoles("owner","accountant")` (`audit/route.ts:7`). Exports: `requireAction("export")` (`export/receivable/route.ts:9`, `export/fees/route.ts:9`). Reads (aging/health/matches/uploads GET): `requireUser()` — all three roles allowed per matrix. Tests: accountant 403 match/upload, ops 403 audit, owner 200 match (`tests/authz-security.test.ts`). |
| Upload path traversal | **Fixed** | `resolveSafeUploadPath` (`ingest.ts:27-48`): storage key `{orgId}/{uploadId}{ext}` only; client name not in FS path; containment via `path.resolve` + `relative`. Malicious `../../../../../../tmp/outside.txt` → `…/uploads/<org>/<uploadId>.txt` under root (`underRoot: true`). `../` in orgId/uploadId rejected. Test: `authz-security.test.ts` “UUID only”. Legacy on-disk names with client suffixes are pre-fix artifacts. |
| CSV formula injection | **Fixed** | `sanitizeCsvCell` / `csvLine` (`csv.ts:51-65`) neutralize leading `=+\-@\t\r` then quote. Receivable + fees apply `csvLine` to **every** cell (`export/receivable/route.ts:40-56`, `export/fees/route.ts:42-69`). Probe: `=HYPERLINK(...)` → `'=HYPERLINK(...)`. Unit assertions in authz-security suite. |
| Demo / seed credentials | **Fixed** (note) | `scripts/seed.ts:15-24` exits in production unless `ALLOW_DEMO_SEED=1`. Login: empty state, no prefill (`login/page.tsx:9-11`); demo hint only when `NODE_ENV !== "production"` (`:80-84`). README/GUIDE mark accounts **local/dev only**. **Note:** password table still documented for local seed (acceptable; not UI-prefilled). |
| SQLite / upload file perms | **Fixed** (note) | Code: `fs-perms.ts` MODE_DIR `0700`, MODE_FILE `0600`; `db.ts` `ensurePrivateDir` + `chmodDbArtifacts`; upload write `mode: 0o600` + chmod. **Observed:** `data/` **0700**, `data/codbooks.db` **0600**, `data/uploads/` **0700**, all files **0600**. **Note:** 39 legacy org subdirs still **0755** (pre-chmod leftovers); parent `uploads/` is 0700 so they are not world-listable. New writes call `ensurePrivateDir` → 0700. |
| Session cookies | **Still OK** | `httpOnly`, `sameSite: "lax"`, path `/`, 14-day maxAge, UUID server sessions + expiry delete (`auth.ts:17-29,61-64,93-104`). Production `secure` default via `shouldUseSecureCookie` (`:80-90`). Do not set `COOKIE_SECURE=false` in production (`.env.example` local only). |
| Unpaid `courier_id` (QA P1-2) | **Fixed** | Unpaid match insert uses `o.courier_id` (`match.ts:322`). Health/aging join `couriers` on `m.courier_id`. Test: unpaid AWB retains `courier_code = tcs`; `unknown` unpaid_count 0 (`authz-security.test.ts`). |

## Checklist (ship)

- [x] Mutate endpoints role-gated (owner/ops); accountant 403
- [x] Audit role-gated (owner/accountant); ops 403
- [x] Upload FS paths server UUID-only + containment
- [x] CSV export cells sanitized (formula + quoting)
- [x] Seed blocked in production; login no credential prefill
- [x] DB/uploads files 0600; data + uploads dirs 0700 (legacy org dirs 0755 noted)
- [x] Session cookies httpOnly / SameSite / secure-in-prod
- [x] Unpaid matches keep courier attribution
- [x] `npm test` **33/33** pass (7 files)
- [x] `npm audit --omit=dev`: **0** vulnerabilities (2 moderate in vitest **dev** only — not a ship issue)

## Notes (non-blocking)

1. Re-chmod or rewrite legacy org upload dirs if operators want every directory node at 0700; runtime path already enforces on create/touch.
2. Demo passwords remain in README/GUIDE under local/dev warnings — fine for MVP; keep seed out of production DBs.
3. Deployment gate: never set `COOKIE_SECURE=false` on HTTPS production.

## Sign-off

**CLEAR for publish** from Security R2: **PASS_WITH_NOTES** with **no ship blockers**.  
Master still gates on **QA R2 PASS** + this **PASS***.

Reviewed against R1 `SECURITY-REPORT.md` + inbox `SECURITY-codbooks.md`. No code changes; no GitHub push.
