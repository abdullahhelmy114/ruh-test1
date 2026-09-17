# End-to-end tests

Two layers, both kept out of the unit run (`node --test` over `tests/**/*.test.ts`).

| Layer | Files | Needs | Status |
| --- | --- | --- | --- |
| HTTP smoke | `http-smoke.e2e.ts` | a running build | Runnable anywhere; executed 2026-09-17 against a local production build: 14/14 passed |
| Browser, public and signed-out | `browser/public-and-signed-out.spec.mjs` | a running build, `@playwright/test` and a browser | Same flows executed 2026-09-17 through a Playwright-driven browser against a local build (see below) |
| Browser, signed in | `browser/signed-in-flows.spec.mjs` | a migrated development database, non-production Firebase, test accounts, seeded data | Blocked (see below) |

## Running a local build safely

Use an unreachable local database address so nothing touches a real database, and keep the academy schema flag off unless the build points at a migrated development database:

```sh
DATABASE_URL=postgresql://e2e:e2e@127.0.0.1:9/e2e ACADEMY_CORE_SCHEMA_READY=false npx next build
DATABASE_URL=postgresql://e2e:e2e@127.0.0.1:9/e2e ACADEMY_CORE_SCHEMA_READY=false npx next start -p 3100
```

Use `localhost` in URLs: the proxy redirects other plain-HTTP hosts to HTTPS.

## HTTP smoke

```sh
E2E_BASE_URL=http://localhost:3100 node --test tests/e2e/http-smoke.e2e.ts
```

It checks security headers; public academy pages in English, Arabic (right to left) and Turkish; every signed-out workspace screen (no data, not indexed); every method of every API route that is not deliberately public (`tests/security/public-api-routes.ts`) with no credentials, forged `x-user-id`/`x-user-role`/`x-forwarded-for` headers, a forged bearer token and a forged session cookie, while identity is also claimed in the query and body (academy routes must answer the standard 401); removed endpoints (410); public routes never returning internal error text; the sign-in exchange rejecting forged tokens; public academy API contracts (read only, safe errors, per-client rate limiting); and the legacy messaging endpoints. Only non-JWT forged tokens are sent, so verification fails locally and no provider is contacted.

Its first run found three open routes and several routes returning raw error text; they were fixed in the same pass.

## Browser specs

```sh
npm i -D @playwright/test && npx playwright install chromium   # not yet a project dependency
E2E_BASE_URL=http://localhost:3100 npx playwright test -c tests/e2e/playwright.config.mjs
```

Projects run each spec at 390px (phone), 768px (tablet) and 1280px (desktop). The shared fixture aborts every request to a host other than the site under test, except hosts listed in `E2E_ALLOWED_HOSTS`.

Executed on 2026-09-17 through the Playwright MCP browser against the local build (external requests blocked; none were attempted): 48 page checks (catalog, program, course, certificate verification, learner, teacher and administration homes and a class group, in English and Arabic at 390, 768 and 1280px) with the expected text, `dir`, and no horizontal scrolling; certificate verification submitted as a plain form with the outcome in the live region; the workspace skip link moving focus to the content; dark mode changing background and text through theme tokens; and the "Academy" entry in the desktop "More" menu and the phone menu. It also found a footer link to a page that does not exist (`/live-classes`), now fixed and covered by a unit test.

## Blocked: signed-in flows

`browser/signed-in-flows.spec.mjs` covers the learner (home on a phone, a Lesson Sheet before release fetching no content, a private note on a released sheet, submitting an attempt with no answer keys in any response, no access to administration or another learner's attempt), the teacher (teaching home, review tab, attendance and private preparation notes) and the administrator (overview at 768px, creating a program at 1024px and finding it in the audit trail, policies without a class-group level). Each test skips with the names of the variables it is missing.

They cannot run yet because:

1. **No authorised non-production database.** Migrations 0001-0009 have not been applied anywhere; the academy APIs answer 503 until `ACADEMY_CORE_SCHEMA_READY=true` on a migrated database. Production and historical databases must not be migrated for this.
2. **No test accounts or non-production Firebase project** approved for automated sign-in. Credentials must never be committed or pasted into chats: sign each test account in once in a headed browser, save its Playwright storage state (with IndexedDB, where Firebase keeps the session) to a file outside the repository, and set `E2E_STUDENT_STATE`, `E2E_TEACHER_STATE`, `E2E_ADMIN_STATE` and `E2E_ALLOWED_HOSTS`.
3. **No seeded academy data.** Set `E2E_CLASS_GROUP_ID`, `E2E_RELEASED_LESSON_ID`, `E2E_UNRELEASED_LESSON_ID`, `E2E_ASSIGNMENT_ID`, `E2E_SESSION_ID` and `E2E_OTHER_ATTEMPT_ID` from that database.
4. **`@playwright/test` is not a project dependency** (adding it changes `package.json` and `package-lock.json`, which was left for an explicit decision).
