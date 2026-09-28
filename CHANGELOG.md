# Changelog — CodBooks

All notable changes in this project.

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
