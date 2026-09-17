/**
 * Academy core: the audit envelope.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_ACTIONS,
  REDACTED,
  buildAuditEvent,
  isSensitiveAuditKey,
  redactAuditMetadata,
  type AuditEventInput,
} from "../../src/lib/academy/audit/audit.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";

const COURSE = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";
const VERSION_A = "11111111-1111-4111-8111-111111111111";
const VERSION_B = "22222222-2222-4222-8222-222222222222";
const FIXED = new Date("2026-09-17T10:00:00.000Z");

const options = { clock: () => FIXED, newId: () => "99999999-9999-4999-8999-999999999999" };

function input(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    actor: { uid: "admin-uid", role: "admin" },
    action: "version.publish",
    object: { kind: "curriculum_version", id: VERSION_B },
    previousVersionId: VERSION_A,
    newVersionId: VERSION_B,
    correlationId: "req-publish-0001",
    ...overrides,
  };
}

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);
}

describe("audit envelope", () => {
  test("captures actor, time, object, versions, impact and correlation", () => {
    const event = buildAuditEvent(input(), options);
    assert.equal(event.id, "99999999-9999-4999-8999-999999999999");
    assert.equal(event.occurredAt, "2026-09-17T10:00:00.000Z");
    assert.deepEqual({ ...event.actor }, { uid: "admin-uid", role: "admin" });
    assert.equal(event.action, "version.publish");
    assert.equal(event.impact, "high");
    assert.deepEqual({ ...event.object }, { kind: "curriculum_version", id: VERSION_B });
    assert.equal(event.previousVersionId, VERSION_A);
    assert.equal(event.newVersionId, VERSION_B);
    assert.equal(event.correlationId, "req-publish-0001");
    assert.ok(Object.isFrozen(event));
  });

  test("unknown actions are rejected (no ad-hoc audit vocabulary)", () => {
    expectCode(() => buildAuditEvent(input({ action: "course.nuke" as AuditEventInput["action"] }), options), "VALIDATION");
  });

  test("actions that require a reason refuse to be audited without one", () => {
    for (const [action, definition] of Object.entries(AUDIT_ACTIONS)) {
      if (!definition.reasonRequired) continue;
      expectCode(
        () =>
          buildAuditEvent(
            input({ action: action as AuditEventInput["action"], object: { kind: "course", id: COURSE }, reason: "  " }),
            options,
          ),
        "VALIDATION",
      );
    }
    const event = buildAuditEvent(
      input({ action: "entity.soft_delete", object: { kind: "course", id: COURSE }, reason: "Duplicate course" }),
      options,
    );
    assert.equal(event.reason, "Duplicate course");
  });

  test("destructive and governance actions are high impact", () => {
    for (const action of ["entity.soft_delete", "entity.restore", "entity.permanent_delete", "policy.set_value", "version.publish"] as const) {
      assert.equal(AUDIT_ACTIONS[action].impact, "high", action);
    }
  });

  test("actor and object are validated", () => {
    expectCode(() => buildAuditEvent(input({ actor: { uid: "", role: "admin" } }), options), "VALIDATION");
    expectCode(() => buildAuditEvent(input({ actor: { uid: "x", role: "superuser" as "admin" } }), options), "VALIDATION");
    expectCode(() => buildAuditEvent(input({ object: { kind: "course", id: "not-a-uuid" } }), options), "VALIDATION");
    expectCode(() => buildAuditEvent(input({ previousVersionId: "nope" }), options), "VALIDATION");
  });

  test("relationship changes and impact scope are validated", () => {
    const event = buildAuditEvent(
      input({
        action: "relationship.link",
        object: { kind: "course", id: COURSE },
        changedRelationships: [
          { change: "linked", relationship: "course_resources", from: { kind: "course", id: COURSE }, to: { kind: "library_resource", id: VERSION_A } },
        ],
        impactScope: { courses: 1, learners: 42, notes: "Adds a required reading" },
      }),
      options,
    );
    assert.equal(event.changedRelationships.length, 1);
    assert.deepEqual({ ...event.impactScope }, { courses: 1, learners: 42, notes: "Adds a required reading" });
    expectCode(
      () => buildAuditEvent(input({ impactScope: { learners: -1 } }), options),
      "VALIDATION",
    );
  });

  test("metadata never stores credentials, answer keys or private note content", () => {
    const event = buildAuditEvent(
      input({
        metadata: {
          password: "hunter2",
          apiKey: "k",
          nested: { authorization: "Bearer x", items: [{ correctAnswer: 2 }, { private_note: "mine" }] },
          answer_key: [1, 2],
          sessionCookie: "c",
          passageId: "p-1",
          footprint: "small",
          title: "Lesson 3",
        },
      }),
      options,
    );
    const metadata = event.metadata as Record<string, unknown>;
    assert.equal(metadata.password, REDACTED);
    assert.equal(metadata.apiKey, REDACTED);
    assert.equal(metadata.answer_key, REDACTED);
    assert.equal(metadata.sessionCookie, REDACTED);
    const nested = metadata.nested as { authorization: unknown; items: Record<string, unknown>[] };
    assert.equal(nested.authorization, REDACTED);
    assert.equal(nested.items[0].correctAnswer, REDACTED);
    assert.equal(nested.items[1].private_note, REDACTED);
    assert.equal(metadata.passageId, "p-1", "harmless keys that contain a fragment are kept");
    assert.equal(metadata.footprint, "small");
    assert.equal(metadata.title, "Lesson 3");
    assert.equal(JSON.stringify(event).includes("hunter2"), false);
  });

  test("sensitive-key detection is separator and case insensitive", () => {
    for (const key of ["API_KEY", "api-key", "Api.Key", "codeHash", "correct", "OTP"]) {
      assert.ok(isSensitiveAuditKey(key), key);
    }
    for (const key of ["passage", "courseCode2", "attempts", "vocabulary"]) {
      assert.equal(isSensitiveAuditKey(key), false, key);
    }
  });

  test("metadata is bounded in depth, string length and array size", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: "too deep" } } } } } } };
    const redacted = JSON.stringify(redactAuditMetadata(deep));
    assert.ok(redacted.includes("[truncated]"));
    const long = redactAuditMetadata("x".repeat(5000)) as string;
    assert.ok(long.length <= 2001);
    const big = redactAuditMetadata(Array.from({ length: 500 }, (_, i) => i)) as unknown[];
    assert.equal(big.length, 100);
    assert.equal(redactAuditMetadata(Number.NaN), null);
  });
});
