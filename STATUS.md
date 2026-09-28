# CodBooks — Status

**Version:** 0.1.0 (+ Unreleased improve pack 2)  
**Updated:** 2026-09-28T16:50:00+05:00 (Asia/Karachi)  
**Status:** READY_FOR_QA

## Current round

**Unreleased pack 2** (on `260f765`): LIKE escape for Matches `q`, Aging → Matches deep-links + `aging` filter, chase notes PATCH, receivable export status/date window. Prior improve dual-cleared; release `92bd84f` untouched. No `git push`.

| Gate | Result |
|------|--------|
| Prior QA R2 (v0.1.0) | **PASS** (`QA-REPORT-R2.md`) |
| Prior Security R2 (v0.1.0) | **PASS_WITH_NOTES** (`SECURITY-REPORT-R2.md`) |
| Prior improve dual-clear | **PASS** / **PASS_WITH_NOTES** (`QA-REPORT-IMPROVE-20260928.md`, `SECURITY-REPORT-IMPROVE-20260928.md`) |
| `npm test` (pack 2) | **52/52** (12 files) |
| `npm run build` | **success** (Next.js 15.5.25) |
| Pack 2 status | **READY_FOR_QA** |
| Git push / tag | **blocked** — `GH_TOKEN` invalid; local commits only |

## Prior dual-clear R2 (v0.1.0)

Ship clear for first publish `OfferPk/codbooks` v0.1.0 when token works. See `CHANGELOG.md` [0.1.0].
