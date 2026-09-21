# 12 — Test evidence

Revision under test: **70a77e2** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.

Every claim below carries its evidence level. The levels are not interchangeable, and a local pass
says nothing about production.

- **LOCAL PASS** — ran on this machine against the repository (unit, contract, static analysis).
- **ISOLATED INTEGRATION PASS** — ran against a local production build on the **isolated test
  branch** with synthetic accounts.
- **PRODUCTION READ-ONLY VERIFIED** — measured against the deployed site with anonymous requests.
- **PRODUCTION AUTHENTICATED VERIFIED** — none of this exists yet.
- **NOT TESTED** — say so plainly.

## A. Automated suite — LOCAL PASS

| Gate | Result |
| --- | --- |
| Full test suite (`node --test`, every `tests/**/*.test.ts`) | **1763 passed, 0 failed, 0 skipped** |
| TypeScript `tsc --noEmit` | clean |
| Production build `next build` | exit 0 |
| `git diff --check` | clean |

**No test was skipped, and none was counted as passed because it could not reach an environment.**

Tests added in this work (all LOCAL PASS):

| File | Tests | Covers |
| --- | --- | --- |
| `tests/auth/session-exchange.test.ts` | 13 | student, active teacher, every other teacher status, administrator, **absent profile**, a row with no role, an unknown role (never promoted); the route reads and judges the row before any cookie, answers 401 with no cookie, invents no default and logs nothing; the login page uses one exchange for both paths, signs out on refusal and never navigates on refusal |
| `tests/academy/launch-readiness-check.test.ts` | 7 | the gate is read-only, prints no value or account column, takes its table list from the migrations and its policy list from the registry, covers every prerequisite and configuration name, and exits non-zero on failure |
| `tests/security/truthful-public-claims.test.ts` | 6 | no discount claim, no fabricated confirmation, no form that stores nothing, no invented testimonial or rating; no page ships a `href="#"` call to action; the placement test states its real status in three languages |
| `tests/auth/registration-handoff.test.ts` | 5 | sign-up does not sign the browser in; a verified browser with no session is sent to sign in; one with a session keeps the account home; the teacher branch is unchanged; success is shown before either redirect |
| `tests/academy/site-metadata-and-a11y.test.ts` | 6 | no locale path advertised and none exists; no inherited canonical while per-page ones survive; the skip link precedes the header, targets a focusable main, shows a focus ring, and is translated |
| `tests/academy/unavailable-repairs.test.ts` | 5 | every embedded YouTube host is CSP-allowed; no dead footer anchor; the library never calls a failure an empty library |

## B. Failure scenarios that were actually exercised

| Scenario | Level | Result |
| --- | --- | --- |
| Missing configuration — `INTERNAL_API_SECRET` unset | PRODUCTION READ-ONLY VERIFIED | Both sign-up routes answer 503 **before any side effect**; no Firebase account or profile is created |
| Missing configuration — Cloudinary unset | PRODUCTION READ-ONLY VERIFIED | `sign-upload` answers 503; the teacher application cannot proceed, and says so |
| Missing configuration — academy flag unset | PRODUCTION READ-ONLY VERIFIED | Every academy service answers 503 and `/academy` renders a visible notice, not a crash |
| Missing data — no policies set | LOCAL PASS + ISOLATED | Services fail closed with `POLICY_UNCONFIGURED`; the readiness gate names the unset keys |
| Missing data — empty catalogue | LOCAL PASS | `/academy` says "No courses are open yet", distinct from "not available yet" |
| Invalid permissions — no profile for a verified identity | LOCAL PASS | 401, no cookie, Firebase session ended |
| Invalid token | ISOLATED INTEGRATION PASS | `POST /api/auth/session` answers 401 **with no `Set-Cookie`** |
| Expired/revoked session | ISOLATED INTEGRATION PASS (accidental, and instructive) | The stored administrator cookie is refused with 401 while student and teacher cookies work — a revoked credential behaves exactly as it should |
| Missing table — library, dictionary, Quran | PRODUCTION READ-ONLY VERIFIED | Those APIs answer 500; the library page now reports a failure instead of "No books found" |
| Denied early access to a Lesson Sheet | LOCAL PASS | The release rule refuses and names the opening date |

## C. Browser evidence — ISOLATED INTEGRATION

Against a local production build on the isolated test branch, with synthetic `.e2e` accounts:

- **39 of 42 role-navigation checks passed.** Anonymous, student and active teacher journeys all
  pass: the retired routes redirect, the navigation reads the academy APIs, no legacy API is called
  and no API answers 5xx.
- **3 failed, all administrator**, because that stored session cookie is refused (above). The
  administrator browser journey is therefore **NOT TESTED**. Re-minting it needs an interactive
  sign-in with that account's password, which is not in this session and must not be pasted into
  chat. The test branch's admin profile is also `pending`, so it should be made `active` in the test
  branch before that journey can be exercised.

The Playwright MCP server failed to connect this session (`CONNECT_TIMEOUT`), so browser runs used
the local Playwright runtime directly. The repository's own browser specs (90 checks across phone,
tablet and desktop) were **not re-run after Batch G** and are **NOT TESTED** at this head.

## D. What was not tested, and why

| Area | Why |
| --- | --- |
| Sign-up end to end | Needs `INTERNAL_API_SECRET` and email configured; creating accounts in production is not authorised |
| Email delivery, OTP receipt | Same |
| Teacher application with a CV upload | Needs Cloudinary configured |
| Whop checkout, webhook, entitlement, refund | Needs sandbox credentials; **no purchase was executed** (report 09) |
| Administrator journeys in a browser | Stored credential refused; see above |
| The no-profile refusal end to end | Needs a Firebase identity with no profile; creating one is a Firebase write this task may not make |
| Accessibility with a real screen reader | Static review only; contrast failures were computed from the tokens, not measured in a browser |
| Production authenticated anything | No production credential exists in this session, by design |

## E. Regression risk accepted

Batch A changed the sign-in path for every account. It is covered by 13 unit tests and one isolated
integration check (invalid token ⇒ 401, no cookie), and student and teacher journeys still pass in a
browser. It has **not** been exercised against production. That is the largest single risk in this
release candidate and is why report 13 asks for an authenticated smoke immediately after deploy.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
