# 10 — Security and privacy register

Revision under review: **70a77e2** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.
Method: a read-only investigation of the whole codebase, then an adversarial re-check of every
finding against the files (**32 findings: 24 confirmed, 8 corrected, 0 dropped**), plus my own
verification of the items below. **No intrusive testing was performed against production.**

## A. What is genuinely sound

Each of these was traced end to end and then re-checked. They are stated so the register shows
coverage, not only gaps.

| Area | Finding |
| --- | --- |
| Identity | Established only from a Firebase token or the `__session` cookie, verified by the Admin SDK, then resolved against `profiles.firebase_uid`. **No profile row ⇒ no session** (as of `cc875fc`). No route reads identity from a body, query or header claim |
| Administrative surface | **All 106** route files under `src/app/api/admin/` call `requireAdmin` or `authorizeAdminAction`. I re-ran the scan myself: no unguarded file |
| Object-level authorisation | Academy routes pass the verified user plus a path id to a service, which loads the object, derives its class group and authorises. Reading another learner's attempt, thread, annotation or report is refused by the permission layer, not by the UI |
| Student private notes | `annotation.read` and `annotation.modify` allow only the owner, **with no administrator override** (`permissions.ts:182-187` returns `deny("privacy")`). Private notes are separate from submitted work, as the blueprint requires |
| Lesson Sheet window | The one-local-week release rule is computed server-side and refuses early access (`lesson-sheet-service.ts:121`) |
| Session lifecycle | Cookie is `httpOnly`, `secure`, `sameSite=lax`, 14 days; sign-out deletes it **and** revokes Firebase refresh tokens |
| Whop webhook | Fails closed without a secret; verifies the Standard Webhooks HMAC over the **raw** body with a timestamp tolerance; the event row and its effects commit in one transaction, so a replay reads back as a duplicate |
| SQL | No interpolated **value** anywhere: the legacy surface uses Neon tagged templates, the academy uses a parameterised query builder. One interpolated **identifier** exists (`curriculum-repo.ts:102`), narrowed by the line above it to `academy_units` or `academy_lessons` — bounded and safe |
| Secrets | No server secret reaches the browser bundle: every `'use client'` file reads only `NEXT_PUBLIC_*`. Failures report variable **names**, never values |
| Upload signing | The browser names only a purpose; the server chooses folder, formats, public id and preset, so a caller cannot redirect or widen an upload |

## B. Defects, with the fix and why it was not applied here

**1. Sign-out does not reach a Bearer token. (SECURITY DEFECT, P2 — verified myself.)**
`src/lib/auth/index.ts:38` calls `verifyIdToken(token)` **without** `checkRevoked`, while the cookie
path deliberately passes `true`. After sign-out, an already-issued ID token keeps authenticating
through the `Authorization` header until it expires (up to an hour).
*Fix:* `verifyIdToken(token, true)`. *Why not here:* that adds a Firebase round trip to every
authenticated API call. The latency and quota cost is an operational decision — **report 15**.

**2. The rate-limit key trusts a header the caller controls. (SECURITY DEFECT, P2 — verified myself.)**
`clientKey` (`src/lib/security/rate-limit.ts:127-136`) takes the **first** entry of
`x-forwarded-for`, which is the end of the chain a client can write. Its own comment says the value
comes from "the Railway edge proxy", but this deployment runs on **Coolify**. If the proxy appends
rather than replaces, an attacker rotates that header and walks past every per-IP limit: sign-up,
OTP resend, contact and the site assistant.
*Fix:* derive the client from the trusted hop (the last entry the proxy added, or a configured hop
count). *Why not here:* the correct index depends on the actual proxy chain; guessing could disable
the limit or lock out shared-IP users. Confirm the Coolify/Traefik behaviour first — **report 15**.

**3. No human-verification control on account creation. (P2.)** Neither sign-up route calls a
captcha helper, so account creation is limited only by the per-IP limiter above — which finding 2
weakens. Not reachable today (both routes 503 without `INTERNAL_API_SECRET`), but it becomes live
the moment that secret is set.

**4. An authenticated local-disk upload has no quota, and its route has no caller. (P2.)**
`POST /api/upload` accepts uploads from any signed-in session with no size quota or rate limit, and
**nothing in the application calls it** (its helper `src/lib/upload-file.ts` is imported nowhere).
Retiring it is cheaper and safer than adding a quota — **report 15**.

**5. `'unsafe-inline'` in `script-src`. (P2.)** The CSP permits inline script, which weakens it
against injection. Removing it needs a nonce or hash strategy across the app: a real change, not a
one-liner.

**6. Academy workspace pages carry no server-side gate. (P3.)** The workspace layout renders and the
**APIs** refuse — which is the right place to refuse — so nothing leaks; a signed-out visitor sees
the shell with a sign-in prompt. Worth a server gate later for a cleaner first paint.

**7. Error logging includes whole caught error objects. (P3.)** `withApi` logs the caught error on a
500, which can include provider text. Client responses stay generic; this is a log-retention concern.

**8. Firebase project consistency. (P3 here, P1 in report 07.)** Client and Admin values are checked
for presence, not for naming the same project. A mismatch fails every sign-in at runtime.

**9. Legacy remnants. (P3.)** The Zoom recording pipeline depends on the retired `lessons` table and
cannot run; four of the nine retired endpoints still import modules (the containment holds because
they return 410 before doing anything, but the "no imports at all" property claimed in code comments
is not true for all of them).

## C. Privacy

- **Student data isolation:** every academy read is scoped by class-group membership or ownership.
- **Private notes:** owner-only, no override — verified.
- **Applicant documents:** CVs and videos are uploaded under server-chosen, authenticated paths and
  opened through short-lived signed links. **Retention and who may read them is unanswered** — report 15.
- **Cookies:** three are set — `__session` (httpOnly, necessary), the locale preference, and the
  theme. All are necessary or preference cookies; no analytics or advertising cookie was found, so a
  consent banner is likely not required. **A lawyer should confirm** for the jurisdictions served.
- **Personal data in logs:** identity is not deliberately logged; see defect 7.

## D. Local testing never touched production

Every local run used the isolated test branch (`ep-flat-bird-aqs91ul8`), and the readiness script
prints the endpoint it inspected so the target is visible before any result is trusted. Production
was only ever read over anonymous HTTP. No student, child or real personal data was used anywhere:
the synthetic identities are `.e2e` accounts in the test Firebase project.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
