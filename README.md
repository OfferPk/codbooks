# CodBooks

COD receivable + courier settlement reconciliation for Pakistani ecommerce sellers and their accountants.

Upload order CSVs and courier CPR/settlement CSVs (TCS + PostEx) → auto-match by AWB / CN / order id → Settlement Health, aging board, accountant CSV exports.

**Roman Urdu guide:** [GUIDE-roman-urdu.md](./GUIDE-roman-urdu.md)

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- better-sqlite3 (local DB; schema shaped for later Postgres)
- papaparse (CSV-first; no xlsx in MVP)
- Money stored as integer **paisa** (PKR × 100)

## Quick start

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000

### Demo logins (local/dev only)

`npm run seed` creates these accounts for **local development**. Seed refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=1`. Do not use these passwords in any real deployment.

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@codbooks.local | owner123 |
| Accountant | accountant@codbooks.local | acct123 |
| Ops | ops@codbooks.local | ops123 |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run seed` | Reset DB + import fixtures + match |
| `npm test` | Vitest unit/integration |
| `npm run build` | Production build |
| `npm run db:reset` | Delete DB + re-seed |

## Key routes

| Path | Purpose |
|------|---------|
| `/health` | Settlement Health (owed / short / >14d / unmatched) |
| `/aging` | Aging board `<7` / `7-14` / `>14` by courier |
| `/uploads` | Order + CPR CSV upload |
| `/matches` | Match results table |
| `/exports` | COD receivable + fee breakdown CSV |
| `/audit` | Upload + match audit log |

## Docs

- [PRODUCT.md](./PRODUCT.md) — product scope
- [COURIER_TEMPLATES.md](./COURIER_TEMPLATES.md) — TCS / PostEx column maps
- [GUIDE-roman-urdu.md](./GUIDE-roman-urdu.md) — install + har feature (Roman Urdu)
- [fixtures/](./fixtures/) — synthetic golden CSVs

## Security notes

- Session cookies are httpOnly; set `COOKIE_SECURE=false` for local HTTP (`next start`)
- Uploads land in `data/uploads/` (gitignored); filenames are server UUID-only
- DB and uploads use owner-only modes (`0600` / `0700`)
- Role matrix: owner+ops mutate uploads/match; accountant cannot mutate; audit is owner+accountant
- Do not commit `data/*.db` or real merchant CPR files
- Never seed demo credentials into production
