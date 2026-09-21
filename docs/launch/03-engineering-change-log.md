# 03 — Engineering change log

All work is **local**. Nothing is pushed, deployed or applied to production.
Baseline: **1de8fa2** (deployed). Local head at the time of writing: **fe50526**.

`git log origin/main..HEAD` — five commits, oldest first:

| # | Commit | Batch | What changed |
| --- | --- | --- | --- |
| 1 | `e257693` | D (earlier) | CSP allows the privacy-preserving YouTube host; footer "About Dr. Jehan" points at `/about`; `/library` reports a failure instead of "No books found" |
| 2 | `cc875fc` | **A** | A Firebase identity with no profile row gets no session |
| 3 | `a0ed893` | **E** | `scripts/launch-readiness-check.mjs` — the activation gate |
| 4 | `8908c57` | **D** | Untruthful public claims replaced or removed |
| 5 | `fe50526` | **C** | A verified learner is no longer dropped into an unauthenticated workspace |

## 1. `e257693` — three defects that made working things look broken

- `next.config.ts:25` — `frame-src` allowed `www.youtube.com` while the academy recordings page
  embeds `www.youtube-nocookie.com`, so the player was blocked in every browser.
- `src/components/shared/Footer.tsx` — "About Dr. Jehan" was `href="#"` while `/about` exists.
- `src/app/library/page.tsx` — a non-ok response threw nothing, so a failed request rendered
  "No books found". It now records the failure and says the library could not be loaded (en/ar/tr).

Tests: `tests/academy/unavailable-repairs.test.ts` (5). Also ships the 125-finding audit,
`docs/audits/2026-09-21-unavailable-features.md`.

## 2. `cc875fc` — Batch A, the P0 session defect

**Root cause.** Profiles are created by the sign-up routes only. A Google or Facebook popup, an
account made in the Firebase console, or one whose profile was removed leaves a verified identity
with no profile row. `POST /api/auth/session` answered that caller with a 14-day cookie and the
invented role `student`, and the login page redirected without checking `res.ok`. Every later
request was refused, because `getSession()` resolves the caller from `profiles` and returns null
without a row. The browser looked signed in and nothing worked.

**Change.** New `src/lib/auth/session-exchange.ts` holds the decision as a pure function of the row.
No row ⇒ `{"outcome":"no_account"}` ⇒ the route answers **401 with no `Set-Cookie`**. A row is
reported exactly as stored; nobody is promoted by signing in. The login page runs both sign-in paths
through one exchange that checks the response, ends the Firebase session on refusal, and tells the
visitor to create an account.

**Not decided here:** whether a provider sign-in may *create* an account (report 15).

Files: `src/lib/auth/session-exchange.ts` (new), `src/app/api/auth/session/route.ts`,
`src/app/login/page.tsx`, `tests/auth/session-exchange.test.ts` (new, 13),
`tests/academy/teacher-journey.test.ts` (expectations updated).

**Rollback:** `git revert cc875fc`. That restores the defect; prefer fixing forward.

## 3. `a0ed893` — Batch E, the activation gate

`scripts/launch-readiness-check.mjs` answers one question against the database a deployment will
use: if `ACADEMY_CORE_SCHEMA_READY` were turned on now, would the academy work? It checks the 51
academy tables (read from the migrations, not a copied list), both account tables and the
`uuid-ossp` extension, every policy in the registry, an **active** administrator, the minimum
content a cohort needs, and the configuration each flow depends on. SELECTs only; counts, names and
booleans only; a failure exits non-zero.

Against the isolated test branch: 25 passed, 2 warnings, 1 failure (no active administrator).
It also corrected a number from the earlier audit: the registry defines **12** policies, not 13.

Files: `scripts/launch-readiness-check.mjs` (new), `tests/academy/launch-readiness-check.test.ts`
(new, 7). **Rollback:** delete the script; it changes no application behaviour.

## 4. `8908c57` — Batch D, truthful public claims

**PREPARED LOCALLY, NOT PUBLISHED — needs Dr. Jihan's approval before it reaches the site.**

- The hero collected an address for an "early-bird 50% OFF" list and answered
  `alert("Thank you! You've secured your 50% discount.")` while storing nothing: the handler
  contained no request, and the `waitlist` table such a request would need does not exist in the
  deployment. Replaced by an invitation to the catalogue that collects nothing.
- A testimonials section attributed invented quotes and five-star ratings to three named people.
  Removed; nothing invented replaces it.
- `/assessments` offered "Start Test" on a link to `#`. It now states that the placement test is not
  open yet.

Files: `src/app/page.tsx`, `src/app/assessments/page.tsx`, the three message files,
`tests/security/truthful-public-claims.test.ts` (new, 6 — including a repo-wide check that no page
ships a `href="#"` call to action).

**Left to the owner:** the hardcoded "30+ years" and "100%" figures, and the invented plan prices on
the unlinked `/subscriptions` page (report 15).

**Rollback:** `git revert 8908c57` restores the previous copy, including the fabrications.

## 5. `fe50526` — Batch C, the registration hand-off

Student sign-up runs entirely on the server, so the browser holds no session afterwards.
`/verify-email` pushed the account home once the code was accepted, dropping the new learner into
the academy workspace unauthenticated: the first thing they saw after "Email Verified!" was a red
alert. `/verify-teacher` already avoided this by going to `/login`. The shared page now does the
same when there is no session and keeps the server-named home when there is one.

Files: `src/app/verify-email/page.tsx`, `tests/auth/registration-handoff.test.ts` (new, 5),
`tests/academy/workspace-api-contract.test.ts` (expectation updated).

## Validation at this head

| Gate | Result |
| --- | --- |
| Full test suite | **1757 passed, 0 failed, 0 skipped** |
| TypeScript (`tsc --noEmit`) | clean |
| Production build (`next build`) | exit 0 |
| `git diff --check` | clean |
| Files staged | explicitly, per commit; never `git add .` |
| Stash | untouched (1 entry, pre-existing) |

## What was deliberately NOT changed

Legacy retirements stay retired. No production variable, no Firebase setting, no database write, no
migration, no content publication, no payment configuration. No role or permission policy was
touched. `.env*`, `.e2e/*` and `Siyadah_*` were never read into a commit.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
