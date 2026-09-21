# CodBooks — Product

## One-liner

Upload courier CPR/settlement files + order exports → auto-match → flag short/unpaid/aging → export accountant-ready ledgers.

## Personas (MVP)

- Seller founder / ops — COD receivable, shorts, >14d aging by courier
- In-house bookkeeper — period export: gross, fees, WHT/GST
- CA / accountant — invited into seller org as `accountant` role

## MVP scope

1. Email/password auth, httpOnly sessions, org membership (`owner` / `ops` / `accountant`)
2. Order CSV upload (generic columns)
3. TCS + PostEx CPR/settlement CSV parsers
4. Match engine: AWB → CN → order id; statuses `matched | short | unpaid | unmatched | double_paid`; tolerance PKR 1 (100 paisa)
5. Fee breakdown storage per settlement line
6. Aging board `<7 | 7-14 | >14`
7. Settlement Health dashboard
8. Exports: COD receivable register + fee breakdown CSV
9. Audit log for uploads and match runs
10. Seed + fixtures + tests + Roman Urdu guide

## Out of MVP

Courier booking, WMS, WhatsApp, bank matcher, billing, Leopards, PDF CPR, Stripe/JazzCash, firm multi-client UI.

## Money

All ledger amounts are integer **paisa** (PKR × 100).
