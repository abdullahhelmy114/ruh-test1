/**
 * SQL for academy commerce (offers, checkouts, entitlements, processed Whop
 * events). Every value is a parameter; every state change is guarded by the
 * revision or state the plan was made against.
 */
import type { CheckoutFailure, CheckoutRecord, CheckoutState, EntitlementRecord, EventOutcome, OfferRecord, OfferState, RevokeReason } from "../commerce/commerce.ts";
import { sqlQuery, type SqlQuery, type SqlRow } from "../infra/sql.ts";
import { iso, isoOrNull, num, str, strOrNull } from "./rows.ts";

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

const OFFER_COLUMNS = `id, course_id, class_group_id, provider, provider_plan_id, label, state, state_reason, revision,
  created_by, created_at, updated_by, updated_at`;

export function selectOfferQuery(id: string): SqlQuery {
  return { text: `SELECT ${OFFER_COLUMNS} FROM academy_offers WHERE id = $1::uuid`, values: [id] };
}

export function listCourseOffersQuery(courseId: string): SqlQuery {
  return { text: `SELECT ${OFFER_COLUMNS} FROM academy_offers WHERE course_id = $1::uuid ORDER BY state ASC, created_at ASC LIMIT 200`, values: [courseId] };
}

export function insertOfferQuery(record: OfferRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_offers
      (id, course_id, class_group_id, provider, provider_plan_id, label, state, state_reason, revision, created_by, created_at, updated_by, updated_at)
    VALUES (${record.id}::uuid, ${record.courseId}::uuid, ${record.classGroupId}::uuid, ${record.provider}, ${record.providerPlanId}, ${record.label},
      ${record.state}, ${record.stateReason}, ${record.revision}, ${record.createdBy}, ${record.createdAt}::timestamptz, ${record.updatedBy}, ${record.updatedAt}::timestamptz)
    RETURNING id`;
}

export function updateOfferStateQuery(record: OfferRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_offers SET state = ${record.state}, state_reason = ${record.stateReason}, revision = ${record.revision},
      updated_by = ${record.updatedBy}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

/** Active offers of a public course whose class group still takes learners (no plan ids leave the server). */
export function listPublicOffersQuery(courseSlug: string): SqlQuery {
  return sqlQuery`SELECT o.id, o.label, cg.name AS class_group_name, cg.starts_on::text AS starts_on, cg.ends_on::text AS ends_on,
      (cg.capacity IS NOT NULL AND (SELECT count(*) FROM academy_enrollments e
        WHERE e.class_group_id = cg.id AND e.state IN ('pending', 'active', 'suspended')) >= cg.capacity) AS is_full
    FROM academy_offers o
    JOIN academy_courses c ON c.id = o.course_id
    JOIN academy_class_groups cg ON cg.id = o.class_group_id
    WHERE c.slug = ${courseSlug} AND c.status = 'active' AND c.deleted_at IS NULL
      AND o.state = 'active' AND cg.deleted_at IS NULL AND cg.status IN ('planned', 'active')
    ORDER BY cg.starts_on ASC NULLS LAST, o.created_at ASC
    LIMIT 50`;
}

export function mapOfferRow(row: SqlRow): OfferRecord {
  return Object.freeze({
    id: str(row.id),
    courseId: str(row.course_id),
    classGroupId: str(row.class_group_id),
    provider: "whop",
    providerPlanId: str(row.provider_plan_id),
    label: str(row.label),
    state: str(row.state) as OfferState,
    stateReason: strOrNull(row.state_reason),
    revision: num(row.revision),
    createdBy: str(row.created_by),
    createdAt: iso(row.created_at),
    updatedBy: str(row.updated_by),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Checkouts
// ---------------------------------------------------------------------------

const CHECKOUT_COLUMNS = "id, offer_id, learner_uid, provider, provider_checkout_id, purchase_url, state, failure, created_at, updated_at";

export function selectCheckoutQuery(id: string): SqlQuery {
  return { text: `SELECT ${CHECKOUT_COLUMNS} FROM academy_checkouts WHERE id = $1::uuid`, values: [id] };
}

export function insertCheckoutQuery(record: CheckoutRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_checkouts (id, offer_id, learner_uid, provider, provider_checkout_id, purchase_url, state, failure, created_at, updated_at)
    VALUES (${record.id}::uuid, ${record.offerId}::uuid, ${record.learnerUid}, ${record.provider}, ${record.providerCheckoutId}, ${record.purchaseUrl},
      ${record.state}, ${record.failure}, ${record.createdAt}::timestamptz, ${record.updatedAt}::timestamptz)
    RETURNING id`;
}

/** Moves a checkout on only from the state it was read in (a late or repeated event cannot move it back). */
export function updateCheckoutQuery(record: CheckoutRecord, expectedState: CheckoutState): SqlQuery {
  return sqlQuery`UPDATE academy_checkouts SET state = ${record.state}, failure = ${record.failure},
      provider_checkout_id = ${record.providerCheckoutId}, purchase_url = ${record.purchaseUrl}, updated_at = ${record.updatedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND state = ${expectedState}
    RETURNING id`;
}

export function mapCheckoutRow(row: SqlRow): CheckoutRecord {
  return Object.freeze({
    id: str(row.id),
    offerId: str(row.offer_id),
    learnerUid: str(row.learner_uid),
    provider: "whop",
    providerCheckoutId: strOrNull(row.provider_checkout_id),
    purchaseUrl: strOrNull(row.purchase_url),
    state: str(row.state) as CheckoutState,
    failure: strOrNull(row.failure) as CheckoutFailure | null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

// ---------------------------------------------------------------------------
// Entitlements
// ---------------------------------------------------------------------------

const ENTITLEMENT_COLUMNS = `id, learner_uid, offer_id, course_id, class_group_id, enrollment_id, checkout_id, provider, provider_payment_id,
  provider_membership_id, provider_user_id, state, state_reason, revision, granted_at, updated_at, revoked_at`;

export function selectEntitlementByPaymentQuery(paymentId: string): SqlQuery {
  return { text: `SELECT ${ENTITLEMENT_COLUMNS} FROM academy_entitlements WHERE provider = 'whop' AND provider_payment_id = $1`, values: [paymentId] };
}

export function selectEntitlementByCheckoutQuery(checkoutId: string): SqlQuery {
  return { text: `SELECT ${ENTITLEMENT_COLUMNS} FROM academy_entitlements WHERE checkout_id = $1::uuid`, values: [checkoutId] };
}

export function listEntitlementsByMembershipQuery(membershipId: string): SqlQuery {
  return { text: `SELECT ${ENTITLEMENT_COLUMNS} FROM academy_entitlements WHERE provider = 'whop' AND provider_membership_id = $1 ORDER BY granted_at ASC LIMIT 20`, values: [membershipId] };
}

export function selectActiveEntitlementForClassGroupQuery(learnerUid: string, classGroupId: string): SqlQuery {
  return sqlQuery`SELECT id FROM academy_entitlements
    WHERE learner_uid = ${learnerUid} AND class_group_id = ${classGroupId}::uuid AND state = 'active' LIMIT 1`;
}

export function insertEntitlementQuery(record: EntitlementRecord): SqlQuery {
  return sqlQuery`INSERT INTO academy_entitlements
      (id, learner_uid, offer_id, course_id, class_group_id, enrollment_id, checkout_id, provider, provider_payment_id,
       provider_membership_id, provider_user_id, state, state_reason, revision, granted_at, updated_at, revoked_at)
    VALUES (${record.id}::uuid, ${record.learnerUid}, ${record.offerId}::uuid, ${record.courseId}::uuid, ${record.classGroupId}::uuid,
      ${record.enrollmentId}::uuid, ${record.checkoutId}::uuid, ${record.provider}, ${record.providerPaymentId},
      ${record.providerMembershipId}, ${record.providerUserId}, ${record.state}, ${record.stateReason}, ${record.revision},
      ${record.grantedAt}::timestamptz, ${record.updatedAt}::timestamptz, ${record.revokedAt}::timestamptz)
    RETURNING id`;
}

export function updateEntitlementQuery(record: EntitlementRecord, expectedRevision: number): SqlQuery {
  return sqlQuery`UPDATE academy_entitlements SET state = ${record.state}, state_reason = ${record.stateReason}, revision = ${record.revision},
      updated_at = ${record.updatedAt}::timestamptz, revoked_at = ${record.revokedAt}::timestamptz
    WHERE id = ${record.id}::uuid AND revision = ${expectedRevision}
    RETURNING id`;
}

export function mapEntitlementRow(row: SqlRow): EntitlementRecord {
  return Object.freeze({
    id: str(row.id),
    learnerUid: str(row.learner_uid),
    offerId: str(row.offer_id),
    courseId: str(row.course_id),
    classGroupId: str(row.class_group_id),
    enrollmentId: str(row.enrollment_id),
    checkoutId: str(row.checkout_id),
    provider: "whop",
    providerPaymentId: str(row.provider_payment_id),
    providerMembershipId: strOrNull(row.provider_membership_id),
    providerUserId: strOrNull(row.provider_user_id),
    state: str(row.state) as EntitlementRecord["state"],
    stateReason: strOrNull(row.state_reason) as RevokeReason | null,
    revision: num(row.revision),
    grantedAt: iso(row.granted_at),
    updatedAt: iso(row.updated_at),
    revokedAt: isoOrNull(row.revoked_at),
  });
}

// ---------------------------------------------------------------------------
// Enrollment lookups used by purchases
// ---------------------------------------------------------------------------

/** The learner's open enrollment in a class group, if any (full row). */
export function selectLearnerOpenEnrollmentQuery(classGroupId: string, learnerUid: string): SqlQuery {
  return sqlQuery`SELECT id, class_group_id, course_id, learner_uid, state, source, state_reason, revision, created_by, created_at,
      updated_by, updated_at, activated_at, ended_at
    FROM academy_enrollments
    WHERE class_group_id = ${classGroupId}::uuid AND learner_uid = ${learnerUid} AND state IN ('pending', 'active', 'suspended')
    LIMIT 1`;
}

export function countOpenSeatsQuery(classGroupId: string): SqlQuery {
  return sqlQuery`SELECT count(*)::int AS n FROM academy_enrollments
    WHERE class_group_id = ${classGroupId}::uuid AND state IN ('pending', 'active', 'suspended')`;
}

// ---------------------------------------------------------------------------
// Processed Whop events (idempotency)
// ---------------------------------------------------------------------------

export function selectPaymentEventQuery(eventId: string): SqlQuery {
  return sqlQuery`SELECT outcome FROM academy_payment_events WHERE provider = 'whop' AND event_id = ${eventId}`;
}

export function insertPaymentEventQuery(event: {
  readonly eventId: string;
  readonly eventType: string;
  readonly resourceId: string | null;
  readonly outcome: EventOutcome;
  readonly detail: string | null;
  readonly receivedAt: string;
}): SqlQuery {
  return sqlQuery`INSERT INTO academy_payment_events (provider, event_id, event_type, resource_id, outcome, detail, received_at)
    VALUES ('whop', ${event.eventId}, ${event.eventType}, ${event.resourceId}, ${event.outcome}, ${event.detail}, ${event.receivedAt}::timestamptz)
    RETURNING event_id`;
}
