/**
 * Academy core: soft delete / restore / permanent deletion and approval gates.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthError } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import type { EntityRef } from "../../src/lib/academy/domain/ids.ts";
import {
  assertGateApproved,
  cancelGate,
  decideGate,
  openGate,
  parseGateDefinition,
  type ApprovalGate,
  type GateContext,
  type GateDecision,
  type GateDefinition,
} from "../../src/lib/academy/governance/approval-gates.ts";
import {
  assertVisible,
  planPermanentDeletion,
  restoreSoftDeleted,
  softDelete,
  type SoftDeletable,
} from "../../src/lib/academy/governance/soft-delete.ts";

const COURSE: EntityRef = { kind: "course", id: "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e" };
const OTHER_COURSE: EntityRef = { kind: "course", id: "4f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e" };
const VERSION = "11111111-1111-4111-8111-111111111111";
const FIXED = () => new Date("2026-09-17T09:00:00.000Z");

function sequence() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);
}

function expectForbidden(fn: () => unknown) {
  assert.throws(fn, (error: unknown) => error instanceof AuthError && error.status === 403);
}

const admin = { uid: "admin-1", role: "admin" as const };
const admin2 = { uid: "admin-2", role: "admin" as const };
const admin3 = { uid: "admin-3", role: "admin" as const };
const teacher = { uid: "teacher-1", role: "teacher" as const };
const student = { uid: "student-1", role: "student" as const };

const live: SoftDeletable & { title: string } = { title: "Course", deletedAt: null, deletedBy: null, deletionReason: null };

describe("soft delete and restore", () => {
  test("soft delete records who, when and why, and audits a reversible change", () => {
    const result = softDelete(live, COURSE, { actor: admin, reason: "Duplicate listing", clock: FIXED });
    assert.equal(result.record.deletedAt, "2026-09-17T09:00:00.000Z");
    assert.equal(result.record.deletedBy, "admin-1");
    assert.equal(result.record.deletionReason, "Duplicate listing");
    assert.equal(result.record.title, "Course");
    assert.equal(result.audit.action, "entity.soft_delete");
    assert.equal(result.audit.rollback?.capable, true);
    assert.doesNotThrow(() => buildAuditEvent(result.audit));
  });

  test("soft delete requires a reason and cannot be repeated", () => {
    expectCode(() => softDelete(live, COURSE, { actor: admin, reason: "  " }), "VALIDATION");
    const deleted = softDelete(live, COURSE, { actor: admin, reason: "Duplicate" }).record;
    expectCode(() => softDelete(deleted, COURSE, { actor: admin, reason: "Again" }), "CONFLICT");
  });

  test("deleted records are indistinguishable from missing ones unless recovery is requested", () => {
    const deleted = softDelete(live, COURSE, { actor: admin, reason: "Duplicate" }).record;
    expectCode(() => assertVisible(deleted), "NOT_FOUND");
    expectCode(() => assertVisible(null), "NOT_FOUND");
    assert.equal(assertVisible(deleted, { includeDeleted: true }), deleted);
    assert.equal(assertVisible(live), live);
  });

  test("restore clears deletion markers and keeps the previous markers in the audit", () => {
    const deleted = softDelete(live, COURSE, { actor: admin, reason: "Duplicate", clock: FIXED }).record;
    const restored = restoreSoftDeleted(deleted, COURSE, { actor: admin2, reason: "Deleted by mistake" });
    assert.equal(restored.record.deletedAt, null);
    assert.equal(restored.record.deletedBy, null);
    assert.equal(restored.record.deletionReason, null);
    assert.equal(restored.audit.action, "entity.restore");
    assert.deepEqual(restored.audit.metadata, {
      previouslyDeletedAt: "2026-09-17T09:00:00.000Z",
      previouslyDeletedBy: "admin-1",
      previousDeletionReason: "Duplicate",
    });
    expectCode(() => restoreSoftDeleted(live, COURSE, { actor: admin, reason: "Nothing to restore" }), "CONFLICT");
    expectCode(() => restoreSoftDeleted(deleted, COURSE, { actor: admin, reason: "" }), "VALIDATION");
  });
});

const TWO_ADMINS: GateDefinition = { type: "permanent_deletion", requiredApprovals: 2, eligibleRoles: ["admin"], allowSelfApproval: false };

function ctx(actor: GateContext["actor"], newId = sequence()): GateContext {
  return { actor, clock: FIXED, newId };
}

function approvedDeletionGate(subject: EntityRef = COURSE): ApprovalGate {
  const newId = sequence();
  const { gate } = openGate({ definition: TWO_ADMINS, subject, existingGates: [] }, ctx(admin, newId));
  const first = decideGate(gate, [], { decision: "approve" }, ctx(admin2, newId));
  return decideGate(first.gate, [first.decision], { decision: "approve" }, ctx(admin3, newId)).gate;
}

describe("permanent deletion", () => {
  const deleted = softDelete(live, COURSE, { actor: admin, reason: "Duplicate" }).record;

  test("requires the record to be soft-deleted first", () => {
    expectCode(() => planPermanentDeletion(live, COURSE, approvedDeletionGate(), { actor: admin, reason: "Cleanup" }), "CONFLICT");
  });

  test("requires an approved permanent-deletion gate for this exact record", () => {
    expectCode(() => planPermanentDeletion(deleted, COURSE, null, { actor: admin, reason: "Cleanup" }), "APPROVAL_REQUIRED");
    expectCode(
      () => planPermanentDeletion(deleted, COURSE, approvedDeletionGate(OTHER_COURSE), { actor: admin, reason: "Cleanup" }),
      "APPROVAL_REQUIRED",
    );
    const { gate: openOnly } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin));
    expectCode(() => planPermanentDeletion(deleted, COURSE, openOnly, { actor: admin, reason: "Cleanup" }), "APPROVAL_REQUIRED");
  });

  test("with approval, produces an irreversible high-impact audit", () => {
    const audit = planPermanentDeletion(deleted, COURSE, approvedDeletionGate(), { actor: admin, reason: "Retention period ended" });
    assert.equal(audit.action, "entity.permanent_delete");
    assert.equal(audit.rollback?.capable, false);
    assert.equal(buildAuditEvent(audit).impact, "high");
  });
});

describe("approval gate configuration", () => {
  test("definitions must be explicit and valid", () => {
    assert.deepEqual({ ...parseGateDefinition(TWO_ADMINS), eligibleRoles: [...parseGateDefinition(TWO_ADMINS).eligibleRoles] }, {
      type: "permanent_deletion",
      requiredApprovals: 2,
      eligibleRoles: ["admin"],
      allowSelfApproval: false,
    });
    expectCode(() => parseGateDefinition(null), "VALIDATION");
    expectCode(() => parseGateDefinition({ ...TWO_ADMINS, type: "vibes_check" }), "VALIDATION");
    expectCode(() => parseGateDefinition({ ...TWO_ADMINS, requiredApprovals: 0 }), "VALIDATION");
    expectCode(() => parseGateDefinition({ ...TWO_ADMINS, requiredApprovals: 11 }), "VALIDATION");
    expectCode(() => parseGateDefinition({ ...TWO_ADMINS, eligibleRoles: [] }), "VALIDATION");
    expectCode(() => parseGateDefinition({ ...TWO_ADMINS, eligibleRoles: ["student"] }), "VALIDATION");
    const { allowSelfApproval: _omit, ...withoutSelf } = TWO_ADMINS;
    expectCode(() => parseGateDefinition(withoutSelf), "VALIDATION");
  });

  test("an unconfigured gate type cannot be opened (no invented defaults)", () => {
    expectCode(() => openGate({ definition: null, subject: COURSE, existingGates: [] }, ctx(admin)), "POLICY_UNCONFIGURED");
  });
});

describe("approval gate decisions", () => {
  test("opening snapshots the definition and refuses duplicates", () => {
    const { gate, audit } = openGate(
      { definition: TWO_ADMINS, subject: COURSE, subjectVersionId: VERSION, existingGates: [] },
      ctx(admin),
    );
    assert.equal(gate.state, "open");
    assert.equal(gate.requiredApprovals, 2);
    assert.equal(gate.subjectVersionId, VERSION);
    assert.equal(audit.action, "approval_gate.open");
    expectCode(
      () => openGate({ definition: TWO_ADMINS, subject: COURSE, subjectVersionId: VERSION, existingGates: [gate] }, ctx(admin)),
      "CONFLICT",
    );
    // A different version of the same subject is a different request.
    assert.doesNotThrow(() =>
      openGate({ definition: TWO_ADMINS, subject: COURSE, subjectVersionId: null, existingGates: [gate] }, ctx(admin)),
    );
  });

  test("the requester cannot decide their own request unless explicitly allowed", () => {
    const { gate } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin));
    expectForbidden(() => decideGate(gate, [], { decision: "approve" }, ctx(admin)));

    const selfAllowed: GateDefinition = { ...TWO_ADMINS, requiredApprovals: 1, allowSelfApproval: true };
    const { gate: selfGate } = openGate({ definition: selfAllowed, subject: COURSE, existingGates: [] }, ctx(admin));
    assert.equal(decideGate(selfGate, [], { decision: "approve" }, ctx(admin)).gate.state, "approved");
  });

  test("only eligible roles decide; students never do", () => {
    const { gate } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin));
    expectForbidden(() => decideGate(gate, [], { decision: "approve" }, ctx(teacher)));
    expectForbidden(() => decideGate(gate, [], { decision: "approve" }, ctx(student)));
  });

  test("approval counts toward the required number and each person decides once", () => {
    const newId = sequence();
    const { gate } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin, newId));
    const first = decideGate(gate, [], { decision: "approve" }, ctx(admin2, newId));
    assert.equal(first.gate.state, "open", "one of two approvals keeps the gate open");
    expectCode(() => decideGate(first.gate, [first.decision], { decision: "approve" }, ctx(admin2, newId)), "CONFLICT");
    const second = decideGate(first.gate, [first.decision], { decision: "approve" }, ctx(admin3, newId));
    assert.equal(second.gate.state, "approved");
    assert.notEqual(second.gate.resolvedAt, null);
    expectCode(() => decideGate(second.gate, [first.decision, second.decision], { decision: "approve" }, ctx(teacher)), "CONFLICT");
  });

  test("rejection and change requests need a reason and resolve the gate", () => {
    const { gate } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin));
    expectCode(() => decideGate(gate, [], { decision: "reject" }, ctx(admin2)), "VALIDATION");
    expectCode(() => decideGate(gate, [], { decision: "request_changes", reason: " " }, ctx(admin2)), "VALIDATION");
    assert.equal(decideGate(gate, [], { decision: "reject", reason: "Rights unclear" }, ctx(admin2)).gate.state, "rejected");
    assert.equal(
      decideGate(gate, [], { decision: "request_changes", reason: "Add sources" }, ctx(admin2)).gate.state,
      "changes_requested",
    );
  });

  test("decision history must belong to the gate", () => {
    const { gate } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin));
    const foreign: GateDecision = {
      id: "99999999-9999-4999-8999-999999999999",
      gateId: "88888888-8888-4888-8888-888888888888",
      decidedBy: "admin-9",
      decidedRole: "admin",
      decision: "approve",
      reason: null,
      decidedAt: "2026-09-17T09:00:00.000Z",
    };
    expectCode(() => decideGate(gate, [foreign], { decision: "approve" }, ctx(admin2)), "CONFLICT");
  });

  test("cancellation requires a reason and only applies to open gates", () => {
    const { gate } = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin));
    expectCode(() => cancelGate(gate, "", ctx(admin)), "VALIDATION");
    const cancelled = cancelGate(gate, "No longer needed", ctx(admin));
    assert.equal(cancelled.gate.state, "cancelled");
    assert.equal(cancelled.audit.action, "approval_gate.cancel");
    expectCode(() => cancelGate(cancelled.gate, "Again", ctx(admin)), "INVALID_TRANSITION");
  });

  test("assertGateApproved matches type, subject and version exactly", () => {
    const newId = sequence();
    const publication: GateDefinition = { type: "publication", requiredApprovals: 1, eligibleRoles: ["admin"], allowSelfApproval: false };
    const { gate } = openGate({ definition: publication, subject: COURSE, subjectVersionId: VERSION, existingGates: [] }, ctx(admin, newId));
    const approved = decideGate(gate, [], { decision: "approve" }, ctx(admin2, newId)).gate;
    assert.doesNotThrow(() => assertGateApproved(approved, { type: "publication", subject: COURSE, subjectVersionId: VERSION }));
    expectCode(() => assertGateApproved(approved, { type: "publication", subject: COURSE, subjectVersionId: null }), "APPROVAL_REQUIRED");
    expectCode(() => assertGateApproved(approved, { type: "religious_review", subject: COURSE, subjectVersionId: VERSION }), "APPROVAL_REQUIRED");
    expectCode(() => assertGateApproved(approved, { type: "publication", subject: OTHER_COURSE, subjectVersionId: VERSION }), "APPROVAL_REQUIRED");
  });

  test("gate audits are valid audit events", () => {
    const newId = sequence();
    const opened = openGate({ definition: TWO_ADMINS, subject: COURSE, existingGates: [] }, ctx(admin, newId));
    const decided = decideGate(opened.gate, [], { decision: "reject", reason: "Not ready" }, ctx(admin2, newId));
    for (const input of [opened.audit, decided.audit]) {
      assert.doesNotThrow(() => buildAuditEvent(input));
    }
  });
});
