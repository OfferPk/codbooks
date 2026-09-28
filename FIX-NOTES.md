# CodBooks — Fix notes (QA R2 / Security R1)

Date: 2026-09-21 (Asia/Karachi)

All ship blockers from `QA-REPORT.md` and `SECURITY-REPORT.md` addressed.

## 1. Authz — `requireRoles()` / `ROLE_MATRIX`

- Mutations (`POST /api/uploads`, `POST /api/match`) use `requireRoles("owner", "ops")` (via `ROLE_MATRIX.mutate`).
- Accountant: read + export only; **403** on upload/match.
- Ops: can upload/match; **403** on audit (`ROLE_MATRIX.audit` = owner + accountant).
- Unauthenticated: **401**.
- Tests: `tests/authz-security.test.ts` (accountant 403, owner 200, ops audit 403).

## 2. Upload path traversal

- `resolveSafeUploadPath()` in `src/lib/ingest.ts` builds storage keys as `{orgId}/{uploadId}.csv` only.
- Client filename is **never** used in the filesystem path (display name stored in DB only).
- Path is `resolve`d and asserted to stay under `data/uploads/` before write.
- Separators / `..` in identifiers rejected.
- Test: traversal filename still lands under upload root with UUID-only key.

## 3. CSV injection

- Shared `sanitizeCsvCell()` + `csvLine()` in `src/lib/csv.ts`.
- Neutralizes leading `=`, `+`, `-`, `@`, tab, CR; then normal CSV quoting.
- Applied to **every** cell in receivable + fees exports.
- Test: formula-prefix neutralization assertions in authz-security suite.

## 4. Seed / demo credentials

- `scripts/seed.ts` refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=1`.
- Login UI does **not** prefill email/password; demo hint is `NODE_ENV !== "production"` only.
- README + GUIDE-roman-urdu mark demo accounts as **local/dev only**.

## 5. File permissions

- `src/lib/fs-perms.ts`: dirs `0700`, files `0600`.
- DB create path: `ensurePrivateDir` + `chmodDbArtifacts` (db + wal + shm).
- Upload writes: private dir + `mode: 0o600` + chmod after write.
- Seed uses the same helpers after reset.

## 6. Unpaid orders keep courier attribution (QA P1-2)

- Orders table has `courier_id`.
- Order CSV optional `courier` column; upload form courier hint applies to orders as well as CPR.
- `ingestOrders(..., courierHint?)` stores courier on upload + each order row.
- Match creates shipments and unpaid match rows with `o.courier_id` (not null/`unknown`).
- Fixtures include `courier` column; seed passes `tcs` / `postex` hints.
- Test: unpaid AWB retains `courier_code = tcs` on health/aging.

## Verification

- `npm test` — 33/33 passed (7 files)
- `npm run build` — (see STATUS.md)
- No `git push` performed.

---

## Unreleased improve — 2026-09-28 (Asia/Karachi)

Post dual-clear R2 hygiene + adoption gaps (inbox `IMPROVE-codbooks-20260928-1633.md`).

1. **Auth hygiene** — `src/lib/rate-limit.ts`; login/register 429; password min 10; seed passwords ≥10; README auth notes.
2. **Health checklist** — `HealthChecklist.tsx`; show when zero uploads or zero match runs; localStorage dismiss by user id.
3. **Matches filters** — `q` + `courier` + `status` on `GET /api/matches`; UI chips/search; Health deep links.
4. **Team invite** — owner-only `GET/POST /api/users`, `/team`, Nav gated; invite roles ops|accountant only.

Release commit `92bd84f` not amended; no push.

---

## Unreleased pack 2 — 2026-09-28 (Asia/Karachi)

Inbox `IMPROVE-codbooks-20260928-1644.md` (do not re-build 1633 items).

1. **LIKE escape** — `src/lib/like.ts` + `ESCAPE '\\'` on Matches `q`.
2. **Aging deep-links** — `aging` query on `GET /api/matches` (unpaid|short when status omitted); Aging cards → Matches; aging chip UI.
3. **Chase notes** — `PATCH /api/matches/[id]`; owner/ops write; accountant 403; Notes column.
4. **Receivable export filters** — status + from/to; Exports page presets.

Built on `260f765`; no amend of release/`260f765`; no push.
