# 05 — Environment configuration matrix

Revision under review: **8908c57** (local) on top of **1de8fa2** (deployed).
Prepared: 2026-09-21. Status: **PROPOSAL / PENDING APPROVAL** for every production change.

No value of any variable appears in this file, and none may be pasted into a chat, a commit or an
issue. Every value is set in the Coolify environment editor for the service, by Abdullah.

Legend: **FACT** measured or read; **VERIFIED OBSERVATION** traced end to end; **INFERENCE** reasoned.

## What production is missing today

**VERIFIED OBSERVATION** — measured against the deployed revision on 2026-09-20/21 with anonymous
HTTP probes (no account, payment or write):

| Probe | Result | What it proves |
| --- | --- | --- |
| `GET /api/public/academy/catalog` | 503 `This part of the academy is not available yet.` | `ACADEMY_CORE_SCHEMA_READY` is not `true` |
| `POST /api/signup/student` (empty body) | 503 `Verification service unavailable` | `INTERNAL_API_SECRET` is unset |
| `POST /api/signup/teacher` (empty body) | 503 `Verification service unavailable` | same secret, both sign-up paths |
| `POST /api/cloudinary/sign-upload` `{"purpose":"teacher_cv"}` | 503 `Upload service unavailable` | the `CLOUDINARY_*` trio is unset |
| `GET /api/teacher/public/<unknown-uid>` | 404 `Teacher not found` | `profiles` exists and the query ran |

An empty-body POST reaches only the configuration check; it creates nothing. The sign-up check runs
**before** any side effect, so a blocked attempt leaves no Firebase account and no profile row.

## The matrix

`Secret?` — **yes** means it must never be printed, committed or shown in a screenshot.
`Public?` — `NEXT_PUBLIC_*` values are compiled into the browser bundle and are not secrets.
`Redeploy?` — whether Coolify must rebuild/restart for the change to take effect.

| Variable | Enables | Value comes from | Secret | Redeploy | Prerequisite | Validation (PASS) | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ACADEMY_CORE_SCHEMA_READY` | The entire academy: all 22 services. Unset ⇒ every academy route 503 | Set to the literal `true` once the gate below passes | no | yes | `node scripts/launch-readiness-check.mjs` reports no FAIL | `/academy` lists programs, or says "No courses are open yet"; `/api/public/academy/catalog` returns 200 | set it back to `false`; the academy closes again, no data changes |
| `INTERNAL_API_SECRET` | Sign-up and email verification codes (OTP hashing), internal job endpoints | Generate a random 32+ byte value in a password manager | **yes** | yes | none | `POST /api/signup/student` with `{}` answers **400**, not 503 | unset it; sign-up fails closed again |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | Verification email delivery; `EMAIL_PASS` is a Google App Password, not the account password | The sending Google account | **yes** (PASS) | yes | Sender mailbox exists; app password issued | A test sign-up on a disposable address receives the code | unset; sending fails closed with a logged reason |
| `FIREBASE_ADMIN_KEY` | Server-side token and session verification | Firebase console → service account JSON, pasted as one line | **yes** | yes | Same project as the client variables | `POST /api/auth/session` with a real token returns 200 | restore the previous value |
| `NEXT_PUBLIC_FIREBASE_*` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) | Browser sign-in | Firebase console → web app config | no | yes | Project decided (see report 07) | The sign-in popup completes | restore previous values |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Web push registration | Firebase console → Cloud Messaging | no | yes | Messaging enabled | The bell can be enabled without an error | unset; push registration stops being offered |
| `NEXT_PUBLIC_SITE_URL` | The address Whop returns the buyer to; must be `https://ruhulqudus.com` | Known | no | yes | HTTPS live | Checkout returns to the site, not localhost | restore |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Teacher CV and introduction video upload — **a teacher application cannot be submitted without them** | Cloudinary console | **yes** (API secret) | yes | Account and upload presets exist | `POST /api/cloudinary/sign-upload` `{"purpose":"teacher_cv"}` returns a signature, not 503 | unset; teacher sign-up fails closed |
| `CLOUDINARY_TEACHER_CV_PRESET`, `CLOUDINARY_TEACHER_VIDEO_PRESET` | The named upload presets used for each purpose | Cloudinary console | no | yes | Presets configured for authenticated delivery | A CV upload lands in the expected folder | restore |
| `WHOP_API_KEY` | Checkout creation. Unset ⇒ `not_configured`, the Buy button reports a truthful failure | Whop dashboard (**sandbox** first) | **yes** | yes | Offers exist; finance approval for production | A sandbox checkout opens | unset; payments close, nothing is charged |
| `WHOP_WEBHOOK_SECRET` | Webhook signature verification. Unset ⇒ the webhook refuses every call with 500 | Whop dashboard, per endpoint | **yes** | yes | Webhook endpoint registered | A sandbox test event is accepted once and the replay is recorded as a duplicate | unset; webhooks are refused, no entitlement changes |
| `WHOP_API_BASE_URL` | Chooses sandbox or production. Unset ⇒ **sandbox** | `https://sandbox-api.whop.com/api/v1` until finance approval | no | yes | Explicit financial acceptance gate (report 09) | The value matches the intended environment | set back to the sandbox base |
| `DATABASE_URL` | Everything | Neon → the production branch | **yes** | yes | Schema verified (report 06) | `scripts/launch-readiness-check.mjs` names the expected endpoint | restore the previous value |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `GROQ_API_KEY` | The site assistant and authoring helpers | Provider dashboards | **yes** (keys) | yes | none | The assistant answers instead of 502 | unset; the assistant reports a truthful failure |
| `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Bot protection where used | Google reCAPTCHA console | **yes** (secret) | yes | none | The guarded form still submits | unset |
| `ZOOM_*`, `YOUTUBE_*`, `GOOGLE_*`, `PUSHER_*`, `SHOPIER_*` | Legacy or not on the launch path | — | **yes** | — | — | — | leave unset |

**INFERENCE** — the academy's own sessions store a `meeting_url` entered by staff
(`src/lib/academy/repo/delivery-repo.ts:193`), so Zoom API credentials are **not** required for the
academy launch path; the `ZOOM_*` values belong to the retired legacy lesson flow.

## Safe procedure for setting a value

1. Abdullah opens Coolify → the Ruh-Ul-Qudus service → Environment variables.
2. He adds or edits **one** variable, pastes the value from the password manager, and saves.
3. He redeploys the service (all of these are read at build or boot).
4. He runs the matching validation above and records the result in report 13.
5. If the validation fails, he restores the previous value and redeploys again.

Never: paste a value into this chat, a commit, an issue or a screenshot. Never read a value back out
of Coolify into a document. If a secret is exposed, rotate it at the provider first, then update
Coolify.

## Order that avoids half-open states

1. `DATABASE_URL` verified (report 06) → 2. `INTERNAL_API_SECRET` and the `EMAIL_*` trio (sign-up
works) → 3. `CLOUDINARY_*` (teacher applications work) → 4. policies and content (reports 06 and 11)
→ 5. `ACADEMY_CORE_SCHEMA_READY=true` (the academy opens on something that works) → 6. Whop sandbox
→ 7. Whop production, only behind the financial acceptance gate in report 09.

Opening the academy flag before step 4 shows visitors an empty catalogue and an administrator a
screen of unconfigured settings; it breaks nothing, but it is a poor first impression.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
