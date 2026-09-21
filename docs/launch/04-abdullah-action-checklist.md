# WHAT ABDULLAH MUST DO BEFORE LAUNCH

Prepared 2026-09-21 against local head **70a77e2**; production runs **1de8fa2**.

Read this once before starting. Then work top to bottom: each section assumes the one before it.

**Rules that apply to every step.** Never paste a secret into a chat, a commit, an issue or a
screenshot — values live in the password manager and in Coolify only. Change one thing at a time,
validate it, and record the result in report 13. If a validation fails, roll that one thing back
(report 14) before trying anything else. Steps marked **OWNER APPROVAL REQUIRED: YES** need
Dr. Jihan's decision in writing first — she is the final authority for the Academy.

Two things are already true and worth knowing before you start:

- **Registration is closed in production right now.** `INTERNAL_API_SECRET` is unset, so both
  sign-up routes answer 503. Nobody can create an account.
- **The academy is switched off.** `ACADEMY_CORE_SCHEMA_READY` is not `true`, so every academy page
  says "not available yet". Turning it on is section A step 6 — and only after the gate passes.

---

## A. Coolify — environment

| # | Step | Detail |
| --- | --- | --- |
| **A1** | **Confirm which database the service uses** | WHO: Abdullah. WHERE: Coolify → the service → Environment. ACTION: confirm `DATABASE_URL` points at the intended production Neon branch; do not display the value. EVIDENCE: section B1 prints the endpoint id. PASS: the endpoint matches the production branch. RISK: working on the wrong database. ROLLBACK: restore the previous value. **APPROVAL: NO** |
| **A2** | **Set `INTERNAL_API_SECRET`** | ACTION: generate 32+ random bytes in the password manager, add the variable, redeploy. EVIDENCE: `curl -s -o /dev/null -w "%{http_code}" -X POST -H "content-type: application/json" -d "{}" https://ruhulqudus.com/api/signup/student`. PASS: **400**, not 503. RISK: none beyond opening sign-up. ROLLBACK: unset and redeploy; sign-up fails closed again. **APPROVAL: NO** (but do not do it before A3, or accounts can be created that cannot be verified) |
| **A3** | **Set `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`** | ACTION: use a Google App Password for the sending mailbox. EVIDENCE: a sign-up on a **synthetic** address receives the code. PASS: the code arrives, verification succeeds. RISK: a real person signs up and never gets a code. ROLLBACK: unset; sending fails closed. **APPROVAL: YES** for the sending identity |
| **A4** | **Set the three `CLOUDINARY_*` values (+ the two preset names)** | EVIDENCE: `POST /api/cloudinary/sign-upload` with `{"purpose":"teacher_cv"}` returns a signature. PASS: not 503. RISK: applicant CVs public if the presets are not authenticated. ROLLBACK: unset. **APPROVAL: YES** for authenticated delivery and retention |
| **A5** | **Confirm the Firebase variables all name one project** | ACTION: the six `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_ADMIN_KEY` must be the same project (report 07). EVIDENCE: a real sign-in returns 200. PASS: sign-in works. RISK: a mismatch fails every sign-in; a switch invalidates every existing account. ROLLBACK: restore previous values. **APPROVAL: YES** if the project changes |
| **A6** | **Turn the academy on — last** | ACTION: set `ACADEMY_CORE_SCHEMA_READY=true`, redeploy. PRECONDITION: B2 passes with no FAIL, and H is done. EVIDENCE: `/academy` lists programs (or truthfully says none are open); `/api/public/academy/catalog` returns 200. PASS: no 503. RISK: opening onto an empty or unconfigured academy. ROLLBACK: set `false`, redeploy — no data changes. **APPROVAL: YES** |
| **A7** | **Leave Whop unset for now** | `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_API_BASE_URL` stay unset until report 09's gate is recorded. PASS: checkout reports a truthful failure and nothing is charged. **APPROVAL: YES (finance)** |

---

## B. Neon — database

| # | Step | Detail |
| --- | --- | --- |
| **B1** | **Run the readiness gate, read-only** | ACTION: `node scripts/launch-readiness-check.mjs` with `DATABASE_URL` pointing at production. It runs SELECTs only and prints counts, names and booleans — never a secret or a row. EVIDENCE: paste the output into report 13. PASS: it names the expected endpoint. **APPROVAL: NO** |
| **B2** | **Close every FAIL it reports** | Expect: 51 academy tables, `profiles` (33 columns), `verification_codes` (5 columns), `uuid-ossp`, **all 12 policies set**, **an ACTIVE administrator**, and the content gates. PASS: no FAIL. RISK: opening the academy onto missing prerequisites. **APPROVAL: YES** for anything that changes data |
| **B3** | **Confirm the account tables match the verified shape** | ACTION: run section 4 of `db/recovery/checks.sql`. PASS: 33 columns, 5 columns, 4 constraints, 1 constraint, `uuid_generate_v4()`. **APPROVAL: NO** (read-only) |
| **B4** | **Take a backup branch before any write** | ACTION: Neon → branch/snapshot; record its name in report 13. PASS: the branch exists. RISK: no way back. **APPROVAL: NO** |
| **B5** | **Do not create guessed tables** | The library, dictionary, Quran and waitlist tables stay absent until a separate, approved recovery plan exists (report 15). **APPROVAL: YES** |

---

## C. Firebase

| # | Step | Detail |
| --- | --- | --- |
| **C1** | **Decide the final project** | `ruhulqudus-test` is in local config; `ruhulqudus-48d29` is hardcoded in the service worker and a preconnect. Every profile is keyed to one project's uids. EVIDENCE: written decision. **APPROVAL: YES** |
| **C2** | **Align the code with that decision** | `public/firebase-messaging-sw.js` and `src/app/layout.tsx:93` still name `48d29`; push registration goes to the wrong project until fixed. This is a code change for the engineer. **APPROVAL: YES** |
| **C3** | **Enable only the intended sign-in providers** | Today Google and Facebook buttons exist but a provider sign-in **cannot create an account** (by design, since `cc875fc`). Either accept that, or hide the buttons, or design provider onboarding. **APPROVAL: YES** |
| **C4** | **Add `ruhulqudus.com` to authorized domains** | PASS: popup sign-in works on the live domain. **APPROVAL: NO** |
| **C5** | **Confirm the administrator account is `role=admin, status=active`** | EVIDENCE: B1's administrator gate passes. RISK: nobody can administer. **APPROVAL: YES** |
| **C6** | **Keep synthetic test accounts out of production** | **APPROVAL: NO** |

---

## D. Cloudinary — see report 08 for the full checklist

Presets exist, set to **authenticated** delivery, variables set, one synthetic PDF uploaded end to
end, retention agreed. Never upload a real person's document as a test.

## E. Email — see report 08

Sending identity agreed, app password issued, variables set, a synthetic sign-up receives its code,
expiry and rate limit agreed, SPF/DKIM checked so verification mail is not filtered.

## F. Whop — see report 09

Sandbox only, webhook registered, one end-to-end sandbox purchase, the failure cases, reconciliation,
and the **financial acceptance gate** before any production key. Four code gaps should close first
(double charge, capacity race, no reconciliation surface, metadata dependency).

---

## G. Domain, deploy and monitoring

| # | Step | Detail |
| --- | --- | --- |
| **G1** | **Confirm DNS and HTTPS** | PASS: `https://ruhulqudus.com` serves with a valid certificate; http redirects to https. **APPROVAL: NO** |
| **G2** | **Deploy the release candidate** | ACTION: push and let Coolify deploy (needs approval — this release changes sign-in). EVIDENCE: Coolify shows the expected commit. PASS: the smoke in report 13 section C. ROLLBACK: redeploy `1de8fa2`. **APPROVAL: YES** |
| **G3** | **Run the post-deploy smoke immediately** | Especially step 4: sign in with a real account. RISK: Batch A changed sign-in and has never run against production. ROLLBACK: redeploy `1de8fa2`. **APPROVAL: NO** |
| **G4** | **Watch the runtime log for 5 minutes** | PASS: no `42P01`, no unhandled rejection, no 5xx on a public route. **APPROVAL: NO** |
| **G5** | **Know the restart and rollback path** | Coolify → the service → Redeploy previous. Write the steps where someone else can find them. **APPROVAL: NO** |
| **G6** | **Set up uptime and error alerting** | At minimum: an uptime check on `/` and `/academy`, and somewhere errors are visible. RISK: a silent outage. **APPROVAL: NO** |

---

## H. Academic administration — Dr. Jihan decides, Abdullah enables

| # | Step | Detail |
| --- | --- | --- |
| **H1** | **Set all 12 policies** | Report 11 lists each one, what it governs, what breaks while it is unset, and a proposed starting value. `institution.timezone` first. EVIDENCE: B1 shows no unset policy. **APPROVAL: YES — every value** |
| **H2** | **Approve and publish the minimum content** | One program, one course, one curriculum version with lessons and Lesson Sheets, one class group pinned to that version, an approved teacher assigned, sessions scheduled, an offer. **APPROVAL: YES** |
| **H3** | **Decide the two unread policies** | `attendance.requirement` and `assessment.requirements` are set but never read. Keep and wire, or remove. **APPROVAL: YES** |
| **H4** | **Walk one learner journey yourself** | Enrol a synthetic learner, open a Lesson Sheet inside its window, submit an assessment, see the result. PASS: each step works with the policies as set. **APPROVAL: NO** |

---

## I. Legal and operational

| # | Step | Detail |
| --- | --- | --- |
| **I1** | **Review `/privacy` and `/terms` against what the site actually does** | It collects name, email, WhatsApp, country, nationality, gender, languages, and applicant CVs and videos; it uses Firebase, Neon, Cloudinary, Whop and an email provider. EVIDENCE: a lawyer's sign-off for the jurisdictions served. **APPROVAL: YES** |
| **I2** | **Publish refund and cancellation rules that match Whop** | Must match what the code does (report 09). **APPROVAL: YES** |
| **I3** | **Name a support contact and who answers it** | A visitor with a payment or access problem needs a person. **APPROVAL: YES** |
| **I4** | **Decide document retention for applicant CVs and videos** | **APPROVAL: YES** |
| **I5** | **Confirm cookie practice** | Only necessary and preference cookies were found, so a consent banner is probably not required — a lawyer should confirm. **APPROVAL: YES** |
| **I6** | **Decide the public claims left standing** | The hero's "30+ years" and "100%", and the invented prices on `/subscriptions` (report 15). **APPROVAL: YES** |

---

## The shortest honest path to a controlled launch

1. B1 → B2 (know the database state).
2. A2, A3 (registration works) → verify with a synthetic sign-up.
3. H1 (policies) → A4 if teachers will apply.
4. H2 (content approved and published).
5. B1 again — everything green.
6. G2 deploy the release candidate → G3 smoke → **step 4 of report 13 section C**.
7. A6 turn the academy on.
8. Only then consider Whop sandbox (F), and real payments only behind the finance gate.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
