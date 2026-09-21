# 07 — Firebase and authentication readiness

Revision under review: **8908c57** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.
No Firebase project, provider, account or role was changed while preparing this report.

## 1. How identity works here

**VERIFIED OBSERVATION** — traced end to end:

1. The browser signs in with Firebase (email/password, or a Google/Facebook popup).
2. It posts the Firebase ID token to `POST /api/auth/session`.
3. The server verifies the token with the Firebase Admin SDK, **looks up `profiles.firebase_uid`**,
   and only then mints a 14-day session cookie (`httpOnly`, `secure`, `sameSite=lax`, `path=/`).
4. Every request afterwards resolves the caller from the cookie **and the profile row**
   (`src/lib/auth/core.ts:197-244`). No row ⇒ `getSession()` returns null ⇒ 401.
5. Sign-out deletes the cookie **and** revokes the Firebase refresh tokens
   (`src/app/api/auth/session/route.ts` DELETE).

Privileges come from two profile columns, `role` and `status`. A teacher whose status is not
`active` resolves to the session role `applicant` (`sessionRoleFor`, `core.ts:62`).

## 2. The defect that was fixed in this batch

**FIXED LOCALLY — commit `cc875fc`.** Profiles are created by the sign-up routes only. Any other way
of completing a Firebase sign-in — a Google or Facebook popup, an account created in the Firebase
console, or one whose profile was removed — left a verified identity with **no profile row**. The
exchange answered that caller with a 14-day cookie and the invented role `student`, and the login
page redirected without checking `res.ok`. The server then refused every request. The browser looked
signed in and nothing worked.

Now the profile decides before any cookie exists: no row ⇒ **401 `{"error":"no_account"}` and no
`Set-Cookie`**; the login page ends the Firebase session too and tells the visitor to create an
account. Roles are reported exactly as stored — nobody is promoted by signing in.

**Not decided here, and needed from the owner:** whether a provider sign-in should be able to
*create* an account. Sign-up collects country, nationality, gender, languages, WhatsApp and a
referral code, and runs an email verification step that a popup cannot supply. Until that is
decided, provider sign-in works only for an identity that already registered. The alternative is to
hide the provider buttons. See report 15.

## 3. Project consistency — an open decision

| Where | Project |
| --- | --- |
| Local `.env` (client and admin key agree) | `ruhulqudus-test` |
| Hardcoded in `src/app/layout.tsx:93` (preconnect) | `ruhulqudus-48d29` |
| Hardcoded in `public/firebase-messaging-sw.js` (full config incl. a web API key) | `Ruh-Ul-Qudus-48d29` |
| Coolify runtime | reported as `ruhulqudus-test` — **UNVERIFIED from here** |

**INFERENCE** — `ruhulqudus-48d29` is the original production project. The service worker therefore
registers push against a **different project** than the one the application authenticates with,
so web push cannot work as configured; the preconnect is merely stale.

A `firebase_uid` is only meaningful inside the project that minted it. Every profile row is keyed to
one project, so **switching the Firebase project invalidates every existing account**. That decision
belongs to the owner (report 15).

## 4. Checklist before launch

| # | Action | Who | Evidence of PASS | Risk if skipped | Approval |
| --- | --- | --- | --- | --- | --- |
| 1 | Decide the final Firebase project | Dr. Jihan with Abdullah | Written decision in report 15 | Accounts keyed to the wrong project stop working | **yes** |
| 2 | Make the client variables and `FIREBASE_ADMIN_KEY` name that one project | Abdullah (Coolify) | `readiness-check` reports both set; a real sign-in returns 200 | Admin/client mismatch ⇒ every sign-in fails | no |
| 3 | Align `public/firebase-messaging-sw.js` and the layout preconnect with that project | Engineer (code) | Push registration succeeds | Push silently registers to the wrong project | **yes** (code change) |
| 4 | Enable exactly the intended providers | Abdullah (Firebase console) | Provider list screenshot in the launch record | A provider popup that cannot create an account confuses visitors | **yes** |
| 5 | Add `ruhulqudus.com` to authorized domains | Abdullah | Sign-in works on the live domain | Popup sign-in fails in production only | no |
| 6 | Confirm an **active** administrator profile exists | Abdullah | `readiness-check` gate "An active administrator exists" passes | Nobody can administer; every admin API answers 403 | **yes** (role change) |
| 7 | Keep synthetic test accounts in the test project only | Engineer | `.e2e/storage/*` unchanged | Test identities in production data | no |

## 5. Test accounts and what was actually exercised

**VERIFIED OBSERVATION** — against a local production build on the isolated test branch:

- student and active teacher: sessions valid, `/api/user` 200, journeys reach `/academy/learn` and
  `/academy/teach` — **ISOLATED INTEGRATION PASS**;
- administrator: the stored session cookie is **rejected (401)**, so the admin browser journey is
  **NOT TESTED**. The cause is the stored credential, not this batch: the profile row exists, and
  student and teacher cookies minted the same way still work. Re-minting needs an interactive sign-in
  with that account's password, which is not in this session and must not be pasted into chat;
- an invalid token: `POST /api/auth/session` answers **401 with no `Set-Cookie`** — **ISOLATED
  INTEGRATION PASS**;
- the no-profile refusal: covered by unit tests (**LOCAL PASS**) but **NOT TESTED** end to end,
  because it needs a Firebase identity with no profile, and creating one is a Firebase write that
  this task is not authorised to make.

## 6. Lifecycle cases and where they stand

| Case | Behaviour | Evidence |
| --- | --- | --- |
| Existing student | session established, lands on `/academy/learn` | LOCAL PASS + ISOLATED INTEGRATION PASS |
| Active teacher | lands on `/academy/teach` | LOCAL PASS + ISOLATED INTEGRATION PASS |
| Pending / rejected / withdrawn / inactive teacher | session established, lands on the application page, session role `applicant` | LOCAL PASS (unit) |
| Administrator | lands on `/academy/manage` | LOCAL PASS (unit); browser NOT TESTED |
| No profile row | **401, no cookie**, Firebase session ended in the browser | LOCAL PASS |
| Invalid token | 401, no cookie | ISOLATED INTEGRATION PASS |
| Expired session cookie | Firebase rejects it, request is unauthenticated | INFERENCE from `verifySessionCookie(cookie, true)`; NOT TESTED |
| Deleted or disabled Firebase user | verification fails ⇒ 401; a revoked refresh token also fails ⇒ this is what the stale admin credential demonstrates | VERIFIED OBSERVATION |
| Role mismatch (row says student, caller asks for admin) | server authorises from the row, not the request; admin APIs answer 403 | VERIFIED OBSERVATION (106/106 admin route files carry a guard) |
| Provider sign-in for a registered identity | works | LOCAL PASS |
| Provider sign-in for a new identity | refused with a clear message; **no account is created** | LOCAL PASS; product decision pending |

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
