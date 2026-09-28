# Changelog — CodBooks

All notable changes in this project.

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- **Team invite:** Owner-only `/team` + `GET/POST /api/users` to invite `ops` | `accountant` into the current seller org (create user or attach existing email without conflicting membership). Nav Team link hidden for non-owners.
- **Matches chase filters:** `GET /api/matches` accepts `q` (AWB/CN/order id/customer substring) and `courier` (exact, case-insensitive) alongside `status`. UI: search, courier chips, status select, clear. Health cards / status counts / by-courier deep-link into filtered matches.
- **Aging → Matches drill-down:** `GET /api/matches?aging=<7|7-14|>14` filters latest run to unpaid|short (when status omitted) via `agingBucketFromDate(reference_date)`. Aging board courier cards link `/matches?aging=…&courier=…`; Matches shows aging chip + clear.
- **Chase notes:** `PATCH /api/matches/[id]` `{ notes }` (max 500) for owner/ops; accountant **403**; org-scoped 404. Matches table Notes column with inline edit.
- **Receivable export window:** `GET /api/export/receivable?status=short,unpaid&from=YYYY-MM-DD&to=YYYY-MM-DD` (all optional). Exports page presets (All / Chase / Short / Unpaid) + date from/to.
- **Settlement Health first-run checklist:** Dismissible 3-step onboarding when no uploads or no match run — upload orders → upload CPR → Exports / Team. Tip points at `fixtures/` examples + `COURIER_TEMPLATES.md`. Dismiss persisted in `localStorage` keyed by user id.

### Security

- Matches `q` LIKE metacharacters (`%`, `_`, `\\`) escaped for literal substring match (`ESCAPE '\\'`).
- Password minimum raised to **10** on register + team invite (UI `minLength` + API).
- Soft in-memory rate limit on **login** and **register**: ≤10 failures per IP/email in 15 minutes → HTTP **429** with `Retry-After` (single-node; not shared across replicas).
- Seed demo passwords bumped to ≥10 (`owner12345` / `acct12345` / `ops12345`); still production-gated unless `ALLOW_DEMO_SEED=1`.

## [0.1.0] — 2026-09-28

### Added

- **MVP:** COD receivable + courier settlement reconciliation for Pakistani ecommerce sellers and accountants.
- Next.js 15 App Router + TypeScript + Tailwind + SQLite (`better-sqlite3`); money as integer **paisa**.
- Auth: email/password, httpOnly sessions, org roles (`owner` / `ops` / `accountant`).
- Order CSV upload + **TCS** and **PostEx** CPR/settlement CSV parsers.
- Match engine: AWB → CN → order id; statuses `matched | short | unpaid | unmatched | double_paid`; tolerance PKR 1 (100 paisa).
- Settlement Health dashboard, aging board (`<7` / `7-14` / `>14`), fee breakdown storage.
- Accountant exports: COD receivable register + fee breakdown CSV; upload/match audit log.
- Seed + synthetic fixtures + Roman Urdu guide (`GUIDE-roman-urdu.md`).

### Security / QA (R1 → R2 dual-clear)

- Role matrix: mutations (`uploads` / `match`) owner+ops only; accountant read+export; audit owner+accountant.
- Upload path traversal closed — UUID-only keys under `data/uploads/`; client filename never on disk path.
- CSV injection neutralized on every export cell (`sanitizeCsvCell`).
- Demo seed refused in production unless `ALLOW_DEMO_SEED=1`; login UI no password prefill.
- DB/uploads owner-only modes (`0600` / `0700`).
- Unpaid orders retain courier attribution on health/aging (no `unknown`).

### Verification

- QA R2: **PASS** (`QA-REPORT-R2.md`) — 33/33 tests, build green.
- Security R2: **PASS_WITH_NOTES** (`SECURITY-REPORT-R2.md`).
