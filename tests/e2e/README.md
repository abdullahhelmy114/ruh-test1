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

`browser/signed-in-flows.spec.mjs` covers the learner (home on a phone, a Lesson Sheet before release fetching no content, a private note on a released sheet, submitting an attempt with no answer keys in any response, no access to administration or another learner's attempt), the teacher (teaching home, review tab, attendance and private preparation notes), the administrator (overview at 768px, creating a program at 1024px and finding it in the audit trail, policies without a class-group level, the teacher application queue and the active-only teacher picker), a pending teacher (taken to the application page, no teaching or messaging access, the legacy teacher dashboard leading there too), a teacher of another class group (no access to the first class group, its roster or attendance) and a learner of another class group (no access to its class group or Lesson Sheets). Each test skips with the names of the variables it is missing.

### The six accounts

| Account | Variable | Setup |
| --- | --- | --- |
| Admin | `E2E_ADMIN_STATE` | `profiles.role = 'admin'` |
| Teacher A | `E2E_TEACHER_STATE` | teacher account approved through `/academy/manage/teachers` (status `active`), assigned to `E2E_CLASS_GROUP_ID` |
| Teacher B | `E2E_TEACHER_B_STATE` | approved teacher assigned only to a second class group |
| Student A | `E2E_STUDENT_STATE` | active enrollment in `E2E_CLASS_GROUP_ID` |
| Student B | `E2E_STUDENT_B_STATE` | active enrollment only in the second class group |
| Pending Teacher | `E2E_PENDING_TEACHER_STATE` | signed up at `/signup/teacher`, email verified, application not yet decided |

Create teacher accounts through teacher signup and approve them in the administration, not by editing `profiles` directly, so the application, its history and the account status stay consistent. The expected decision for every pair of these accounts is pinned in `tests/academy/cross-role-scenario.test.ts`.

They cannot run yet because:

1. **Database: migrated test branch, flag not yet on.** Migrations 0001-0010 were applied on 2026-09-17 to the isolated Neon test branch `ruh-e2e-test` (see `db/migrations/README.md`), and the application's teacher-lifecycle, assignment, relationship, profile and referral SQL plans against it. The academy APIs still answer 503 until `ACADEMY_CORE_SCHEMA_READY=true` is set for the build that points at that branch. Production and historical databases must not be migrated for this. That branch has no legacy `subscriptions`, `subscription_course`, community, forum, challenge or `teacher_earnings` tables, so those legacy features cannot be exercised there.
2. **No test accounts or non-production Firebase project** approved for automated sign-in. Credentials must never be committed or pasted into chats: sign each test account in once in a headed browser, save its Playwright storage state (with IndexedDB, where Firebase keeps the session) to a file outside the repository, and set the six storage-state variables above and `E2E_ALLOWED_HOSTS`. Teacher signup also needs the non-production Cloudinary account configured for private (authenticated) uploads.
3. **No seeded academy data.** Set `E2E_CLASS_GROUP_ID`, `E2E_RELEASED_LESSON_ID`, `E2E_UNRELEASED_LESSON_ID`, `E2E_ASSIGNMENT_ID`, `E2E_SESSION_ID` and `E2E_OTHER_ATTEMPT_ID` from that database.
4. **`@playwright/test` is not a project dependency** (adding it changes `package.json` and `package-lock.json`, which was left for an explicit decision).
