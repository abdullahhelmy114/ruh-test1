/**
 * Academy commerce: buying a place in a class group through Whop.
 *
 *   Offer        an administrator's explicit mapping: one Whop plan -> one
 *                class group of one course. The plan id is the identity;
 *                titles never are, so renaming anything changes nothing.
 *   Checkout     opened by the server for one learner and one offer. Its id,
 *                the learner and the offer travel to Whop as metadata and
 *                come back on the payment; the browser never supplies them.
 *   Entitlement  access bought by one verified Whop payment: the enrollment it
 *                opened (source 'entitlement') and the Whop payment,
 *                membership and user it came from.
 *
 * Access follows only signed Whop events processed on the server:
 *   payment.succeeded      -> grant (open or activate the enrollment)
 *   payment.failed         -> the checkout fails; nothing is granted
 *   refund (succeeded)     -> revoke; a refund smaller than the payment is
 *                             recorded for review without changing access
 *   membership.deactivated -> revoke
 *   membership.activated   -> reinstate what a membership end revoked
 * Revoking suspends the enrollment only when the entitlement opened it; an
 * enrollment an administrator created is never changed by a payment event.
 *
 * Pure module: no I/O. The service persists what these functions plan.
 */
import type { AuditEventInput } from "../audit/audit.ts";
import { DomainError, requireReason } from "../domain/errors.ts";
import { defaultIdGenerator, isUuid, parseUid, parseUuid, systemClock, toIso } from "../domain/ids.ts";
import type { EnrollmentState } from "../domain/states.ts";
import { assertRevision, parseRequiredRevision, parseTitle } from "../domain/text.ts";
import type { Planned, StructureContext } from "../structure/catalog.ts";
import {
  planEnroll,
  planEnrollmentStatus,
  type ClassGroupRecord,
  type EnrollmentRecord,
  type ProfileFacts,
} from "../structure/delivery.ts";

export const PAYMENT_PROVIDER = "whop" as const;

/** The actor recorded for changes made by verified Whop events. */
export const WHOP_EVENT_ACTOR = Object.freeze({ uid: "system:whop", role: "system" as const });

const PLAN_ID = /^plan_[A-Za-z0-9]{1,64}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{1,64}$/;
const MEMBERSHIP_ID = /^mem_[A-Za-z0-9]{1,64}$/;
const USER_ID = /^user_[A-Za-z0-9]{1,64}$/;

function now(ctx: StructureContext): string {
  return toIso((ctx.clock ?? systemClock)());
}

function newId(ctx: StructureContext): string {
  return (ctx.newId ?? defaultIdGenerator)();
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export const OFFER_STATES = ["active", "retired"] as const;
export type OfferState = (typeof OFFER_STATES)[number];

export interface OfferRecord {
  readonly id: string;
  readonly courseId: string;
  readonly classGroupId: string;
  readonly provider: typeof PAYMENT_PROVIDER;
  readonly providerPlanId: string;
  readonly label: string;
  readonly state: OfferState;
  readonly stateReason: string | null;
  readonly revision: number;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export const CHECKOUT_STATES = ["created", "open", "completed", "failed"] as const;
export type CheckoutState = (typeof CHECKOUT_STATES)[number];
export type CheckoutFailure = "initialization" | "payment_failed" | "mismatch" | "not_enrollable";

export interface CheckoutRecord {
  readonly id: string;
  readonly offerId: string;
  readonly learnerUid: string;
  readonly provider: typeof PAYMENT_PROVIDER;
  readonly providerCheckoutId: string | null;
  readonly purchaseUrl: string | null;
  readonly state: CheckoutState;
  readonly failure: CheckoutFailure | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type EntitlementState = "active" | "revoked";
export type RevokeReason = "refunded" | "membership_ended";

export interface EntitlementRecord {
  readonly id: string;
  readonly learnerUid: string;
  readonly offerId: string;
  readonly courseId: string;
  readonly classGroupId: string;
  readonly enrollmentId: string;
  readonly checkoutId: string;
  readonly provider: typeof PAYMENT_PROVIDER;
  readonly providerPaymentId: string;
  readonly providerMembershipId: string | null;
  readonly providerUserId: string | null;
  readonly state: EntitlementState;
  readonly stateReason: RevokeReason | null;
  readonly revision: number;
  readonly grantedAt: string;
  readonly updatedAt: string;
  readonly revokedAt: string | null;
}

function liveGroup(group: ClassGroupRecord | null): group is ClassGroupRecord {
  return group !== null && group.deletedAt === null && (group.status === "planned" || group.status === "active");
}

// ---------------------------------------------------------------------------
// Offers (administrators)
// ---------------------------------------------------------------------------

export function parsePlanId(value: unknown): string {
  const plan = typeof value === "string" ? value.trim() : "";
  if (!PLAN_ID.test(plan)) throw new DomainError("VALIDATION", "Enter the Whop plan id exactly as Whop shows it (plan_...).");
  return plan;
}

export function planCreateOffer(
  input: { readonly courseId: string; readonly classGroup: ClassGroupRecord | null; readonly planId: unknown; readonly label: unknown },
  ctx: StructureContext,
): Planned<OfferRecord> {
  if (!input.classGroup || input.classGroup.deletedAt !== null || input.classGroup.courseId !== input.courseId) {
    throw new DomainError("NOT_FOUND", "Class group not found in this course.");
  }
  if (!liveGroup(input.classGroup)) throw new DomainError("CONFLICT", "Only a planned or active class group can be sold.");
  const at = now(ctx);
  const actor = parseUid(ctx.actor.uid, "actor");
  const record: OfferRecord = Object.freeze({
    id: newId(ctx),
    courseId: input.courseId,
    classGroupId: input.classGroup.id,
    provider: PAYMENT_PROVIDER,
    providerPlanId: parsePlanId(input.planId),
    label: parseTitle(input.label, "label"),
    state: "active",
    stateReason: null,
    revision: 1,
    createdBy: actor,
    createdAt: at,
    updatedBy: actor,
    updatedAt: at,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "offer.create",
      object: { kind: "offer", id: record.id },
      correlationId: ctx.correlationId ?? null,
      changedRelationships: [{ change: "linked", relationship: "class_group_offers", from: { kind: "class_group", id: record.classGroupId }, to: { kind: "offer", id: record.id } }],
      metadata: { courseId: record.courseId, provider: record.provider, providerPlanId: record.providerPlanId },
    },
  };
}

export function planRetireOffer(offer: OfferRecord, input: { readonly reason: unknown; readonly expectedRevision: unknown }, ctx: StructureContext): Planned<OfferRecord> {
  assertRevision(offer.revision, parseRequiredRevision(input.expectedRevision));
  if (offer.state === "retired") throw new DomainError("CONFLICT", "This offer is already retired.");
  const reason = requireReason(input.reason);
  const record: OfferRecord = Object.freeze({
    ...offer,
    state: "retired",
    stateReason: reason,
    revision: offer.revision + 1,
    updatedBy: parseUid(ctx.actor.uid, "actor"),
    updatedAt: now(ctx),
  });
  return {
    record,
    audit: { actor: ctx.actor, action: "offer.retire", object: { kind: "offer", id: offer.id }, reason, correlationId: ctx.correlationId ?? null, metadata: { revision: record.revision } },
  };
}

// ---------------------------------------------------------------------------
// Checkouts (learners)
// ---------------------------------------------------------------------------

export function planOpenCheckout(
  input: {
    readonly offer: OfferRecord | null;
    readonly classGroup: ClassGroupRecord | null;
    readonly learner: ProfileFacts | null;
    readonly learnerHasOpenEnrollment: boolean;
    readonly learnerHasActiveEntitlement: boolean;
    readonly seatsTaken: number;
  },
  ctx: StructureContext,
): Planned<CheckoutRecord> {
  if (!input.offer || input.offer.state !== "active") throw new DomainError("NOT_FOUND", "This offer is not available.");
  if (!input.learner || input.learner.role !== "student" || (input.learner.status !== null && input.learner.status !== "active")) {
    throw new DomainError("CONFLICT", "Only an active learner account can buy a place in a class.");
  }
  if (!liveGroup(input.classGroup)) throw new DomainError("CONFLICT", "This class is no longer open for enrollment.");
  if (input.learnerHasOpenEnrollment || input.learnerHasActiveEntitlement) {
    throw new DomainError("CONFLICT", "You are already enrolled in this class.");
  }
  if (input.classGroup.capacity !== null && input.seatsTaken >= input.classGroup.capacity) throw new DomainError("CONFLICT", "This class is full.");
  const at = now(ctx);
  const record: CheckoutRecord = Object.freeze({
    id: newId(ctx),
    offerId: input.offer.id,
    learnerUid: parseUid(input.learner.uid, "learner"),
    provider: PAYMENT_PROVIDER,
    providerCheckoutId: null,
    purchaseUrl: null,
    state: "created",
    failure: null,
    createdAt: at,
    updatedAt: at,
  });
  return {
    record,
    audit: {
      actor: ctx.actor,
      action: "checkout.open",
      object: { kind: "checkout", id: record.id },
      correlationId: ctx.correlationId ?? null,
      metadata: { offerId: record.offerId, provider: record.provider },
    },
  };
}

export function checkoutOpened(checkout: CheckoutRecord, opened: { readonly providerCheckoutId: string; readonly purchaseUrl: string }, ctx: StructureContext): CheckoutRecord {
  return Object.freeze({ ...checkout, state: "open", providerCheckoutId: opened.providerCheckoutId, purchaseUrl: opened.purchaseUrl, updatedAt: now(ctx) });
}

export function checkoutFailed(checkout: CheckoutRecord, failure: CheckoutFailure, ctx: StructureContext): CheckoutRecord {
  return Object.freeze({ ...checkout, state: "failed", failure, updatedAt: now(ctx) });
}

// ---------------------------------------------------------------------------
// Reading Whop events (legacy and current payload shapes)
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

/** An id that is either a string field (current shape: `plan_id`) or an embedded object's id (legacy: `plan.id`). */
function idOf(data: Json, name: string, pattern: RegExp): string | null {
  const direct = data[`${name}_id`];
  const embedded = asObject(data[name])?.id;
  for (const candidate of [direct, embedded]) {
    if (typeof candidate === "string" && pattern.test(candidate)) return candidate;
  }
  return null;
}

/** A money amount: a bare number (legacy) or { amount } (current). */
function amountOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const amount = asObject(value)?.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) return amount;
  if (typeof amount === "string" && /^\d+(\.\d+)?$/.test(amount)) return Number(amount);
  return null;
}

export interface WhopEnvelope {
  readonly type: string;
  readonly data: Json;
}

export function readWhopEnvelope(parsed: unknown): WhopEnvelope {
  const envelope = asObject(parsed);
  const type = envelope?.type;
  const data = asObject(envelope?.data);
  if (typeof type !== "string" || !/^[a-z_]+(\.[a-z_]+)+$/.test(type) || type.length > 100 || !data) {
    throw new DomainError("VALIDATION", "Malformed Whop event.");
  }
  return { type, data };
}

export interface PaymentFacts {
  readonly paymentId: string;
  readonly status: string | null;
  readonly substatus: string | null;
  readonly planId: string | null;
  readonly membershipId: string | null;
  readonly userId: string | null;
  readonly checkoutId: string | null;
  readonly learnerUid: string | null;
  readonly offerId: string | null;
}

export function readPayment(data: Json): PaymentFacts {
  const paymentId = typeof data.id === "string" && PAYMENT_ID.test(data.id) ? data.id : null;
  if (!paymentId) throw new DomainError("VALIDATION", "The payment has no valid id.");
  const metadata = asObject(data.metadata) ?? {};
  const text = (value: unknown) => (typeof value === "string" && value.length <= 200 ? value : null);
  return {
    paymentId,
    status: text(data.status),
    substatus: text(data.substatus),
    planId: idOf(data, "plan", PLAN_ID),
    membershipId: idOf(data, "membership", MEMBERSHIP_ID),
    userId: idOf(data, "user", USER_ID),
    checkoutId: isUuid(metadata.academy_checkout_id) ? metadata.academy_checkout_id : null,
    learnerUid: text(metadata.academy_learner_uid),
    offerId: isUuid(metadata.academy_offer_id) ? metadata.academy_offer_id : null,
  };
}

export interface RefundFacts {
  readonly paymentId: string | null;
  readonly status: string | null;
  readonly amount: number | null;
  readonly paymentTotal: number | null;
}

export function readRefund(data: Json): RefundFacts {
  const payment = asObject(data.payment);
  return {
    paymentId: idOf(data, "payment", PAYMENT_ID),
    status: typeof data.status === "string" ? data.status : null,
    amount: amountOf(data.amount),
    paymentTotal: payment ? amountOf(payment.total) : null,
  };
}

export interface MembershipFacts {
  readonly membershipId: string;
  readonly status: string | null;
}

export function readMembership(data: Json): MembershipFacts {
  const membershipId = typeof data.id === "string" && MEMBERSHIP_ID.test(data.id) ? data.id : null;
  if (!membershipId) throw new DomainError("VALIDATION", "The membership has no valid id.");
  return { membershipId, status: typeof data.status === "string" ? data.status : null };
}

// ---------------------------------------------------------------------------
// Decisions on verified events
// ---------------------------------------------------------------------------

export type EventOutcome = "granted" | "revoked" | "reinstated" | "recorded" | "ignored" | "held";

/** Payment statuses Whop reports for money actually taken. */
const PAID = new Set(["paid", "succeeded"]);

export type GrantDecision =
  | { readonly kind: "ignored"; readonly detail: string }
  | { readonly kind: "recorded"; readonly detail: string }
  | { readonly kind: "held"; readonly detail: string; readonly failure: CheckoutFailure | null }
  | { readonly kind: "grant"; readonly enrollment: { readonly mode: "create" } | { readonly mode: "reuse" | "activate"; readonly record: EnrollmentRecord } };

/**
 * What a signed payment.succeeded may do. Access is granted only when the
 * payment carries the checkout the server opened, for the same learner and
 * offer, for the offer's own Whop plan — so an event for another product, or
 * one pointing at another learner's checkout, grants nothing.
 */
export function decidePaymentSucceeded(input: {
  readonly payment: PaymentFacts;
  readonly checkout: CheckoutRecord | null;
  readonly offer: OfferRecord | null;
  readonly classGroup: ClassGroupRecord | null;
  readonly learner: ProfileFacts | null;
  readonly openEnrollment: EnrollmentRecord | null;
  readonly paymentAlreadyGranted: boolean;
  readonly checkoutAlreadyGranted: boolean;
}): GrantDecision {
  const { payment } = input;
  if (payment.status !== null && !PAID.has(payment.status) && !(payment.substatus !== null && PAID.has(payment.substatus))) {
    return { kind: "ignored", detail: `payment status ${payment.status}` };
  }
  if (!payment.checkoutId) return { kind: "ignored", detail: "not an academy checkout" };
  if (!input.checkout) return { kind: "ignored", detail: "unknown academy checkout" };
  if (input.paymentAlreadyGranted || input.checkoutAlreadyGranted) return { kind: "recorded", detail: "already granted" };
  if (payment.learnerUid !== input.checkout.learnerUid || payment.offerId !== input.checkout.offerId) {
    return { kind: "held", detail: "payment metadata does not match the checkout", failure: "mismatch" };
  }
  if (!input.offer || input.offer.id !== input.checkout.offerId) return { kind: "held", detail: "offer not found", failure: "mismatch" };
  if (payment.planId !== input.offer.providerPlanId) return { kind: "held", detail: "payment is for a different Whop plan", failure: "mismatch" };
  if (!input.learner || input.learner.uid !== input.checkout.learnerUid || input.learner.role !== "student" || (input.learner.status !== null && input.learner.status !== "active")) {
    return { kind: "held", detail: "learner account cannot be enrolled", failure: "not_enrollable" };
  }
  if (!liveGroup(input.classGroup) || input.classGroup.id !== input.offer.classGroupId) {
    return { kind: "held", detail: "class group is no longer open", failure: "not_enrollable" };
  }
  const open = input.openEnrollment;
  if (!open) return { kind: "grant", enrollment: { mode: "create" } };
  if (open.state === "active") return { kind: "grant", enrollment: { mode: "reuse", record: open } };
  if (open.state === "pending") return { kind: "grant", enrollment: { mode: "activate", record: open } };
  return { kind: "held", detail: "the learner's enrollment is suspended; an administrator decides", failure: "not_enrollable" };
}

export interface GrantPlan {
  readonly enrollment: Planned<EnrollmentRecord> | null;
  readonly enrollmentId: string;
  readonly previousEnrollment: EnrollmentRecord | null;
  readonly entitlement: Planned<EntitlementRecord>;
  readonly checkout: CheckoutRecord;
}

export function planGrant(
  decision: Extract<GrantDecision, { kind: "grant" }>,
  input: {
    readonly payment: PaymentFacts;
    readonly checkout: CheckoutRecord;
    readonly offer: OfferRecord;
    readonly classGroup: ClassGroupRecord;
    readonly learner: ProfileFacts;
    readonly openEnrollmentsInGroup: readonly Pick<EnrollmentRecord, "learnerUid" | "state">[];
  },
  ctx: StructureContext,
): GrantPlan {
  let enrollment: Planned<EnrollmentRecord> | null = null;
  let previousEnrollment: EnrollmentRecord | null = null;
  let enrollmentId: string;
  if (decision.enrollment.mode === "create") {
    enrollment = planEnroll(
      { classGroup: input.classGroup, learner: input.learner, openEnrollmentsInGroup: input.openEnrollmentsInGroup, activate: true, source: "entitlement" },
      ctx,
    );
    enrollmentId = enrollment.record.id;
  } else if (decision.enrollment.mode === "activate") {
    previousEnrollment = decision.enrollment.record;
    enrollment = planEnrollmentStatus(previousEnrollment, { to: "active", expectedRevision: previousEnrollment.revision }, ctx);
    enrollmentId = previousEnrollment.id;
  } else {
    enrollmentId = decision.enrollment.record.id;
  }
  const at = now(ctx);
  const record: EntitlementRecord = Object.freeze({
    id: newId(ctx),
    learnerUid: input.checkout.learnerUid,
    offerId: input.offer.id,
    courseId: input.offer.courseId,
    classGroupId: input.offer.classGroupId,
    enrollmentId,
    checkoutId: input.checkout.id,
    provider: PAYMENT_PROVIDER,
    providerPaymentId: input.payment.paymentId,
    providerMembershipId: input.payment.membershipId,
    providerUserId: input.payment.userId,
    state: "active",
    stateReason: null,
    revision: 1,
    grantedAt: at,
    updatedAt: at,
    revokedAt: null,
  });
  const audit: AuditEventInput = {
    actor: ctx.actor,
    action: "entitlement.grant",
    object: { kind: "entitlement", id: record.id },
    correlationId: ctx.correlationId ?? null,
    changedRelationships: [{ change: "linked", relationship: "entitlement_enrollment", from: { kind: "entitlement", id: record.id }, to: { kind: "enrollment", id: enrollmentId } }],
    metadata: { offerId: record.offerId, checkoutId: record.checkoutId, provider: record.provider, providerPaymentId: record.providerPaymentId, enrollment: decision.enrollment.mode },
  };
  return { enrollment, enrollmentId, previousEnrollment, entitlement: { record, audit }, checkout: Object.freeze({ ...input.checkout, state: "completed", failure: null, updatedAt: at }) };
}

/** A refund ends access when it succeeded and covers the payment; a smaller refund is recorded for review. */
export function refundEndsAccess(refund: RefundFacts): { readonly ends: boolean; readonly detail: string } {
  if (refund.status !== null && refund.status !== "succeeded") return { ends: false, detail: `refund status ${refund.status}` };
  if (refund.amount !== null && refund.paymentTotal !== null && refund.amount < refund.paymentTotal) {
    return { ends: false, detail: "partial refund recorded for review" };
  }
  return { ends: true, detail: "refund succeeded" };
}

export interface AccessChangePlan {
  readonly entitlement: Planned<EntitlementRecord>;
  readonly previous: EntitlementRecord;
  readonly enrollment: Planned<EnrollmentRecord> | null;
  readonly previousEnrollment: EnrollmentRecord | null;
}

const ENROLLMENT_SUSPEND_REASON: Record<RevokeReason, string> = {
  refunded: "Whop payment refunded.",
  membership_ended: "Whop membership ended.",
};

/** Revokes an active entitlement; suspends the enrollment only if this entitlement opened it and it is active. */
export function planRevokeEntitlement(
  entitlement: EntitlementRecord,
  reason: RevokeReason,
  enrollment: EnrollmentRecord | null,
  ctx: StructureContext,
): AccessChangePlan | null {
  if (entitlement.state !== "active") return null;
  const at = now(ctx);
  const record: EntitlementRecord = Object.freeze({ ...entitlement, state: "revoked", stateReason: reason, revision: entitlement.revision + 1, updatedAt: at, revokedAt: at });
  const suspend = enrollment !== null && enrollment.source === "entitlement" && enrollment.state === "active";
  return {
    previous: entitlement,
    entitlement: {
      record,
      audit: { actor: ctx.actor, action: "entitlement.revoke", object: { kind: "entitlement", id: entitlement.id }, reason: ENROLLMENT_SUSPEND_REASON[reason], correlationId: ctx.correlationId ?? null, metadata: { reason, enrollmentSuspended: suspend } },
    },
    previousEnrollment: suspend ? enrollment : null,
    enrollment: suspend ? planEnrollmentStatus(enrollment, { to: "suspended", reason: ENROLLMENT_SUSPEND_REASON[reason], expectedRevision: enrollment.revision }, ctx) : null,
  };
}

/** Reinstates access that an ended membership revoked (never a refund). */
export function planReinstateEntitlement(entitlement: EntitlementRecord, enrollment: EnrollmentRecord | null, ctx: StructureContext): AccessChangePlan | null {
  if (entitlement.state !== "revoked" || entitlement.stateReason !== "membership_ended") return null;
  const at = now(ctx);
  const record: EntitlementRecord = Object.freeze({ ...entitlement, state: "active", stateReason: null, revision: entitlement.revision + 1, updatedAt: at, revokedAt: null });
  const resume = enrollment !== null && enrollment.source === "entitlement" && enrollment.state === ("suspended" satisfies EnrollmentState);
  return {
    previous: entitlement,
    entitlement: {
      record,
      audit: { actor: ctx.actor, action: "entitlement.reinstate", object: { kind: "entitlement", id: entitlement.id }, correlationId: ctx.correlationId ?? null, metadata: { enrollmentResumed: resume } },
    },
    previousEnrollment: resume ? enrollment : null,
    enrollment: resume ? planEnrollmentStatus(enrollment, { to: "active", expectedRevision: enrollment.revision }, ctx) : null,
  };
}

export function parseCheckoutId(value: unknown): string {
  return parseUuid(value, "checkoutId");
}
