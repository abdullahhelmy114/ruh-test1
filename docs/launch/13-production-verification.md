# 13 — Production verification

Prepared 2026-09-21. Deployed revision at the time of measurement: **1de8fa2**.
Local head: **70a77e2** — **not deployed**.

Everything here was measured with anonymous HTTP requests. No production credential exists in this
session, no production database was read, and nothing was written. Empty-body POSTs were used only
against public endpoints where the configuration check runs before any side effect; they create
nothing.

## A. What was measured, and when

| Probe | Result | Reading |
| --- | --- | --- |
| `GET /` | 200 | Serves the pushed revision (no legacy markers) |
| `GET /academy` | 200, renders `<p role="status">This part of the academy is not available yet.</p>` | The academy flag is not `true` |
| `GET /api/public/academy/catalog` | 503 | Same cause, reported honestly |
| `GET /api/academy-info` | 200 `{"catalogPage":"/academy","programs":[],"courses":[]}` | The assistant reads the academy, not legacy tables |
| `POST /api/signup/student` `{}` | **503 `Verification service unavailable`** | `INTERNAL_API_SECRET` unset — **registration is closed** |
| `POST /api/signup/teacher` `{}` | **503** | same |
| `POST /api/cloudinary/sign-upload` `{"purpose":"teacher_cv"}` | **503 `Upload service unavailable`** | Cloudinary unset — teacher applications cannot upload a CV |
| `POST /api/send-verification-code` `{}` | 400 `Missing email` | Validates first; the same secret is checked after |
| `GET /api/teacher/public/<unknown-uid>` | 404 `Teacher not found` | **`profiles` exists** and the query ran |
| `GET /api/words`, `/api/irab`, `/api/quran-irab`, `/api/library/books`, `/api/categories`, `/api/course` | 500 | Their legacy tables are absent |
| `GET /api/courses`, `/api/bundles` | 410 | Retired, as intended |
| `/courses`, `/bundles`, `/cart`, `/wishlist`, `/community` | 307 → `/academy` | P0 redirects live |
| `/messages` → `/academy/messages`; `/dashboard/student` → `/academy/learn`; `/dashboard/admin` → `/academy/manage` | 307 | Account routing live |
| 20 public routes sampled | all 200 | No 5xx on the public launch path |
| `GET /sitemap.xml` | 200, lists `/academy`, no retired page | The **static** `public/sitemap.xml` is the one served; it shadows `app/sitemap.ts` |

## B. What production state remains unverified

| Claim | How to close it |
| --- | --- |
| 51 academy tables present | `node scripts/launch-readiness-check.mjs` against the production branch |
| `verification_codes` restored, with the right shape | Same, plus section 4 of `db/recovery/checks.sql` |
| Test profiles inserted; **an administrator is active** | Same — the gate "An active administrator exists" |
| Which Firebase project Coolify uses | Read the variable name list in Coolify (never the values) |
| Email deliverability | A synthetic sign-up once configured |
| Whop anything | Sandbox run, report 09 |

**The administrator gate is the one to check first.** In the isolated test branch the only admin row
is `pending`, and a pending administrator cannot administer.

## C. Smoke to run immediately after the next deploy

In this order. Stop and roll back (report 14) if any step fails.

| # | Check | Expected | If it fails |
| --- | --- | --- | --- |
| 1 | `GET /` and `GET /academy` | 200 | Roll back the deploy |
| 2 | `GET /api/courses`, `/api/bundles` | 410 | Roll back |
| 3 | `/courses`, `/bundles`, `/cart`, `/wishlist`, `/community`, `/messages`, `/dashboard/student`, `/dashboard/admin` | 307 to the academy destinations | Roll back |
| 4 | **Sign in with a real account** (Abdullah's own) | Lands on the account home; no red error; the header shows the account | **Roll back immediately** — this exercises the Batch A change |
| 5 | Sign out, then reload a workspace page | Signed out, no stale session | Investigate before proceeding |
| 6 | Sign in with a Google account that has **no** academy profile | Refused with "This sign-in has no academy account yet", and the browser is not left half-signed-in | Report; this is the new refusal path |
| 7 | Deployed revision matches the intended commit | Coolify shows the commit; the page carries no retired markers | Roll back |
| 8 | Read the runtime log for 5 minutes | No `42P01`, no `relation … does not exist`, no unhandled rejection | Investigate |

Steps 4 and 6 are **PRODUCTION AUTHENTICATED VERIFIED** evidence and can only be produced by a
person with a real account. They do not exist yet.

## D. Recording the evidence

For each step record: date and time, who ran it, the exact URL or action, the observed result, and
the deployed commit. Keep it in this file under a dated heading. A launch claim without this record
is not a launch claim.

### (no production verification runs recorded yet for revision 70a77e2 — it is not deployed)

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
