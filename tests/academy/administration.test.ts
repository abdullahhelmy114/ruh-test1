/**
 * Administration workspace: approval gates, overview, review queue, audit
 * trail and policy map.
 *
 * Required invariants covered here: gates have no default configuration,
 * decisions follow each gate's snapshot (eligible roles, self-approval, one
 * decision per person), teachers never configure or open gates and only see
 * requests they may decide, and every administrative read is admin-only.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { AuthUser } from "../../src/lib/auth/core.ts";
import { entityRef } from "../../src/lib/academy/domain/ids.ts";
import { POLICY_KEYS } from "../../src/lib/academy/policies/registry.ts";
import * as adminRepo from "../../src/lib/academy/repo/admin-repo.ts";
import * as gateRepo from "../../src/lib/academy/repo/gate-repo.ts";
import { createAdminService } from "../../src/lib/academy/services/admin-service.ts";
import { createGovernanceService } from "../../src/lib/academy/services/governance-service.ts";
import {
  IDS,
  admin,
  admin2,
  assertWellFormed,
  expectDomain,
  fakeExecutor,
  fixedClock,
  rejectsDomain,
  rejectsForbidden,
  sequentialIds,
  student,
  teacher,
  type FakeExecutor,
  type Rule,
} from "./support.ts";

const GATE = "9a000000-0000-4000-8000-000000000001";
const admin3: AuthUser = { uid: "admin-3", profileId: "p-a3", role: "admin", email: "a3@example.test" };

function definitionRow(overrides: Record<string, unknown> = {}) {
  return { gate_type: "publication", required_approvals: 1, eligible_roles: ["admin"], allow_self_approval: false, updated_by: "admin-1", updated_at: "2026-09-01T00:00:00Z", reason: "Two-person rule", ...overrides };
}

function gateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: GATE, gate_type: "publication", subject_kind: "course", subject_id: IDS.course, subject_version_id: null, state: "open",
    requested_by: "admin-1", requested_at: "2026-09-10T00:00:00Z", resolved_at: null, required_approvals: 1, eligible_roles: ["admin"],
    allow_self_approval: false, ...overrides,
  };
}

const R = {
  // First: the overview query also mentions the open-gates condition.
  overview: /AS open_approval_requests/,
  definition: /FROM academy_approval_gate_definitions WHERE gate_type/,
  definitions: /FROM academy_approval_gate_definitions ORDER BY/,
  subjectGates: /FROM academy_approval_gates WHERE subject_kind/,
  gate: /FROM academy_approval_gates WHERE id = \$1::uuid$/,
  openGates: /FROM academy_approval_gates WHERE state = 'open'/,
  decisions: /FROM academy_approval_decisions/,
  configured: /SELECT policy_key FROM academy_policy_values WHERE scope = 'academy'/,
  reviewQueue: /FROM \(\s*SELECT 'curriculum_version'/,
  audit: /FROM academy_audit_events/,
  policy: /FROM academy_policy_values\s+WHERE policy_key/,
};

function world(overrides: Partial<Record<keyof typeof R, Rule["rows"]>> = {}): Rule[] {
  const rows: Record<string, Rule["rows"]> = {
    definition: [definitionRow()],
    definitions: [definitionRow()],
    subjectGates: [],
    gate: [gateRow()],
    openGates: [gateRow(), gateRow({ id: "9a000000-0000-4000-8000-000000000002", eligible_roles: ["admin", "teacher"] })],
    decisions: [],
    overview: [{ programs: "2", courses: "5", open_class_groups: "3", class_groups_without_teacher: "1", active_enrollments: "40", pending_enrollments: "2", upcoming_sessions: "9", curriculum_reviews: "1", lesson_script_reviews: "4", assessment_reviews: "0", attempts_needing_review: "7", recordings_in_review: "2", open_approval_requests: "1" }],
    configured: [{ policy_key: "institution.timezone" }],
    reviewQueue: [{ kind: "curriculum_version", id: IDS.version2, version_number: 2, created_by: "admin-1", submitted_at: "2026-09-12T00:00:00Z", label: "Nahw 1", course_id: IDS.course }],
    audit: [],
    policy: [],
    ...overrides,
  };
  return (Object.keys(R) as (keyof typeof R)[]).map((key) => ({ match: R[key], rows: rows[key] }));
}

function governance(executor: FakeExecutor) {
  return createGovernanceService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("9b9b9b9b") });
}

function administration(executor: FakeExecutor) {
  return createAdminService({ executor, flags: { coreSchemaReady: true }, clock: fixedClock, newId: sequentialIds("9c9c9c9c") });
}

describe("approval gate configuration and requests", () => {
  test("gate definitions are addressed by gate type in the audit trail", () => {
    assert.deepEqual({ ...entityRef("approval_gate_definition", "final_assessment_release") }, { kind: "approval_gate_definition", id: "final_assessment_release" });
    expectDomain(() => entityRef("approval_gate_definition", "Final Release!"), "VALIDATION");
  });

  test("only administrators configure gates, explicitly and with a reason", async () => {
    await rejectsForbidden(governance(fakeExecutor(world())).configureGate(teacher, { type: "publication", requiredApprovals: 1, eligibleRoles: ["admin"], allowSelfApproval: false, reason: "x" }));
    await rejectsDomain(governance(fakeExecutor(world())).configureGate(admin, { type: "publication", requiredApprovals: 1, eligibleRoles: ["admin"], reason: "x" } as never), "VALIDATION");
    await rejectsDomain(governance(fakeExecutor(world())).configureGate(admin, { type: "publication", requiredApprovals: 1, eligibleRoles: ["admin"], allowSelfApproval: false, reason: " " }), "VALIDATION");
    const executor = fakeExecutor(world());
    await governance(executor).configureGate(admin, { type: "publication", requiredApprovals: 2, eligibleRoles: ["admin", "teacher"], allowSelfApproval: false, reason: "Board decision" });
    const [write] = executor.transactions[0];
    assert.match(write.text, /INSERT INTO academy_approval_gate_definitions[\s\S]*academy_audit_events/);
    assert.ok(write.values.includes("approval_gate_definition"));
  });

  test("an unconfigured gate cannot be opened; teachers never open gates; duplicates are refused", async () => {
    await rejectsDomain(governance(fakeExecutor(world({ definition: [] }))).openGate(admin, { type: "religious_review", subjectKind: "course", subjectId: IDS.course }), "POLICY_UNCONFIGURED");
    await rejectsForbidden(governance(fakeExecutor(world())).openGate(teacher, { type: "publication", subjectKind: "course", subjectId: IDS.course }));
    await rejectsDomain(governance(fakeExecutor(world({ subjectGates: [gateRow()] }))).openGate(admin, { type: "publication", subjectKind: "course", subjectId: IDS.course }), "CONFLICT");
    const executor = fakeExecutor(world());
    const gate = await governance(executor).openGate(admin, { type: "publication", subjectKind: "course", subjectId: IDS.course });
    assert.equal(gate.state, "open");
    assert.match(executor.transactions[0][0].text, /INSERT INTO academy_approval_gates[\s\S]*academy_audit_events/);
  });
});

describe("approval gate decisions", () => {
  test("the requester cannot approve their own request unless the gate allows it", async () => {
    await rejectsForbidden(governance(fakeExecutor(world())).decide(admin, GATE, { decision: "approve" }));
  });

  test("a single required approval resolves the gate in the same transaction", async () => {
    const executor = fakeExecutor(world());
    const result = await governance(executor).decide(admin2, GATE, { decision: "approve" });
    assert.equal(result.gate.state, "approved");
    const [lock, count, decision, resolve] = executor.transactions[0];
    assert.match(lock.text, /FROM academy_approval_gates WHERE id = \$1::uuid FOR UPDATE/);
    assert.match(count.text, /academy_expect_rows\(\s*\(SELECT count\(\*\) FROM academy_approval_decisions WHERE gate_id = \$1::uuid\), \$2::bigint\)/);
    assert.match(decision.text, /INSERT INTO academy_approval_decisions[\s\S]*g\.state = 'open'[\s\S]*academy_audit_events/);
    assert.match(resolve.text, /UPDATE academy_approval_gates[\s\S]*state = 'open'/);
  });

  test("concurrent decisions cannot each count only themselves: the transaction locks the gate and re-checks the decision set", async () => {
    // Reproduces the race: two approvers load the same (empty) decision set for a
    // two-approval gate. Each plan alone keeps the gate open, so without a guard
    // both commits would leave an approved-twice gate open forever.
    const twoRequired = world({ gate: [gateRow({ required_approvals: 2 })] });
    const executorA = fakeExecutor(twoRequired);
    const executorB = fakeExecutor(twoRequired);
    await governance(executorA).decide(admin2, GATE, { decision: "approve" });
    await governance(executorB).decide(admin3, GATE, { decision: "approve" });
    for (const executor of [executorA, executorB]) {
      const [lock, count, insert] = executor.transactions[0];
      assert.ok(lock.values.includes(GATE) && /FOR UPDATE/.test(lock.text), "the gate row is locked first");
      assert.deepEqual(count.values, [GATE, 0], "the decision set the plan was made against is asserted after the lock");
      assert.match(insert.text, /INSERT INTO academy_approval_decisions/);
      assertWellFormed(lock);
      assertWellFormed(count);
    }
    // In the database the second transaction's count check sees the first
    // approval and raises RQ409, which the service reports as a conflict.
    const loser = fakeExecutor(twoRequired);
    loser.failTransactionWith = Object.assign(new Error("stale"), { code: "RQ409" });
    await rejectsDomain(governance(loser).decide(admin3, GATE, { decision: "approve" }), "CONFLICT");
    // Planned against the committed approval, the retry resolves the gate.
    const prior = [{ id: "9d000000-0000-4000-8000-000000000001", gate_id: GATE, decided_by: "admin-2", decided_role: "admin", decision: "approve", reason: null, decided_at: "2026-09-17T00:00:00Z" }];
    const retry = fakeExecutor(world({ gate: [gateRow({ required_approvals: 2 })], decisions: prior }));
    assert.equal((await governance(retry).decide(admin3, GATE, { decision: "approve" })).gate.state, "approved");
    assert.deepEqual(retry.transactions[0][1].values, [GATE, 1]);
    assert.equal(retry.transactions[0].length, 4);
  });

  test("with two required approvals the first keeps the gate open; the same person cannot decide twice", async () => {
    const twoRequired = world({ gate: [gateRow({ required_approvals: 2 })] });
    const first = fakeExecutor(twoRequired);
    const result = await governance(first).decide(admin2, GATE, { decision: "approve" });
    assert.equal(result.gate.state, "open");
    // lock, decision-count guard and the decision; no resolution yet.
    assert.equal(first.transactions[0].length, 3);
    const prior = [{ id: "9d000000-0000-4000-8000-000000000001", gate_id: GATE, decided_by: "admin-2", decided_role: "admin", decision: "approve", reason: null, decided_at: "2026-09-17T00:00:00Z" }];
    await rejectsDomain(governance(fakeExecutor(world({ gate: [gateRow({ required_approvals: 2 })], decisions: prior }))).decide(admin2, GATE, { decision: "approve" }), "CONFLICT");
    const second = await governance(fakeExecutor(world({ gate: [gateRow({ required_approvals: 2 })], decisions: prior }))).decide(admin3, GATE, { decision: "approve" });
    assert.equal(second.gate.state, "approved");
  });

  test("teachers decide only where the gate names them; rejections need reasons", async () => {
    await rejectsForbidden(governance(fakeExecutor(world())).decide(teacher, GATE, { decision: "approve" }));
    await rejectsForbidden(governance(fakeExecutor(world())).decide(student, GATE, { decision: "approve" }));
    await rejectsDomain(governance(fakeExecutor(world({ gate: [gateRow({ eligible_roles: ["admin", "teacher"] })] }))).decide(teacher, GATE, { decision: "reject" }), "VALIDATION");
    const rejected = await governance(fakeExecutor(world({ gate: [gateRow({ eligible_roles: ["admin", "teacher"] })] }))).decide(teacher, GATE, { decision: "reject", reason: "Sources missing" });
    assert.equal(rejected.gate.state, "rejected");
  });

  test("teachers see only requests they may decide; learners see none", async () => {
    await rejectsForbidden(governance(fakeExecutor(world())).listOpenGates(student));
    assert.equal((await governance(fakeExecutor(world())).listOpenGates(admin)).length, 2);
    assert.equal((await governance(fakeExecutor(world())).listOpenGates(teacher)).length, 1);
    await rejectsDomain(governance(fakeExecutor(world())).getGate(teacher, GATE), "NOT_FOUND");
  });

  test("only administrators cancel, with a reason", async () => {
    await rejectsForbidden(governance(fakeExecutor(world())).cancel(teacher, GATE, { reason: "x" }));
    await rejectsDomain(governance(fakeExecutor(world())).cancel(admin, GATE, { reason: "" }), "VALIDATION");
    const cancelled = await governance(fakeExecutor(world())).cancel(admin, GATE, { reason: "Superseded by a new version" });
    assert.equal(cancelled.state, "cancelled");
  });
});

describe("administration workspace", () => {
  test("overview, review queue, audit trail and policy map are administrator-only", async () => {
    for (const user of [teacher, student]) {
      const executor = fakeExecutor(world());
      await rejectsForbidden(administration(executor).overview(user));
      await rejectsForbidden(administration(executor).reviewQueue(user));
      await rejectsForbidden(administration(executor).auditTrail(user, {}));
      await rejectsForbidden(administration(executor).policyMap(user, {}));
      assert.equal(executor.queries.length, 0);
    }
  });

  test("the overview reports counts and every academy setting that still needs a value", async () => {
    const overview = await administration(fakeExecutor(world())).overview(admin);
    assert.equal(overview.counts.attempts_needing_review, 7);
    assert.equal(overview.counts.class_groups_without_teacher, 1);
    assert.equal(overview.unconfiguredAcademyPolicies.includes("institution.timezone"), false);
    assert.equal(overview.unconfiguredAcademyPolicies.length, POLICY_KEYS.length - 1);
  });

  test("audit filters are validated and passed as parameters", async () => {
    await rejectsDomain(administration(fakeExecutor(world())).auditTrail(admin, { limit: "-3" }), "VALIDATION");
    await rejectsDomain(administration(fakeExecutor(world())).auditTrail(admin, { objectKind: "users" }), "VALIDATION");
    const executor = fakeExecutor(world());
    await administration(executor).auditTrail(admin, { objectKind: "course", actorUid: "admin-1", before: "2026-09-17T00:00:00Z" });
    const query = executor.queries[0];
    assert.ok(query.values.includes("course") && query.values.includes("admin-1"));
    assert.equal(query.text.includes("admin-1"), false);
  });

  test("the policy map reports corrupt stored values instead of failing the whole page", async () => {
    const corrupt = [{ id: "73000000-0000-4000-8000-000000000001", policy_key: "assessment.attempt_limit", scope: "academy", program_id: null, course_id: null, value: JSON.stringify({ maxAttempts: "lots" }), revision: 1, set_by: "admin-1", set_at: "2026-09-01T00:00:00Z", reason: "x" }];
    const executor = fakeExecutor(world({ policy: (q) => (q.values[0] === "assessment.attempt_limit" ? corrupt : []) }));
    const map = await administration(executor).policyMap(admin, { courseId: IDS.course });
    assert.equal(map.length, POLICY_KEYS.length);
    assert.equal(map.find((entry) => entry.key === "assessment.attempt_limit")?.resolution.status, "invalid");
    assert.equal(map.find((entry) => entry.key === "institution.timezone")?.resolution.status, "unconfigured");
  });

  test("queries are well formed", () => {
    for (const query of [
      adminRepo.selectOverviewQuery("2026-09-17T00:00:00Z", "2026-09-24T00:00:00Z"),
      adminRepo.selectContentReviewQueueQuery(),
      gateRepo.insertDecisionQuery({ id: "9d000000-0000-4000-8000-000000000001", gateId: GATE, decidedBy: "admin-2", decidedRole: "admin", decision: "approve", reason: null, decidedAt: "2026-09-17T00:00:00Z" }),
      gateRepo.selectGateDefinitionQuery("publication"),
      gateRepo.listSubjectGatesQuery("course", IDS.course),
    ]) {
      assertWellFormed(query);
    }
  });
});
