# 15 — Owner approval requests

For **Dr. Jihan**, the final approval authority for the Academy. Prepared 2026-09-21 at local head
**70a77e2**. Nothing in this list has been done. Each item states what is being asked, why it cannot
be decided by an engineer, and what happens if it waits.

## Group 1 — Public claims the product cannot currently support

**1.1 Already prepared locally, awaiting approval to publish (commit `8908c57`).**
Three claims were replaced because the product cannot honour them:
- the hero's "early-bird 50% OFF" form, which confirmed a discount to the visitor
  (`alert("Thank you! You've secured your 50% discount.")`) and **stored nothing**;
- a testimonials section with invented quotes and five-star ratings attributed to three named people;
- `/assessments` offering "Start Test" behind a link to `#`.
**Asked:** approve publishing the replacements, or tell us what should stand in their place.
**If it waits:** the fabrications stay live on the site.

**1.2 Not touched, needs your word.**
- The hero's **"30+ years"** experience figure and the **"100%"** claim beside "Live Online
  Mentorship". If they are substantiable, they stay; if not, they should go.
- `/subscriptions` lists **invented plan prices** ($99, $179). The page is unlinked but reachable.
  Pricing is Whop-only and per class group, so these contradict the model.
**Asked:** substantiate, rewrite, or remove.

## Group 2 — Product decisions blocking a complete journey

**2.1 Should a Google or Facebook sign-in be able to *create* an account?**
Today it cannot: sign-up collects country, nationality, gender, languages, WhatsApp and a referral
code, and runs an email verification step a popup cannot supply. Since `cc875fc`, a provider sign-in
for an unknown identity is refused cleanly instead of creating a broken session.
**Options:** (a) hide the provider buttons; (b) design a provider onboarding form that collects the
same fields; (c) leave it as "existing accounts only".

**2.2 The library, dictionary and Quran tools.**
Their tables are absent, so their APIs answer 500, and the Navbar still links Dictionary and Library.
They are academic resources, so they are **not** retired on an engineer's judgement.
**Options:** (a) recover the legacy data under an evidence-based, separately approved migration;
(b) rebuild them on the academy model later; (c) remove the public entry points until then.

**2.3 Two policies nobody reads.** `attendance.requirement` and `assessment.requirements` can be set
but nothing consumes them. Keep and wire them up, or remove them so the administrator's checklist is
honest.

**2.4 Class group information on the public course page.** It shows name, dates and open/full, but
not the schedule or the teacher. What may be public before purchase?

**2.5 Announcements at academy scope** currently fan out per course or class group only.
Should an academy-wide announcement reach every learner and teacher?

## Group 3 — Payments (report 09)

**3.1 The financial acceptance gate.** Real checkout stays off until every step is recorded: the four
code gaps closed (double charge, capacity race, no reconciliation surface, provider metadata),
a sandbox purchase run end to end, the failure cases exercised, reconciliation written down, refund
and cancellation rules published, and finally one small real purchase, refunded.
**Asked:** approve the gate, and name who signs the financial acceptance.

**3.2 Should the academy record money at all?** Offers carry a plan id and a label but no price, and
entitlements carry no amount, so the academy cannot answer "what was this learner charged?" without
opening Whop.

## Group 4 — Identity and access

**4.1 The Firebase project.** Local config names `ruhulqudus-test`; the service worker and a
preconnect still name `ruhulqudus-48d29`. **Every profile is keyed to one project's uids**, so
switching projects invalidates every account. Decide the final project, then the code is aligned.

**4.2 The administrator account.** The readiness gate must report an **active** administrator. In the
isolated test branch the only admin row is `pending`. Confirm production has one, and that it belongs
to the person it should.

**4.3 Sign-out and Bearer tokens (report 10, defect 1).** Sign-out revokes refresh tokens, but the
header path does not check revocation, so an already-issued token keeps working for up to an hour.
The fix adds a Firebase round trip to every authenticated request.
**Asked:** accept the latency and cost, or accept the one-hour window.

**4.4 Rate limiting behind Coolify (report 10, defect 2).** The limiter keys on the first
`x-forwarded-for` entry, which a caller can set; the code comments describe a Railway proxy, not
Coolify. Confirm how the proxy sets that header so the fix uses the right hop.

**4.5 Retire `POST /api/upload`?** It accepts uploads from any signed-in session with no quota, and
**nothing calls it**. Retiring it is safer and cheaper than adding a quota.

## Group 5 — Academic content and policies (report 11)

**5.1 All 12 policy values.** Each one is an academic rule: the academy's timezone, the attendance
marks and their labels in three languages, late work, revisions, attempt limits, when results are
released, completion criteria, certificate eligibility, recording access, and messaging. Report 11
proposes a starting value for each with reasoning. **An engineer must not choose these.**

**5.2 The minimum content for a controlled launch** — one program, one course, one curriculum version
with Lesson Sheets, one class group, an assigned teacher, sessions, an offer. Each needs approval,
and the religious and academic review gates apply.

**5.3 Certificates.** Proposed to start **off** until the certificate text and eligibility are
approved.

## Group 6 — Legal and operational (report 04 section I)

Privacy notice and terms reviewed against what the site actually collects and which processors it
uses; refund and cancellation rules that match the code; a named support contact; retention for
applicant CVs and videos; and a lawyer's confirmation on cookies for the jurisdictions served.

## Group 7 — Deployment

**7.1 Approve deploying this release candidate.** Six local commits, not pushed. It changes the
**sign-in path** for every account, so the post-deploy smoke in report 13 — especially signing in
with a real account — must be run immediately, with a rollback to `1de8fa2` ready.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
