# CodBooks — Istemaal Guide (Roman Urdu)

> Factory rule: har published project mein yeh file zaroori hai.

## 1. Yeh project kya hai?

CodBooks Pakistani ecommerce sellers ke liye **COD receivable + courier settlement** tool hai. Aap orders CSV aur TCS/PostEx CPR CSV upload karte ho — system auto-match karta hai, short/unpaid/aging dikhata hai, aur accountant ke liye CSV export deta hai.

## 2. Kahan se download karein?

- GitHub / release ZIP (publish ke baad README par link)
- Local factory path: `/workspace/factory/projects/codbooks`

## 3. Pehle kya chahiye? (requirements)

- Node.js 20+
- npm
- Browser (Chrome / Firefox)

## 4. Install + Run (step-by-step)

```bash
cd codbooks
npm install
npm run seed
npm run dev
```

Browser: http://localhost:3000

Production:

```bash
npm run build
COOKIE_SECURE=false npm start
```

## 5. Demo login (sirf local/dev)

Ye passwords **sirf local demo** ke liye hain. Production mein `npm run seed` block hai (unless `ALLOW_DEMO_SEED=1`). Live deploy par ye accounts mat rakho.

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@codbooks.local | owner12345 |
| Accountant | accountant@codbooks.local | acct12345 |
| Ops | ops@codbooks.local | ops12345 |

## 5b. Roles (zaroori)

| Role | Kya kar sakta hai |
|------|-------------------|
| Owner | Sab kuch — upload, match, export, audit, **Team invite** |
| Ops | Upload + match (mutations); audit nahi |
| Accountant | Read + export only — upload/match par **403** |

Demo accounts sirf local/dev (`npm run seed`). Production mein seed band hai.

## 6. Features — har ek kya karta hai

### Login / Register
- Kahan: `/login`, `/register`
- Kaise: email + password (**min 10 chars**); register naya seller org banata hai (role owner)
- Rate limit: bohot failed login/register attempts → **429** (15 min window, single-node)
- Result: `/health` par redirect

### Settlement Health
- Kahan: `/health`
- Kaise: seed ke baad numbers ready; warna pehle Uploads se CSV dalo
- Empty org: dismissible **3-step checklist** (orders upload → CPR upload → Exports / Team); tip mein `fixtures/` + `COURIER_TEMPLATES.md`
- Result: PKR owed, short, >14 din aging, unmatched count; courier-wise breakdown; counts deep-link `/matches?status=…`

### Aging board
- Kahan: `/aging`
- Kaise: unpaid/short lines buckets mein — Under 7 / 7–14 / Over 14; courier card click → `/matches?aging=…&courier=…`
- Result: courier ke sath amount + count; Matches par aging chip

### Uploads
- Kahan: `/uploads`
- Kaise: Kind = Orders ya CPR; CPR par courier hint (TCS/PostEx) optional; CSV choose karke Upload & match
- Result: rows parse; auto match run; list mein recent uploads

### Matches
- Kahan: `/matches`
- Kaise: search box (AWB / CN / order id / customer), courier chips (tcs/postex), status filter, aging chip (Aging se aaye); Clear button
- Notes: chase rows par owner/ops inline notes edit (accountant read-only)
- Result: expected vs remitted vs short PKR; chase short/unpaid tez

### Exports
- Kahan: `/exports`
- Kaise: receivable — status preset (All / Chase=short+unpaid / Short / Unpaid) + optional from/to date; phir Download. Fees full run.
- Result: Excel/Sheets mein khulne wala accountant CSV (period pack)

### Audit
- Kahan: `/audit`
- Kaise: sirf dekho
- Result: kaunsi file kab upload hui, match run kab chala

### Team (owner only)
- Kahan: `/team` (nav sirf owner ko dikhe)
- Kaise: roster dekho; invite form — name, email, role (`ops` | `accountant`), password min 10
- Result: naya user + membership is org mein; pehle se user ho to attach (conflicting membership = 409)
- Ops/accountant invite nahi kar sakte (**403**)

### Re-run match
- Uploads page par “Re-run match” button

## 7. Common masail (troubleshooting)

- **Login fail after `next start`:** `COOKIE_SECURE=false` set karo (HTTP)
- **Unrecognized CPR headers:** COURIER_TEMPLATES.md dekho; fixtures se compare karo
- **Empty health:** pehle orders + CPR upload, phir match
- **DB corrupt:** `npm run db:reset`

## 8. Security / privacy tips

- Real CPR / order files sensitive hain — `data/` git mein mat dalo
- Demo passwords sirf local; production mein strong passwords
- Session cookie httpOnly hai; shared PC par logout karo

## 9. Agla update

- Leopards remittance template (design-partner sample ke baad)
- Bank deposit matcher, firm multi-client UI, PDF CPR
