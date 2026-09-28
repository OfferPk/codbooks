# CodBooks MVP Security Report

**Reviewed:** 2026-09-21 18:22 PKT  
**Scope:** authz, session cookies, upload path handling, CSV injection, repository secrets, and SQLite/file permissions.  
**Verdict:** **FAIL — do not ship until all blockers below are fixed.**

## Results

| Area | Result | Ship decision |
|---|---|---|
| Authorization | **FAIL** | Blocker |
| Session cookies | **PASS*** | No code blocker; enforce production config |
| Upload path traversal | **FAIL** | Blocker |
| CSV/formula injection | **FAIL** | Blocker |
| Secrets/default credentials | **FAIL** | Blocker for any seeded or production deployment |
| SQLite and upload-file permissions | **FAIL** | Blocker |

## Ship blockers

### 1. Authorization is authentication-only

Every data and write endpoint calls `requireUser()` but no endpoint calls the existing `requireRoles()` helper. In particular, any authenticated `accountant` or `ops` member can upload orders/CPRs, trigger matching, view audit data, and download exports. The role is displayed and stored but is not enforced as a privilege boundary.

**Evidence:** `src/app/api/uploads/route.ts:33`, `src/app/api/match/route.ts:7`, `src/app/api/audit/route.ts:7`, `src/app/api/export/*/route.ts:8`; `requireRoles` is only defined in `src/lib/auth.ts:136`.

**Required gate:** Define and enforce a role matrix on every read/write endpoint (especially upload and match), and add tests proving forbidden roles receive 403. Tenant predicates consistently use the session `org_id`; no cross-org query bypass was found in this review.

### 2. Upload filename enables filesystem path traversal

`storageKey` concatenates the untrusted multipart filename and then passes it to `path.join()` and `writeFileSync()` without basename validation or containment checking:

- `src/lib/ingest.ts:26-29`
- `src/lib/ingest.ts:105-108`

A filename such as `../../../../../../tmp/outside.txt` resolves outside `data/uploads` (confirmed by path resolution). An authenticated uploader can therefore write/overwrite files at paths reachable by the server process, subject to filesystem permissions.

**Required gate:** Generate storage names exclusively from server-controlled IDs; reject path separators and traversal segments; resolve and verify the final path remains under the upload root before writing.

### 3. Exported CSVs are vulnerable to spreadsheet formula injection

The receivable export escapes commas/quotes/newlines only for `customer_name` and `notes`. Other attacker-controlled values are joined directly, including order IDs, AWB/CN, status-adjacent fields, and dates (`src/app/api/export/receivable/route.ts:39-54`). The fees export directly joins settlement identifiers and references (`src/app/api/export/fees/route.ts:41-69`). Neither exporter neutralizes values beginning with `=`, `+`, `-`, or `@`.

A crafted uploaded value can become a formula when the accountant opens the CSV in a spreadsheet, enabling data exfiltration or other spreadsheet-side actions.

**Required gate:** Apply one tested CSV-cell sanitizer to every exported cell, including formula-prefix neutralization, in addition to normal CSV quoting.

### 4. Known credentials are committed and seedable

The repository contains predictable demo passwords in executable seed/UI code and documentation:

- `scripts/seed.ts:48-50` creates `owner123`, `acct123`, and `ops123` accounts.
- `src/app/login/page.tsx:9-10` pre-fills the owner credentials.
- `README.md:26-32` and `GUIDE-roman-urdu.md` publish them.

These are not live API keys, and no private key or production API token was found. They are nevertheless a production blocker because running the documented seed command creates remotely usable accounts with public passwords; retaining a seeded DB has the same issue.

**Required gate:** Make seed/demo accounts development-only, require non-default credentials or refuse production startup/seed, and remove production-facing default login behavior and credential documentation.

### 5. SQLite and stored upload files are world/group-readable

The current artifacts are:

- `data/codbooks.db`: **0644**
- `data/` and `data/uploads/`: **0755**
- stored upload CSVs: **0644**

The DB contains password hashes, session bearer IDs, organization membership, customer/financial data, and audit data. Upload files contain the source order/settlement data. `src/lib/db.ts:22-30` creates the DB but does not set restrictive permissions; normal umask creation produced the observed 0644 file.

**Required gate:** Run the service under a dedicated account, use private directories (0700/0750 as appropriate), create DB and upload files 0600/0640 as appropriate, and verify WAL/SHM sidecars receive equivalent restrictions. Do not rely on `.gitignore` as an access-control mechanism.

## Session-cookie assessment

**PASS with a deployment gate:** `codbooks_session` is `httpOnly`, `SameSite=Lax`, path-scoped to `/`, has a 14-day max age, uses random UUID session IDs stored server-side, and expired sessions are deleted. In production, `secure` defaults to true (`src/lib/auth.ts:80-90`).

**Release condition:** `COOKIE_SECURE=false` must never be set in production; it is explicitly present in `.env.example` for local HTTP. A deployment check should enforce this rather than allowing an insecure production override.

## Validation

- `npm test`: **24/24 tests passed** (6 test files).
- Tracked-file secret scan: no live API keys, private keys, or production tokens found; known demo credentials are the blocker described above.
- No product code was modified; only this report was added.
