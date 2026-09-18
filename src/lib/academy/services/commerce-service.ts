/**
 * Academy commerce service: offers (administrators), checkouts (learners) and
 * the processing of signed Whop events (entitlements).
 *
 * The browser can open a checkout and read its state; it can never make the
 * academy believe a payment happened. Access changes only in
 * handleWhopEvent, which the webhook route calls after verifying Whop's
 * signature, and every event is processed once: its delivery id is recorded
 * in the same transaction as its effect.
 */
import { AuthError, type AuthUser } from "../../auth/core.ts";
import {
  checkoutFailed,
  checkoutOpened,
  decidePaymentSucceeded,
  parseCheckoutId,
  planCreateOffer,
  planGrant,
  planOpenCheckout,
  planReinstateEntitlement,
  planRetireOffer,
  planRevokeEntitlement,
  readMembership,
  readPayment,
  readRefund,
  refundEndsAccess,
  WHOP_EVENT_ACTOR,
  type AccessChangePlan,
  type CheckoutRecord,
  type EntitlementRecord,
  type EventOutcome,
  type OfferRecord,
  type WhopEnvelope,
} from "../commerce/commerce.ts";
import { DomainError } from "../domain/errors.ts";
import { parseUuid, systemClock, toIso } from "../domain/ids.ts";
import { assertAcademyCoreAvailable } from "../infra/flags.ts";
import type { SqlQuery } from "../infra/sql.ts";
import { authorizeAdminAction } from "../permissions/permissions.ts";
import { expectRows } from "../repo/audit-repo.ts";
import { mapCourseRow, selectCourseQuery } from "../repo/catalog-repo.ts";
import {
  countOpenSeatsQuery,
  insertCheckoutQuery,
  insertEntitlementQuery,
  insertOfferQuery,
  insertPaymentEventQuery,
  listCourseOffersQuery,
  listEntitlementsByMembershipQuery,
  listPublicOffersQuery,
  mapCheckoutRow,
  mapEntitlementRow,
  mapOfferRow,
  selectActiveEntitlementForClassGroupQuery,
  selectCheckoutQuery,
  selectEntitlementByCheckoutQuery,
  selectEntitlementByPaymentQuery,
  selectLearnerOpenEnrollmentQuery,
  selectOfferQuery,
  selectPaymentEventQuery,
  updateCheckoutQuery,
  updateEntitlementQuery,
  updateOfferStateQuery,
} from "../repo/commerce-repo.ts";
import {
  insertEnrollmentQuery,
  lockClassGroupQuery,
  mapClassGroupRow,
  mapEnrollmentRow,
  selectClassGroupQuery,
  selectEnrollmentQuery,
  selectOpenEnrollmentsQuery,
  updateEnrollmentQuery,
} from "../repo/delivery-repo.ts";
import { mapProfileFacts, selectProfileFactsQuery } from "../repo/profile-repo.ts";
import { num, str, strOrNull } from "../repo/rows.ts";
import { parsePublicSlug } from "../public/catalog.ts";
import type { StructureContext } from "../structure/catalog.ts";
import type { ClassGroupRecord, EnrollmentRecord } from "../structure/delivery.ts";
import { audited, contextFor, loadMany, loadOptional, loadRequired, runGuarded, type ServiceDeps } from "./support.ts";

/** Opens a checkout with the payment provider (Whop). Injected so tests never reach the network. */
export interface CheckoutGateway {
  readonly configured: boolean;
  open(input: { readonly planId: string; readonly checkoutId: string; readonly learnerUid: string; readonly offerId: string }): Promise<{
    readonly providerCheckoutId: string;
    readonly purchaseUrl: string;
  }>;
}

export interface CommerceDeps extends ServiceDeps {
  readonly gateway: CheckoutGateway;
}

type Correlated = { readonly correlationId?: string | null };

export interface EventResult {
  readonly outcome: EventOutcome | "duplicate";
  readonly detail: string | null;
}

export interface CheckoutView {
  readonly id: string;
  readonly state: CheckoutRecord["state"];
  readonly failure: CheckoutRecord["failure"];
  readonly classGroupId: string | null;
  readonly entitlement: { readonly state: EntitlementRecord["state"]; readonly stateReason: EntitlementRecord["stateReason"] } | null;
}

export function createCommerceService(deps: CommerceDeps) {
  const { executor } = deps;

  function eventContext(): StructureContext {
    return { actor: WHOP_EVENT_ACTOR, clock: deps.clock, newId: deps.newId, correlationId: null };
  }

  function receivedAt(): string {
    return toIso((deps.clock ?? systemClock)());
  }

  async function loadClassGroup(id: string): Promise<ClassGroupRecord | null> {
    return loadOptional(executor, selectClassGroupQuery(id), mapClassGroupRow);
  }

  async function loadOffer(id: unknown): Promise<OfferRecord> {
    return loadRequired(executor, selectOfferQuery(parseUuid(id, "offerId")), mapOfferRow, "Offer not found.");
  }

  /** Records the event and applies its effect in one transaction; a concurrent duplicate rolls back and reads as a duplicate. */
  async function commit(event: { eventId: string; eventType: string; resourceId: string | null }, outcome: EventOutcome, detail: string | null, effects: readonly SqlQuery[]): Promise<EventResult> {
    const record = insertPaymentEventQuery({ ...event, outcome, detail, receivedAt: receivedAt() });
    try {
      await runGuarded(executor, [record, ...effects], { unique: "duplicate-event" });
    } catch (error) {
      if (error instanceof DomainError && error.message === "duplicate-event") {
        const seen = await executor.query(selectPaymentEventQuery(event.eventId));
        if (seen.length > 0) return { outcome: "duplicate", detail: null };
      }
      throw error;
    }
    return { outcome, detail };
  }

  function accessChangeStatements(plan: AccessChangePlan): SqlQuery[] {
    const statements: SqlQuery[] = [audited(deps, updateEntitlementQuery(plan.entitlement.record, plan.previous.revision), plan.entitlement.audit)];
    if (plan.enrollment && plan.previousEnrollment) {
      statements.push(audited(deps, updateEnrollmentQuery(plan.enrollment.record, plan.previousEnrollment), plan.enrollment.audit));
    }
    return statements;
  }

  async function enrollmentOf(entitlement: EntitlementRecord): Promise<EnrollmentRecord | null> {
    return loadOptional(executor, selectEnrollmentQuery(entitlement.enrollmentId), mapEnrollmentRow);
  }

  // -- event handlers -------------------------------------------------------

  async function onPaymentSucceeded(event: { eventId: string; eventType: string }, envelope: WhopEnvelope): Promise<EventResult> {
    const payment = readPayment(envelope.data);
    const ref = { ...event, resourceId: payment.paymentId };
    const checkout = payment.checkoutId ? await loadOptional(executor, selectCheckoutQuery(payment.checkoutId), mapCheckoutRow) : null;
    const offer = checkout ? await loadOptional(executor, selectOfferQuery(checkout.offerId), mapOfferRow) : null;
    const [classGroup, learnerRows, paymentGrant, checkoutGrant] = await Promise.all([
      offer ? loadClassGroup(offer.classGroupId) : Promise.resolve(null),
      checkout ? executor.query(selectProfileFactsQuery(checkout.learnerUid)) : Promise.resolve([]),
      loadOptional(executor, selectEntitlementByPaymentQuery(payment.paymentId), mapEntitlementRow),
      checkout ? loadOptional(executor, selectEntitlementByCheckoutQuery(checkout.id), mapEntitlementRow) : Promise.resolve(null),
    ]);
    const learner = mapProfileFacts(learnerRows[0]);
    const openEnrollment = checkout && offer ? await loadOptional(executor, selectLearnerOpenEnrollmentQuery(offer.classGroupId, checkout.learnerUid), mapEnrollmentRow) : null;
    const decision = decidePaymentSucceeded({
      payment,
      checkout,
      offer,
      classGroup,
      learner,
      openEnrollment,
      paymentAlreadyGranted: paymentGrant !== null,
      checkoutAlreadyGranted: checkoutGrant !== null,
    });
    if (decision.kind === "ignored" || decision.kind === "recorded") return commit(ref, decision.kind, decision.detail, []);
    if (decision.kind === "held") {
      const effects: SqlQuery[] = [];
      if (checkout && decision.failure && (checkout.state === "created" || checkout.state === "open")) {
        effects.push(expectRows(updateCheckoutQuery(checkoutFailed(checkout, decision.failure, eventContext()), checkout.state), 1));
      }
      return commit(ref, "held", decision.detail, effects);
    }
    // grant
    const open = (await executor.query(selectOpenEnrollmentsQuery(classGroup!.id))).map((row) => ({
      learnerUid: String(row.learner_uid),
      state: row.state as EnrollmentRecord["state"],
    }));
    let plan: ReturnType<typeof planGrant>;
    try {
      plan = planGrant(decision, { payment, checkout: checkout!, offer: offer!, classGroup: classGroup!, learner: learner!, openEnrollmentsInGroup: open }, eventContext());
    } catch (error) {
      // Paid but not enrollable any more (for example the class filled up meanwhile): record it for an
      // administrator to resolve instead of failing the delivery forever.
      if (!(error instanceof DomainError)) throw error;
      return commit(ref, "held", error.message.slice(0, 200), [
        expectRows(updateCheckoutQuery(checkoutFailed(checkout!, "not_enrollable", eventContext()), checkout!.state), 1),
      ]);
    }
    const effects: SqlQuery[] = [lockClassGroupQuery(classGroup!.id)];
    if (plan.enrollment && !plan.previousEnrollment) effects.push(audited(deps, insertEnrollmentQuery(plan.enrollment.record), plan.enrollment.audit));
    if (plan.enrollment && plan.previousEnrollment) effects.push(audited(deps, updateEnrollmentQuery(plan.enrollment.record, plan.previousEnrollment), plan.enrollment.audit));
    effects.push(audited(deps, insertEntitlementQuery(plan.entitlement.record), plan.entitlement.audit));
    effects.push(expectRows(updateCheckoutQuery(plan.checkout, checkout!.state), 1));
    return commit(ref, "granted", `enrollment ${decision.enrollment.mode}`, effects);
  }

  async function onPaymentFailed(event: { eventId: string; eventType: string }, envelope: WhopEnvelope): Promise<EventResult> {
    const payment = readPayment(envelope.data);
    const ref = { ...event, resourceId: payment.paymentId };
    const checkout = payment.checkoutId ? await loadOptional(executor, selectCheckoutQuery(payment.checkoutId), mapCheckoutRow) : null;
    if (!checkout) return commit(ref, "ignored", "not an academy checkout", []);
    if (checkout.state !== "created" && checkout.state !== "open") return commit(ref, "recorded", `checkout already ${checkout.state}`, []);
    return commit(ref, "recorded", "payment failed; nothing granted", [
      expectRows(updateCheckoutQuery(checkoutFailed(checkout, "payment_failed", eventContext()), checkout.state), 1),
    ]);
  }

  async function onRefund(event: { eventId: string; eventType: string }, envelope: WhopEnvelope): Promise<EventResult> {
    const refund = readRefund(envelope.data);
    const ref = { ...event, resourceId: refund.paymentId };
    if (!refund.paymentId) return commit(ref, "ignored", "refund without a payment", []);
    const entitlement = await loadOptional(executor, selectEntitlementByPaymentQuery(refund.paymentId), mapEntitlementRow);
    if (!entitlement) return commit(ref, "ignored", "no academy entitlement for this payment", []);
    const verdict = refundEndsAccess(refund);
    if (!verdict.ends) return commit(ref, "recorded", verdict.detail, []);
    const plan = planRevokeEntitlement(entitlement, "refunded", await enrollmentOf(entitlement), eventContext());
    if (!plan) return commit(ref, "recorded", `entitlement already ${entitlement.state}`, []);
    return commit(ref, "revoked", "refund succeeded", accessChangeStatements(plan));
  }

  async function onMembership(event: { eventId: string; eventType: string }, envelope: WhopEnvelope, active: boolean): Promise<EventResult> {
    const membership = readMembership(envelope.data);
    const ref = { ...event, resourceId: membership.membershipId };
    const entitlements = await loadMany(executor, listEntitlementsByMembershipQuery(membership.membershipId), mapEntitlementRow);
    if (entitlements.length === 0) return commit(ref, "recorded", "no academy entitlement for this membership yet", []);
    const statements: SqlQuery[] = [];
    for (const entitlement of entitlements) {
      const enrollment = await enrollmentOf(entitlement);
      const plan = active ? planReinstateEntitlement(entitlement, enrollment, eventContext()) : planRevokeEntitlement(entitlement, "membership_ended", enrollment, eventContext());
      if (plan) statements.push(...accessChangeStatements(plan));
    }
    if (statements.length === 0) return commit(ref, "recorded", active ? "nothing to reinstate" : "nothing active to revoke", []);
    return commit(ref, active ? "reinstated" : "revoked", active ? "membership active again" : "membership ended", statements);
  }

  return {
    // -- administrators ------------------------------------------------------

    async listOffers(user: AuthUser, courseId: unknown): Promise<OfferRecord[]> {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "catalog.manage");
      const course = await loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
      return loadMany(executor, listCourseOffersQuery(course.id), mapOfferRow);
    },

    async createOffer(user: AuthUser, courseId: unknown, input: Correlated & { readonly classGroupId: unknown; readonly planId: unknown; readonly label: unknown }): Promise<OfferRecord> {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "catalog.manage");
      const course = await loadRequired(executor, selectCourseQuery(parseUuid(courseId, "courseId")), mapCourseRow, "Course not found.");
      if (course.deletedAt !== null) throw new DomainError("NOT_FOUND", "Course not found.");
      const classGroup = await loadClassGroup(parseUuid(input.classGroupId, "classGroupId"));
      const plan = planCreateOffer({ courseId: course.id, classGroup, planId: input.planId, label: input.label }, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, insertOfferQuery(plan.record), plan.audit)], { unique: "This Whop plan is already sold through another active offer." });
      return plan.record;
    },

    async retireOffer(user: AuthUser, offerId: unknown, input: Correlated & { readonly reason: unknown; readonly expectedRevision: unknown }): Promise<OfferRecord> {
      assertAcademyCoreAvailable(deps.flags);
      authorizeAdminAction(user, "catalog.manage");
      const offer = await loadOffer(offerId);
      const plan = planRetireOffer(offer, input, contextFor(user, deps, input.correlationId));
      await runGuarded(executor, [audited(deps, updateOfferStateQuery(plan.record, offer.revision), plan.audit)]);
      return plan.record;
    },

    // -- public ----------------------------------------------------------------

    /** What a public course page may offer for sale: labels and class groups only. */
    async publicOffers(slugInput: unknown) {
      assertAcademyCoreAvailable(deps.flags);
      const rows = await executor.query(listPublicOffersQuery(parsePublicSlug(slugInput)));
      return rows.map((row) => ({
        offerId: str(row.id),
        label: str(row.label),
        classGroupName: str(row.class_group_name),
        startsOn: strOrNull(row.starts_on),
        endsOn: strOrNull(row.ends_on),
        availability: row.is_full === true ? ("full" as const) : ("open" as const),
      }));
    },

    // -- learners --------------------------------------------------------------

    /** Opens a Whop checkout for the signed-in learner. Returns where to send the browser. */
    async startCheckout(user: AuthUser, input: Correlated & { readonly offerId: unknown }): Promise<{ readonly checkoutId: string; readonly purchaseUrl: string }> {
      assertAcademyCoreAvailable(deps.flags);
      if (user.role !== "student") throw new AuthError("FORBIDDEN");
      if (!deps.gateway.configured) throw new DomainError("FEATURE_UNAVAILABLE", "Online payment is not available right now. No payment was taken.");
      const offer = await loadOffer(input.offerId);
      const [classGroup, learnerRows, openEnrollment, activeEntitlement, seats] = await Promise.all([
        loadClassGroup(offer.classGroupId),
        executor.query(selectProfileFactsQuery(user.uid)),
        executor.query(selectLearnerOpenEnrollmentQuery(offer.classGroupId, user.uid)),
        executor.query(selectActiveEntitlementForClassGroupQuery(user.uid, offer.classGroupId)),
        executor.query(countOpenSeatsQuery(offer.classGroupId)),
      ]);
      const ctx = contextFor(user, deps, input.correlationId);
      const plan = planOpenCheckout(
        {
          offer,
          classGroup,
          learner: mapProfileFacts(learnerRows[0]),
          learnerHasOpenEnrollment: openEnrollment.length > 0,
          learnerHasActiveEntitlement: activeEntitlement.length > 0,
          seatsTaken: num(seats[0]?.n ?? 0),
        },
        ctx,
      );
      await runGuarded(executor, [audited(deps, insertCheckoutQuery(plan.record), plan.audit)]);
      let opened: { readonly providerCheckoutId: string; readonly purchaseUrl: string };
      try {
        opened = await deps.gateway.open({ planId: offer.providerPlanId, checkoutId: plan.record.id, learnerUid: plan.record.learnerUid, offerId: offer.id });
      } catch {
        await runGuarded(executor, [expectRows(updateCheckoutQuery(checkoutFailed(plan.record, "initialization", ctx), "created"), 1)]);
        throw new DomainError("FEATURE_UNAVAILABLE", "Checkout could not be started. No payment was taken.");
      }
      const open = checkoutOpened(plan.record, opened, ctx);
      await runGuarded(executor, [expectRows(updateCheckoutQuery(open, "created"), 1)]);
      return { checkoutId: open.id, purchaseUrl: opened.purchaseUrl };
    },

    /** The state of the caller's own checkout, from the server's records only. */
    async checkoutStatus(user: AuthUser, checkoutIdInput: unknown): Promise<CheckoutView> {
      assertAcademyCoreAvailable(deps.flags);
      const checkout = await loadOptional(executor, selectCheckoutQuery(parseCheckoutId(checkoutIdInput)), mapCheckoutRow);
      // Someone else's checkout looks exactly like a missing one.
      if (!checkout || (checkout.learnerUid !== user.uid && user.role !== "admin")) throw new DomainError("NOT_FOUND", "Checkout not found.");
      const [entitlement, offer] = await Promise.all([
        loadOptional(executor, selectEntitlementByCheckoutQuery(checkout.id), mapEntitlementRow),
        loadOptional(executor, selectOfferQuery(checkout.offerId), mapOfferRow),
      ]);
      return {
        id: checkout.id,
        state: checkout.state,
        failure: checkout.failure,
        classGroupId: entitlement?.state === "active" ? entitlement.classGroupId : offer?.classGroupId ?? null,
        entitlement: entitlement ? { state: entitlement.state, stateReason: entitlement.stateReason } : null,
      };
    },

    // -- Whop events (called only after the signature is verified) ----------------

    async handleWhopEvent(eventId: string, envelope: WhopEnvelope): Promise<EventResult> {
      assertAcademyCoreAvailable(deps.flags);
      if (typeof eventId !== "string" || eventId.length === 0 || eventId.length > 128) throw new DomainError("VALIDATION", "Missing event id.");
      if ((await executor.query(selectPaymentEventQuery(eventId))).length > 0) return { outcome: "duplicate", detail: null };
      const event = { eventId, eventType: envelope.type };
      switch (envelope.type) {
        case "payment.succeeded":
          return onPaymentSucceeded(event, envelope);
        case "payment.failed":
          return onPaymentFailed(event, envelope);
        case "refund.created":
        case "refund.updated":
          return onRefund(event, envelope);
        case "membership.deactivated":
          return onMembership(event, envelope, false);
        case "membership.activated":
          return onMembership(event, envelope, true);
        case "payment.pending":
        case "payment.requires_action":
        case "payment.created":
        case "membership.cancel_at_period_end_changed":
          return commit({ ...event, resourceId: typeof envelope.data.id === "string" ? envelope.data.id.slice(0, 128) : null }, "recorded", "no access change", []);
        default:
          return commit({ ...event, resourceId: null }, "ignored", "event type not used by the academy", []);
      }
    },
  };
}

export type CommerceService = ReturnType<typeof createCommerceService>;
