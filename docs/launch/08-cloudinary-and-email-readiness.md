# 08 — Cloudinary and email readiness

Revision under review: **8908c57** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.
No provider account, preset or credential was changed. No secret appears here.

## A. Cloudinary — teacher application uploads

### Current state

**VERIFIED OBSERVATION** — `POST /api/cloudinary/sign-upload` with `{"purpose":"teacher_cv"}` answers
**503 `Upload service unavailable`** on the deployed revision. The three `CLOUDINARY_*` values are
unset, so the route fails closed before contacting the provider.

**FACT** — a teacher application **requires** a CV: `src/app/api/signup/teacher/route.ts:85-86`
refuses the submission without a verified upload reference. So teacher registration is blocked by
this alone, independently of `INTERNAL_API_SECRET` and of the academy flag.

### How the flow is built (and why it is sound)

**VERIFIED OBSERVATION** — the browser never holds an upload credential:

1. The applicant's browser asks this route for a signature, naming only a **purpose**
   (`teacher_cv` or `teacher_intro_video`). Anything else in the body is ignored.
2. The **server** chooses every signed parameter: timestamp, folder, `allowed_formats`, `public_id`,
   `overwrite`, and the upload preset. A caller cannot redirect the upload, change the folder, widen
   the formats, or overwrite someone else's asset.
3. The browser uploads straight to Cloudinary with that short-lived signature.
4. Sign-up verifies the returned reference before it is stored
   (`verifyUploadReference`, signed with `INTERNAL_API_SECRET`), so a fabricated reference is refused.
5. Documents are private: the CSP allows `api.cloudinary.com` for the upload only, not the delivery
   host, and applications are opened through short-lived signed links.

Limits are enforced server-side: PDF for CVs, mp4/mov/webm for videos, with per-purpose size caps,
and a shared limiter of 10 signatures per 15 minutes per client.

### Checklist

| # | Action | Who | Evidence of PASS | Risk | Approval |
| --- | --- | --- | --- | --- | --- |
| 1 | Create/confirm the Cloudinary account and the two upload presets | Abdullah | Preset names match `CLOUDINARY_TEACHER_CV_PRESET` / `..._VIDEO_PRESET` | Uploads rejected by the provider | no |
| 2 | Set presets to **authenticated** delivery, not public | Abdullah | A delivery URL without a signature is refused | Applicant CVs readable by anyone with the URL | **yes** (privacy) |
| 3 | Set the three `CLOUDINARY_*` values in Coolify, redeploy | Abdullah | `sign-upload` with `{"purpose":"teacher_cv"}` returns a signature, not 503 | Teacher sign-up stays blocked | no |
| 4 | Upload one synthetic PDF end to end | Engineer | The asset lands in the expected folder; the application submits | Broken flow found by a real applicant | no |
| 5 | Confirm retention and who may read applicant documents | Dr. Jihan | Written answer in report 15 | Personal documents kept longer than intended | **yes** |

Use a synthetic CV. Never upload a real person's document as a test.

## B. Email — verification codes

### Current state

**FACT** — sending fails closed: `src/lib/email.ts:106` refuses to send unless `EMAIL_USER`,
`EMAIL_PASS` and `EMAIL_FROM` are all present. `EMAIL_PASS` must be a Google **App Password**, and
Gmail only accepts a `From` matching the authenticated account.

**VERIFIED OBSERVATION** — email delivery in production is **NOT TESTED**: triggering a real send
requires creating an account, which this task is not authorised to do.

### The sequence a code goes through

1. Sign-up creates the Firebase user, inserts the profile, then deletes any existing code row and
   inserts a fresh one — an HMAC **digest** of the code (`INTERNAL_API_SECRET`), never the code
   itself — with an expiry.
2. The email carries the plain code; the database holds only the digest.
3. `/api/verify-email-code` compares the digest, marks the profile verified, and deletes the row.
4. `/api/send-verification-code` deletes and re-inserts, so one live code exists per account.

**Ordering risk (FACT):** the code row is written *before* the email is sent, and the send is outside
the compensation that deletes the Firebase user if the profile insert fails. If email is
misconfigured, sign-up answers 500 **after** creating the account, leaving it unverified with no code
delivered. The person can recover with "resend", but only once `EMAIL_*` is configured. Configure
email **before** opening sign-up to the public.

### Checklist

| # | Action | Who | Evidence of PASS | Risk | Approval |
| --- | --- | --- | --- | --- | --- |
| 1 | Decide the sending identity (`EMAIL_FROM`) | Dr. Jihan | Written decision | Mail from an unexpected address | **yes** |
| 2 | Issue a Google App Password for that mailbox | Abdullah | Value stored in the password manager only | — | no |
| 3 | Set `EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM`, redeploy | Abdullah | A synthetic sign-up receives the code | Accounts created but unverifiable | no |
| 4 | Confirm the code expiry and the rate limit are acceptable | Dr. Jihan | Written confirmation | Codes too short-lived or too easy to request | **yes** |
| 5 | Check deliverability (SPF/DKIM for the domain) | Abdullah | A test message reaches an inbox, not spam | Verification mail silently lost | no |
| 6 | Confirm behaviour when the provider is down | Engineer | Sign-up reports a truthful failure and the account can resend | Silent dead end | no |

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
