# 14 — Rollback and recovery

Prepared 2026-09-21. Local head **70a77e2**; deployed **1de8fa2**.

Every change in this release candidate is reversible. This is how, in the order you would need it.

## A. The deploy

**Rollback:** redeploy the previous commit in Coolify — `1de8fa2`, which is what production runs
today and is known good. No database change is part of this release candidate, so rolling the code
back needs nothing else undone.

**Time to recover:** one Coolify redeploy.

**Loss:** the six local commits go back to being local. Nothing else.

## B. Per-change rollback

| Change | Commit | Rollback | Side effects of rolling back |
| --- | --- | --- | --- |
| CSP, footer link, library error state | `e257693` | `git revert e257693` | Recordings stop playing again; the library lies about being empty again |
| **A session for an identity with no profile is refused** | `cc875fc` | `git revert cc875fc` | Restores the defect: a provider sign-in mints a cookie and the browser looks signed in while every API refuses |
| Launch readiness gate | `a0ed893` | delete the script | None — it changes no application behaviour |
| Truthful public claims | `8908c57` | `git revert 8908c57` | Restores the fabricated discount confirmation, the invented testimonials and the dead "Start Test" link |
| Registration hand-off | `fe50526` | `git revert fe50526` | A verified learner is dropped into an unauthenticated workspace again |
| hreflang, canonical, skip link | `70a77e2` | `git revert 70a77e2` | Re-advertises three 404s as translations; every page claims to be a duplicate of the homepage; the skip link disappears |

Prefer fixing forward for `cc875fc`, `fe50526` and `70a77e2`: reverting them restores a known defect.

## C. Configuration

Each variable in report 05 lists its own rollback. The general rule: **change one variable, redeploy,
validate, and if the validation fails restore the previous value and redeploy again.** Keep the
previous value in the password manager until the new one is validated.

The riskiest single switch is `ACADEMY_CORE_SCHEMA_READY=true`, because it opens all 22 services at
once. Its rollback is to set it back to `false`: the academy closes again and **no data changes**.
Run `node scripts/launch-readiness-check.mjs` before flipping it, so you are not opening the gate
onto missing policies or an empty catalogue.

## D. Database

**No schema change is proposed in this release candidate.** If one is approved later
(`db/recovery/`, or a legacy data recovery):

1. Take a Neon branch or snapshot of the production branch first and record its name here.
2. Apply exactly one change.
3. Re-run the readiness check and record the output.
4. To roll back: restore the recorded branch, or run the paired `.down.sql`.

`db/recovery/0001_account_tables.down.sql` drops only the two tables it created and **refuses while
either holds a row**, so it cannot quietly destroy accounts. Emptying them deliberately is a decision
someone has to take, not something a script does on its own.

**Never** delete the old database, and never move data between Neon databases without a written,
approved recovery plan (provenance, counts, checksums, duplicate handling, rollback, acceptance).

## E. Firebase

Nothing here changes Firebase. If the project is switched later, understand that **every existing
profile is keyed to the old project's uids** and would stop matching. Rollback is to switch the
variables back; the profiles are untouched either way, which is exactly why the switch must be
decided before, not after.

## F. Payments

Real checkout is off and stays off until the gate in report 09 is recorded. Rollback at any point:
unset `WHOP_API_KEY` and redeploy — checkout creation fails closed and the Buy button reports a
truthful failure. Nothing is charged. If a real payment has been taken and the grant failed, the
recovery is a refund in Whop plus a manual enrollment by an administrator — which is exactly why the
reconciliation gap (report 09, gap 3) should close before any money moves.

## G. If something goes wrong during launch

1. **Stop.** Do not apply a second change on top of a failing one.
2. Roll the deploy back to `1de8fa2` (section A).
3. Record what happened in report 13 with the time and the exact symptom.
4. Only then diagnose.

## H. What cannot be rolled back

- **An email sent to a real person.** Configure email and sign-up on a synthetic address first.
- **A real payment.** It can be refunded, not undone.
- **Published academic content.** It can be withdrawn, but people may have seen it.
- **A leaked secret.** Rotate it at the provider; rolling back the deployment does not un-leak it.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
