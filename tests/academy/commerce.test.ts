/**
 * Whop commerce: signatures, event reading, the access decisions, and the
 * service that applies them exactly once.
 *
 * The launch audit (2026-09-18) found no way to buy anything (PAY-04): the
 * Whop webhook verified and then discarded every event. These tests pin the
 * rules of the replacement: access follows only signed Whop events, a payment
 * for another plan or another learner's checkout grants nothing, a redelivery
 * changes nothing twice, and refunds or ended memberships take access away.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  decidePaymentSucceeded,
  readPayment,
  readRefund,
  readWhopEnvelope,
  refundEndsAccess,
  type CheckoutRecord,
  type OfferRecord,
} from "../../src/lib/academy/commerce/commerce.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import { mapClassGroupRow, mapEnrollmentRow } from "../../src/lib/academy/repo/delivery-repo.ts";
import { listPublicOffersQuery, mapCheckoutRow, mapOfferRow } from "../../src/lib/academy/repo/commerce-repo.ts";
import { createCommerceService, type CheckoutGateway } from "../../src/lib/academy/services/commerce-service.ts";
import { resolveWhopConfig, signWhopPayload, verifyWhopSignature, WHOP_PRODUCTION_API, WHOP_SANDBOX_API } from "../../src/lib/payments/whop.ts";
import { admin, classGroupRow, enrollmentRow, fakeExecutor, fixedClock, IDS, rejectsDomain, rejectsForbidden, sequentialIds, student, teacher, type Rule } from "./support.ts";

const ROOT = path.join(import.meta.dirname, "..", "..");
const code = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const AT = "2026-09-01T08:00:00.000Z";
const OFFER = "0ffe0000-0000-4000-8000-000000000001";
const CHECKOUT = "c4ec0000-0000-4000-8000-000000000001";
const ENTITLEMENT = "e7e70000-0000-4000-8000-000000000001";
const PLAN = "plan_Aut26Nahw";
const PAYMENT = "pay_Test1234";
const MEMBERSHIP = "mem_Test1234";
const USER = "user_Test1234";
const SECRET = "ws_test_fixture_secret_not_a_real_one";

function offerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: OFFER, course_id: IDS.course, class_group_id: IDS.classGroup, provider: "whop", provider_plan_id: PLAN, label: "Autumn cohort",
    state: "active", state_reason: null, revision: 1, created_by: "admin-1", created_at: AT, updated_by: "admin-1", updated_at: AT, ...overrides,
  };
}

function checkoutRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CHECKOUT, offer_id: OFFER, learner_uid: "student-1", provider: "whop", provider_checkout_id: "ch_Test1234",
    purchase_url: "https://sandbox.whop.com/checkout/plan_Aut26Nahw/?session=ch_Test1234", state: "open", failure: null, created_at: AT, updated_at: AT, ...overrides,
  };
}

function entitlementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTITLEMENT, learner_uid: "student-1", offer_id: OFFER, course_id: IDS.course, class_group_id: IDS.classGroup, enrollment_id: IDS.enrollment,
    checkout_id: CHECKOUT, provider: "whop", provider_payment_id: PAYMENT, provider_membership_id: MEMBERSHIP, provider_user_id: USER,
    state: "active", state_reason: null, revision: 1, granted_at: AT, updated_at: AT, revoked_at: null, ...overrides,
  };
}

/** A payment in Whop's legacy shape (embedded objects) with the metadata the server set on the checkout. */
function legacyPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT, status: "paid", substatus: "succeeded", plan: { id: PLAN }, membership: { id: MEMBERSHIP }, user: { id: USER },
    metadata: { academy_checkout_id: CHECKOUT, academy_learner_uid: "student-1", academy_offer_id: OFFER }, ...overrides,
  };
}

const learnerRow = { firebase_uid: "student-1", role: "student", status: "active" };

/** Rules for a healthy purchase; later rules override earlier ones by being placed first. */
function purchaseRules(extra: Rule[] = []): Rule[] {
  return [
    ...extra,
    { match: /FROM academy_payment_events WHERE/, rows: [] },
    { match: /FROM academy_checkouts WHERE id/, rows: [checkoutRow()] },
    { match: /FROM academy_offers WHERE id/, rows: [offerRow()] },
    { match: /FROM academy_class_groups WHERE id/, rows: [classGroupRow()] },
    { match: /FROM profiles WHERE firebase_uid/, rows: [learnerRow] },
    { match: /FROM academy_entitlements/, rows: [] },
    { match: /FROM academy_enrollments\s+WHERE class_group_id = \$1::uuid AND learner_uid/, rows: [] },
    { match: /count\(\*\)::int AS n FROM academy_enrollments/, rows: [{ n: 0 }] },
  ];
}

const gatewayOk: CheckoutGateway & { calls: unknown[] } = {
  configured: true,
  calls: [],
  async open(input) {
    this.calls.push(input);
    return { providerCheckoutId: "ch_Test1234", purchaseUrl: "https://sandbox.whop.com/checkout/plan_Aut26Nahw/?session=ch_Test1234" };
  },
};

function service(rules: Rule[], gateway: CheckoutGateway = gatewayOk) {
  const executor = fakeExecutor(rules);
  return { executor, commerce: createCommerceService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds(), gateway }) };
}

const texts = (statements: readonly { text: string }[]) => statements.map((s) => s.text);

// ---------------------------------------------------------------------------

describe("Whop configuration", () => {
  test("defaults to the sandbox; production only when named exactly", () => {
    assert.equal(resolveWhopConfig({}).apiBase, WHOP_SANDBOX_API);
    assert.equal(resolveWhopConfig({}).environment, "sandbox");
    assert.equal(resolveWhopConfig({ apiBase: `${WHOP_PRODUCTION_API}/` }).environment, "production");
    assert.throws(() => resolveWhopConfig({ apiBase: "https://evil.example/api/v1" }));
    assert.equal(resolveWhopConfig({ apiKey: "  " }).apiKey, null);
    assert.equal(resolveWhopConfig({ webhookSecret: "" }).webhookSecret, null);
    assert.equal(resolveWhopConfig({ siteUrl: "http://localhost:3000/anything" }).returnBase, "http://localhost:3000");
    assert.throws(() => resolveWhopConfig({ siteUrl: "http://example.com" }));
  });
});

describe("Whop webhook signatures", () => {
  const now = 1_800_000_000;
  const body = JSON.stringify({ type: "payment.succeeded", data: legacyPayment() });
  const headers = (signature: string, timestamp = String(now), id = "msg_Test1") => ({ id, timestamp, signature });

  test("a correctly signed delivery is accepted", () => {
    assert.equal(verifyWhopSignature(SECRET, headers(signWhopPayload(SECRET, "msg_Test1", String(now), body)), body, now), "valid");
  });

  test("a forged, tampered, re-addressed or replayed delivery is refused", () => {
    assert.equal(verifyWhopSignature(SECRET, headers(signWhopPayload("ws_someone_else", "msg_Test1", String(now), body)), body, now), "invalid");
    assert.equal(verifyWhopSignature(SECRET, headers(signWhopPayload(SECRET, "msg_Test1", String(now), body)), body.replace("paid", "PAID"), now), "invalid");
    assert.equal(verifyWhopSignature(SECRET, headers(signWhopPayload(SECRET, "msg_Test1", String(now), body), String(now), "msg_Other"), body, now), "invalid");
    assert.equal(verifyWhopSignature(SECRET, headers(signWhopPayload(SECRET, "msg_Test1", String(now - 600), body), String(now - 600)), body, now), "stale");
    assert.equal(verifyWhopSignature(SECRET, headers("v1,Zm9yZ2Vk"), body, now), "invalid");
    assert.equal(verifyWhopSignature(SECRET, { id: null, timestamp: String(now), signature: "v1,x" }, body, now), "missing");
    assert.equal(verifyWhopSignature(SECRET, headers("v1,x", "12.5"), body, now), "invalid");
  });

  test("several signatures (secret rotation) and the Standard Webhooks whsec_ form are accepted", () => {
    const good = signWhopPayload(SECRET, "msg_Test1", String(now), body);
    assert.equal(verifyWhopSignature(SECRET, headers(`v1,Zm9yZ2Vk ${good}`), body, now), "valid");
    const raw = Buffer.from("raw-standard-webhooks-key");
    const whsec = `whsec_${raw.toString("base64")}`;
    const { createHmac } = globalThis.process.getBuiltinModule("node:crypto") as typeof import("node:crypto");
    const sig = `v1,${createHmac("sha256", raw).update(`msg_Test1.${now}.${body}`).digest("base64")}`;
    assert.equal(verifyWhopSignature(whsec, headers(sig), body, now), "valid");
  });

  test("the route verifies before reading the body, fails closed and never logs the body or secret", () => {
    const src = code("src/app/api/webhooks/whop/route.ts");
    assert.ok(src.indexOf("verifyWhopSignature(") < src.indexOf("JSON.parse(rawBody)"), "signature first");
    assert.match(src, /if \(!secret\)[\s\S]*status: 500/);
    // Logs name the outcome only: no body, secret or signature value is ever interpolated.
    assert.doesNotMatch(src, /console\.\w+\([^;]*\$\{\s*(rawBody|secret|envelope\.data)\b/);
    assert.doesNotMatch(src, /console\.\w+\([^;]*headers\.get\("webhook-signature"\)/);
    assert.match(src, /commerceService\.handleWhopEvent\(id as string, envelope\)/);
  });
});

describe("reading Whop events", () => {
  test("malformed envelopes are refused", () => {
    for (const bad of [null, [], {}, { type: "Payment Succeeded", data: {} }, { type: "payment.succeeded" }, { type: "payment.succeeded", data: [] }]) {
      assert.throws(() => readWhopEnvelope(bad), (e: unknown) => e instanceof DomainError && e.code === "VALIDATION");
    }
  });

  test("legacy and current payment shapes read the same", () => {
    const legacy = readPayment(legacyPayment());
    const current = readPayment({ id: PAYMENT, status: "paid", plan_id: PLAN, membership_id: MEMBERSHIP, user_id: USER, metadata: legacyPayment().metadata });
    for (const facts of [legacy, current]) {
      assert.equal(facts.planId, PLAN);
      assert.equal(facts.membershipId, MEMBERSHIP);
      assert.equal(facts.userId, USER);
      assert.equal(facts.checkoutId, CHECKOUT);
      assert.equal(facts.learnerUid, "student-1");
      assert.equal(facts.offerId, OFFER);
    }
    assert.throws(() => readPayment({ id: "not-a-payment" }));
    assert.equal(readPayment(legacyPayment({ metadata: { academy_checkout_id: "not-a-uuid" } })).checkoutId, null);
  });

  test("refunds: full or unknown amounts end access; partial and unfinished ones do not", () => {
    assert.equal(refundEndsAccess(readRefund({ status: "succeeded", amount: 50, payment: { id: PAYMENT, total: 50 } })).ends, true);
    assert.equal(refundEndsAccess(readRefund({ status: "succeeded", payment_id: PAYMENT, amount: { amount: 5000, currency: "usd" } })).ends, true);
    assert.equal(refundEndsAccess(readRefund({ status: "succeeded", amount: 10, payment: { id: PAYMENT, total: 50 } })).ends, false);
    assert.equal(refundEndsAccess(readRefund({ status: "pending", amount: 50, payment: { id: PAYMENT, total: 50 } })).ends, false);
    assert.equal(readRefund({ payment: { id: PAYMENT } }).paymentId, PAYMENT);
  });
});

describe("the grant decision", () => {
  const base = () => ({
    payment: readPayment(legacyPayment()),
    checkout: mapCheckoutRow(checkoutRow()) as CheckoutRecord,
    offer: mapOfferRow(offerRow()) as OfferRecord,
    classGroup: mapClassGroupRow(classGroupRow()),
    learner: { uid: "student-1", role: "student" as const, status: "active" },
    openEnrollment: null,
    paymentAlreadyGranted: false,
    checkoutAlreadyGranted: false,
  });

  test("a verified payment for the checkout's own plan and learner grants a new enrollment", () => {
    assert.deepEqual(decidePaymentSucceeded(base()), { kind: "grant", enrollment: { mode: "create" } });
  });

  test("another Whop product (plan) grants nothing", () => {
    const decision = decidePaymentSucceeded({ ...base(), payment: readPayment(legacyPayment({ plan: { id: "plan_SomethingElse" } })) });
    assert.equal(decision.kind, "held");
  });

  test("a payment pointing at another learner's checkout grants nothing", () => {
    const other = readPayment(legacyPayment({ metadata: { academy_checkout_id: CHECKOUT, academy_learner_uid: "student-2", academy_offer_id: OFFER } }));
    assert.equal(decidePaymentSucceeded({ ...base(), payment: other }).kind, "held");
  });

  test("payments that are not academy checkouts, or not paid, are ignored", () => {
    assert.equal(decidePaymentSucceeded({ ...base(), payment: readPayment(legacyPayment({ metadata: {} })) }).kind, "ignored");
    assert.equal(decidePaymentSucceeded({ ...base(), checkout: null }).kind, "ignored");
    assert.equal(decidePaymentSucceeded({ ...base(), payment: readPayment(legacyPayment({ status: "open", substatus: "pending" })) }).kind, "ignored");
  });

  test("a payment already turned into access is only recorded", () => {
    assert.equal(decidePaymentSucceeded({ ...base(), paymentAlreadyGranted: true }).kind, "recorded");
    assert.equal(decidePaymentSucceeded({ ...base(), checkoutAlreadyGranted: true }).kind, "recorded");
  });

  test("existing enrollments are reused or activated; a suspended one waits for an administrator", () => {
    const active = mapEnrollmentRow(enrollmentRow());
    assert.equal(decidePaymentSucceeded({ ...base(), openEnrollment: active }).kind, "grant");
    const pending = mapEnrollmentRow(enrollmentRow({ state: "pending" }));
    assert.deepEqual(decidePaymentSucceeded({ ...base(), openEnrollment: pending }), { kind: "grant", enrollment: { mode: "activate", record: pending } });
    assert.equal(decidePaymentSucceeded({ ...base(), openEnrollment: mapEnrollmentRow(enrollmentRow({ state: "suspended" })) }).kind, "held");
  });

  test("a finished class or a non-learner account is held, not enrolled", () => {
    assert.equal(decidePaymentSucceeded({ ...base(), classGroup: mapClassGroupRow(classGroupRow({ status: "completed" })) }).kind, "held");
    assert.equal(decidePaymentSucceeded({ ...base(), learner: { uid: "student-1", role: "teacher", status: "active" } }).kind, "held");
  });
});

describe("processing Whop events", () => {
  const envelope = (type: string, data: Record<string, unknown>) => readWhopEnvelope({ type, data });

  test("payment.succeeded grants once: event, enrollment (source entitlement), entitlement and checkout in one transaction", async () => {
    const { executor, commerce } = service(purchaseRules());
    const result = await commerce.handleWhopEvent("msg_Grant1", envelope("payment.succeeded", legacyPayment()));
    assert.equal(result.outcome, "granted");
    assert.equal(executor.transactions.length, 1);
    const [event, lock, enrollment, entitlement, checkout] = executor.transactions[0];
    assert.match(event.text, /INSERT INTO academy_payment_events/);
    assert.deepEqual(event.values.slice(0, 4), ["msg_Grant1", "payment.succeeded", PAYMENT, "granted"]);
    assert.match(lock.text, /FOR UPDATE/);
    assert.match(enrollment.text, /INSERT INTO academy_enrollments/);
    assert.ok(enrollment.values.includes("entitlement"), "the enrollment says where it came from");
    assert.match(enrollment.text, /INSERT INTO academy_audit_events/);
    assert.match(entitlement.text, /INSERT INTO academy_entitlements/);
    assert.ok(entitlement.values.includes(PAYMENT) && entitlement.values.includes(MEMBERSHIP) && entitlement.values.includes(USER));
    assert.ok(entitlement.values.includes("system:whop"), "audited as the Whop system actor");
    assert.match(checkout.text, /UPDATE academy_checkouts/);
    assert.ok(checkout.values.includes("completed"));
  });

  test("a redelivered event changes nothing", async () => {
    const { executor, commerce } = service(purchaseRules([{ match: /FROM academy_payment_events WHERE/, rows: [{ outcome: "granted" }] }]));
    assert.deepEqual(await commerce.handleWhopEvent("msg_Grant1", envelope("payment.succeeded", legacyPayment())), { outcome: "duplicate", detail: null });
    assert.equal(executor.transactions.length, 0);
  });

  test("two deliveries racing: the loser's transaction rolls back and reads as a duplicate", async () => {
    let seen = false;
    const { executor, commerce } = service(purchaseRules([{ match: /FROM academy_payment_events WHERE/, rows: () => (seen ? [{ outcome: "granted" }] : ((seen = true), [])) }]));
    executor.failTransactionWith = Object.assign(new Error("duplicate key value violates unique constraint academy_payment_events_pk"), { code: "23505" });
    assert.equal((await commerce.handleWhopEvent("msg_Grant1", envelope("payment.succeeded", legacyPayment()))).outcome, "duplicate");
  });

  test("a second, different event for an already granted payment is only recorded", async () => {
    const { executor, commerce } = service(purchaseRules([{ match: /academy_entitlements WHERE provider = 'whop' AND provider_payment_id/, rows: [entitlementRow()] }]));
    assert.equal((await commerce.handleWhopEvent("msg_Grant2", envelope("payment.succeeded", legacyPayment()))).outcome, "recorded");
    assert.equal(executor.transactions[0].length, 1, "only the event row");
  });

  test("a payment for another plan is held and fails the checkout without access", async () => {
    const { executor, commerce } = service(purchaseRules());
    const result = await commerce.handleWhopEvent("msg_Wrong1", envelope("payment.succeeded", legacyPayment({ plan: { id: "plan_OtherProduct" } })));
    assert.equal(result.outcome, "held");
    assert.deepEqual(texts(executor.transactions[0]).map((t) => t.match(/(INSERT INTO|UPDATE) academy_\w+/)?.[0]), ["INSERT INTO academy_payment_events", "UPDATE academy_checkouts"]);
    assert.ok(executor.transactions[0][1].values.includes("mismatch"));
  });

  test("payment.failed fails the checkout and grants nothing", async () => {
    const { executor, commerce } = service(purchaseRules());
    const result = await commerce.handleWhopEvent("msg_Fail1", envelope("payment.failed", legacyPayment({ status: "open", substatus: "failed" })));
    assert.equal(result.outcome, "recorded");
    assert.ok(executor.transactions[0][1].values.includes("payment_failed"));
    assert.equal(texts(executor.transactions[0]).some((t) => /academy_entitlements|academy_enrollments/.test(t)), false);
  });

  test("pending payments change nothing", async () => {
    const { executor, commerce } = service(purchaseRules());
    assert.equal((await commerce.handleWhopEvent("msg_Pend1", envelope("payment.pending", legacyPayment({ status: "pending" })))).outcome, "recorded");
    assert.equal(executor.transactions[0].length, 1);
  });

  test("a full refund revokes and suspends the enrollment the entitlement opened", async () => {
    const { executor, commerce } = service([
      { match: /FROM academy_payment_events WHERE/, rows: [] },
      { match: /academy_entitlements WHERE provider = 'whop' AND provider_payment_id/, rows: [entitlementRow()] },
      { match: /FROM academy_enrollments WHERE id/, rows: [enrollmentRow({ source: "entitlement" })] },
    ]);
    const result = await commerce.handleWhopEvent("msg_Refund1", envelope("refund.created", { id: "rf_1", status: "succeeded", amount: 50, payment: { id: PAYMENT, total: 50 } }));
    assert.equal(result.outcome, "revoked");
    const [, entitlement, enrollment] = executor.transactions[0];
    assert.match(entitlement.text, /UPDATE academy_entitlements/);
    assert.ok(entitlement.values.includes("revoked") && entitlement.values.includes("refunded"));
    assert.match(enrollment.text, /UPDATE academy_enrollments/);
    assert.ok(enrollment.values.includes("suspended"));
  });

  test("a refund never touches an enrollment an administrator created", async () => {
    const { executor, commerce } = service([
      { match: /FROM academy_payment_events WHERE/, rows: [] },
      { match: /academy_entitlements WHERE provider = 'whop' AND provider_payment_id/, rows: [entitlementRow()] },
      { match: /FROM academy_enrollments WHERE id/, rows: [enrollmentRow({ source: "admin" })] },
    ]);
    assert.equal((await commerce.handleWhopEvent("msg_Refund2", envelope("refund.updated", { status: "succeeded", payment: { id: PAYMENT } }))).outcome, "revoked");
    assert.equal(texts(executor.transactions[0]).some((t) => /UPDATE academy_enrollments/.test(t)), false);
  });

  test("a partial refund is recorded for review without changing access", async () => {
    const { executor, commerce } = service([
      { match: /FROM academy_payment_events WHERE/, rows: [] },
      { match: /academy_entitlements WHERE provider = 'whop' AND provider_payment_id/, rows: [entitlementRow()] },
    ]);
    assert.equal((await commerce.handleWhopEvent("msg_Refund3", envelope("refund.created", { status: "succeeded", amount: 10, payment: { id: PAYMENT, total: 50 } }))).outcome, "recorded");
    assert.equal(executor.transactions[0].length, 1);
  });

  test("an ended membership revokes; its return reinstates (a refund is never reinstated)", async () => {
    const ended = service([
      { match: /FROM academy_payment_events WHERE/, rows: [] },
      { match: /provider_membership_id/, rows: [entitlementRow()] },
      { match: /FROM academy_enrollments WHERE id/, rows: [enrollmentRow({ source: "entitlement" })] },
    ]);
    assert.equal((await ended.commerce.handleWhopEvent("msg_Mem1", envelope("membership.deactivated", { id: MEMBERSHIP, status: "canceled" }))).outcome, "revoked");
    const back = service([
      { match: /FROM academy_payment_events WHERE/, rows: [] },
      { match: /provider_membership_id/, rows: [entitlementRow({ state: "revoked", state_reason: "membership_ended", revoked_at: AT, revision: 2 })] },
      { match: /FROM academy_enrollments WHERE id/, rows: [enrollmentRow({ source: "entitlement", state: "suspended", revision: 2 })] },
    ]);
    assert.equal((await back.commerce.handleWhopEvent("msg_Mem2", envelope("membership.activated", { id: MEMBERSHIP, status: "active" }))).outcome, "reinstated");
    assert.ok(back.executor.transactions[0].some((s) => /UPDATE academy_enrollments/.test(s.text) && s.values.includes("active")));
    const refunded = service([
      { match: /FROM academy_payment_events WHERE/, rows: [] },
      { match: /provider_membership_id/, rows: [entitlementRow({ state: "revoked", state_reason: "refunded", revoked_at: AT, revision: 2 })] },
    ]);
    assert.equal((await refunded.commerce.handleWhopEvent("msg_Mem3", envelope("membership.activated", { id: MEMBERSHIP }))).outcome, "recorded");
  });

  test("unrelated event types are acknowledged and ignored", async () => {
    const { commerce } = service([]);
    assert.equal((await commerce.handleWhopEvent("msg_Other1", envelope("payout.created", { id: "po_1" }))).outcome, "ignored");
  });
});

describe("checkouts", () => {
  test("only learner accounts may open one", async () => {
    for (const user of [admin, teacher]) await rejectsForbidden(service(purchaseRules()).commerce.startCheckout(user, { offerId: OFFER }));
  });

  test("without a Whop key nothing is written and the learner is told no payment was taken", async () => {
    const { executor, commerce } = service(purchaseRules(), { configured: false, open: async () => assert.fail("must not call Whop") });
    await rejectsDomain(commerce.startCheckout(student, { offerId: OFFER }), "FEATURE_UNAVAILABLE");
    assert.equal(executor.transactions.length, 0);
  });

  test("a Whop failure marks the checkout failed at initialization", async () => {
    const { executor, commerce } = service(purchaseRules(), { configured: true, open: async () => { throw new Error("401"); } });
    await rejectsDomain(commerce.startCheckout(student, { offerId: OFFER }), "FEATURE_UNAVAILABLE");
    assert.equal(executor.transactions.length, 2);
    assert.ok(executor.transactions[1][0].values.includes("initialization"));
  });

  test("an opened checkout carries the server's metadata and returns only the Whop address", async () => {
    const calls: unknown[] = [];
    const { executor, commerce } = service(purchaseRules(), {
      configured: true,
      open: async (input) => {
        calls.push(input);
        return { providerCheckoutId: "ch_Test1234", purchaseUrl: "https://sandbox.whop.com/checkout/x" };
      },
    });
    const opened = await commerce.startCheckout(student, { offerId: OFFER });
    assert.equal(opened.purchaseUrl, "https://sandbox.whop.com/checkout/x");
    assert.deepEqual(calls, [{ planId: PLAN, checkoutId: opened.checkoutId, learnerUid: "student-1", offerId: OFFER }]);
    assert.ok(executor.transactions[1][0].values.includes("open"));
  });

  test("an enrolled learner cannot buy the same class again", async () => {
    const { commerce } = service(purchaseRules([{ match: /FROM academy_enrollments\s+WHERE class_group_id = \$1::uuid AND learner_uid/, rows: [enrollmentRow()] }]));
    await rejectsDomain(commerce.startCheckout(student, { offerId: OFFER }), "CONFLICT");
  });

  test("a learner cannot read another learner's checkout", async () => {
    const { commerce } = service(purchaseRules([{ match: /FROM academy_checkouts WHERE id/, rows: [checkoutRow({ learner_uid: "student-2" })] }]));
    await rejectsDomain(commerce.checkoutStatus(student, CHECKOUT), "NOT_FOUND");
  });
});

describe("public offers", () => {
  // Found live: date columns arrive as Date objects unless cast, and the public course page failed with a 500.
  test("the public offers query reads class dates as text, like every other academy query", () => {
    const query = listPublicOffersQuery("nahw-1");
    assert.match(query.text, /cg\.starts_on::text AS starts_on, cg\.ends_on::text AS ends_on/);
    assert.doesNotMatch(query.text, /provider_plan_id/, "plan ids never reach the public page");
  });
});
