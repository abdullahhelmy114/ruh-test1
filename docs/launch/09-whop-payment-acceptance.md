# 09 — Whop payment acceptance (PAY-04)

Revision under review: **fe50526** (local) on top of **1de8fa2** (deployed). Prepared 2026-09-21.
**No real or sandbox purchase was executed. No payment configuration was changed.**

## PAY-04 status: NOT ACCEPTED — implemented, unconfigured, and unproven end to end

The buying path exists in code from offer to entitlement. It has **never been executed**, in any
environment, by this work. A configured key would not change that: PAY-04 closes only when a
sandbox purchase has been run end to end and reconciled, and then only for the sandbox.

| Stage | State | Basis |
| --- | --- | --- |
| Offer defined and linked to one class group | **WORKING** | One Whop plan id (`^plan_[A-Za-z0-9]{1,64}$`) mapped to exactly one class group |
| Checkout creation | **BLOCKED BY CONFIGURATION** | `WHOP_API_KEY` unset ⇒ `not_configured`; the Buy button reports a truthful failure and nothing is charged |
| Return route `/academy/checkout/[id]` | implemented | Reached by Whop's `redirect_url` |
| Cancel route | **MISSING** | No cancel URL is sent, so an abandoned checkout has nowhere to return to |
| Webhook signature verification | **WORKING** | Fails closed without the secret; verifies Standard Webhooks HMAC-SHA256 over the **raw** body with a timestamp tolerance; verified at `src/app/api/webhooks/whop/route.ts:25-45` |
| Idempotency and replay | **WORKING** | The event row and its effects commit in one transaction; a duplicate delivery id reads back as `duplicate` (`commerce-service.ts:129-142`) |
| Payment state transitions | implemented | `academy_checkouts` written in `created` before redirect, with an audit event |
| Entitlement creation and revocation | implemented, with gaps (below) | |
| Refund handling | implemented | Matched to an entitlement by Whop payment id; a non-succeeded refund is recorded, not applied |
| Reconciliation surface | **MISSING** | See gap 3 |
| Access control on commerce routes | **WORKING** | `requireAuth`, a per-uid rate limit (10 per 10 min), then the service authorises |

## Gaps that must close before money is taken

**1. A learner can pay twice for one seat. (P1 — VERIFIED myself.)**
`planOpenCheckout` refuses a second purchase only when the learner already has an **open enrollment
or an active entitlement** (`src/lib/academy/commerce/commerce.ts:211-212`). Both of those appear
only after the webhook lands. In the window between paying and the webhook arriving, the same
learner can open a second checkout and pay again. **Fix (LOCAL, not made here — it touches
enrollment logic and needs approval):** also refuse while an open checkout exists for the same
learner and offer, and make the grant idempotent per learner and class group.

**2. Capacity is read outside the transaction that grants the seat. (P1)**
`onPaymentSucceeded` loads the class group's open enrollments through the executor and then commits
the grant separately, so two payments arriving together can both pass a capacity check that was true
for neither. The outcome is an over-filled class group, or a paid learner with no seat.

**3. "Money taken, nothing granted" has no administration surface. (P1)**
Outcomes such as `held` are recorded in `academy_payment_events` with a reason, but no screen lists
them, so nobody learns that a payment needs attention. A reconciliation view is required before real
money moves.

**4. No amount, currency or paid-at is recorded anywhere. (P2 — OWNER DECISION.)**
`academy_offers` carries a plan id and a free-text label but no price; entitlements carry no amount.
The academy therefore cannot answer "what was this learner charged?" without opening Whop. Whether
the academy should store money values is a product and finance decision.

**5. Grant depends on Whop returning the checkout metadata. (P1)**
If the provider does not propagate the metadata the grant keys on, a successful payment cannot be
matched. This must be proven in sandbox before it is trusted.

**6. A membership event that arrives before its entitlement is recorded and dropped;
entitlements without a membership id can never be revoked by a later event. (P2)**

**7. An unavailable academy looks like a payment failure. (P3)**
`startCheckout` asserts the academy flag **before** checking whether Whop is configured, so with the
flag off the Buy button reports a generic failure rather than "not open yet".

## The financial acceptance gate — all of it, before production keys

**PENDING APPROVAL. Dr. Jihan approves the commercial terms; Abdullah performs the steps.**

| # | Step | Evidence of PASS | Approval |
| --- | --- | --- | --- |
| 1 | Close gaps 1, 2, 3 and 5 in code, with tests | Tests cover double purchase, concurrent grants, and a held payment appearing in an administration list | **yes** |
| 2 | Configure **sandbox** only: `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_API_BASE_URL` = sandbox base, `NEXT_PUBLIC_SITE_URL` | `readiness-check` shows them set; the environment reads "sandbox" | no |
| 3 | Register the webhook endpoint and send a test event | Accepted once; a replay records `duplicate` | no |
| 4 | Run one sandbox purchase end to end with a synthetic learner | Checkout → payment → webhook → entitlement → enrollment → the learner sees the class | no |
| 5 | Run the failure cases in sandbox: abandoned checkout, duplicate webhook, refund, capacity full | Each behaves as documented; no silent success | no |
| 6 | Reconcile: every sandbox payment event maps to an entitlement, or appears in the held list | A written reconciliation record | no |
| 7 | Decide refund rules, cancellation terms and who answers billing questions | Written policy, published in the terms | **yes** |
| 8 | Only then: production key, production base URL, and one small real purchase by the owner, refunded | A recorded, reconciled, refunded transaction | **yes — finance** |

Until step 8 is recorded, **real checkout stays off**. This work neither enabled it nor prepared it.

---

سري للغاية — ملكية فكرية خاصة — يُمنع التداول أو النسخ أو النشر أو إعادة الاستخدام دون إذن كتابي من صاحبة المشروع
