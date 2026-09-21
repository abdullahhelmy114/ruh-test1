# 01 — Launch readiness dashboard

Prepared 2026-09-21. Local head **70a77e2** (6 commits, **not pushed**). Production runs **1de8fa2**.

Two assessments, kept apart on purpose. A product can be technically sound and operationally unready,
and the reverse. There is no combined percentage, because a single number would hide which one is
blocking.

---

## A. Technical release-candidate readiness — **READY FOR ISOLATED TESTING**

Not "ready for approved deployment", because the change that matters most — the sign-in path — has
never run against production, and three provider integrations are unconfigured and therefore
unexercised.

**Implemented and tested (LOCAL PASS, and where stated ISOLATED INTEGRATION PASS):**

- The academy itself: catalogue, programs, courses, class groups, sessions, Lesson Sheets with the
  server-side one-week window, private annotations, assignments, attempts, grading, practice,
  remediation, recordings, certificates, messaging, announcements, teacher applications and review,
  and the whole administration surface. Every workspace API path has a caller and every page path has
  a link; all **106** admin route files carry a guard.
- Identity: a verified Firebase identity with **no profile row now gets no session** (`cc875fc`).
- The registration hand-off no longer answers a learner's first success with an error (`fe50526`).
- Public pages say only what the product can honour (`8908c57`).
- The site advertises only addresses that exist, and a keyboard can skip to content (`70a77e2`).
- An activation gate that proves the academy's prerequisites before the flag is opened (`a0ed893`).

**Gates:** full suite **1763 passed, 0 failed, 0 skipped**; TypeScript clean; production build exit 0;
`git diff --check` clean.

**Still blocked, technically:**

| Blocker | Nature | Report |
| --- | --- | --- |
| `INTERNAL_API_SECRET` unset — **nobody can register** | configuration | 05, 04 A2 |
| `EMAIL_*` unset — no verification code can be delivered | configuration | 08 |
| `CLOUDINARY_*` unset — no teacher application can upload its CV | configuration | 08 |
| `ACADEMY_CORE_SCHEMA_READY` not `true` — every academy service 503 | configuration | 05, 04 A6 |
| 12 policies unset — the academy is unusable even with the flag on | required data | 11 |
| Whop: four code gaps, then sandbox, then a finance gate | incomplete + owner | 09 |
| Two security defects: revocation on the Bearer path, and a spoofable rate-limit key | needs an operational decision | 10 |
| Library, dictionary, Quran APIs 500 | missing schema and data | 15 (2.2) |

**Evidence missing:** production authenticated anything; email delivery; a Cloudinary upload; any
Whop transaction; administrator browser journeys (the stored test credential is refused); the
repository browser specs at this head.

---

## B. Operational launch readiness — **NOT YET READY**

Nothing here is an engineering failure; each item needs a person to decide or to do it.

| Question | State |
| --- | --- |
| Are approved courses published? | **No** — no program, course, curriculum version, class group or session is approved and published yet (report 11 B) |
| Are the academy's rules set? | **No** — all 12 policies are unset, and every value is an academic decision (report 11 A) |
| Is there an approved teacher assigned to a cohort? | **No** |
| Is there an administrator who can administer? | **Unverified in production**; in the test branch the only admin is `pending` |
| Are payments arranged? | **No** — sandbox unconfigured, four code gaps open, no finance acceptance |
| Is support arranged? | **No** — no named contact or owner for billing and access problems |
| Are privacy, terms and refund rules reviewed against what the site does? | **No** — not reviewed by a professional |
| Are the public claims true? | **Prepared, not published** — three fabrications replaced locally; two more await your word |

---

## Executive summary

| | |
| --- | --- |
| **Findings closed in this batch** | 6 defects fixed locally, each with tests: the session exchange, the registration hand-off, three untruthful public claims, hreflang/canonical/skip link, plus the earlier CSP, footer and library-state fixes |
| **Findings still open** | 136 in this review's register (P0 8 — all of them recorded assurances that *are* working, P1 51, P2 52, P3 25) plus the 125-finding audit of the previous revision |
| **P0 blockers to launch** | 4, all configuration: registration secret, email, the academy flag, and an active administrator |
| **P1 blockers** | the 12 policies; the minimum approved content; Cloudinary; the Whop gate; two security defects |
| **Local commits** | 6, none pushed: `e257693`, `cc875fc`, `a0ed893`, `8908c57`, `fe50526`, `70a77e2` |
| **Tests** | 1763 passed, 0 failed, **0 skipped**; 42 new tests written in this batch |
| **Build** | `next build` exit 0; TypeScript clean |
| **Outstanding configuration** | `INTERNAL_API_SECRET`, `EMAIL_*`, `CLOUDINARY_*`, `ACADEMY_CORE_SCHEMA_READY`, the Firebase project decision, Whop (later) |
| **Outstanding database decisions** | Confirm the production schema with the readiness gate; decide the legacy library/dictionary/Quran recovery; no guessed tables |
| **Outstanding academic decisions** | 12 policy values; the minimum content; certificates on or off; the two unread policies |
| **Payment status** | **PAY-04 NOT ACCEPTED** — implemented, unconfigured, never executed in any environment |
| **Human actions** | Report 04, in order; the approval requests are report 15 |
| **Approval gates** | Publishing the corrected public copy; the 12 policies; the content; the Firebase project; the two security trade-offs; the financial gate; deploying this candidate |

**Status: READY FOR HUMAN REVIEW** as a release candidate, and **READY FOR ISOLATED TESTING** as
code. It is **NOT** ready for approved deployment until report 13's post-deploy smoke can be run,
and **NOT** operationally launchable until section B is answered.

The Academy is not launched, and this work does not claim it is.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
