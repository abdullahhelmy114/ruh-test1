/**
 * Academy core: domain errors, governed identifiers and state machines.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, toErrorResponse } from "../../src/lib/auth/core.ts";
import { DomainError, optionalReason, requireReason, statusForDomainCode } from "../../src/lib/academy/domain/errors.ts";
import {
  ENTITY_KINDS,
  entityRef,
  isUid,
  isUuid,
  parseCorrelationId,
  parseOptionalUuid,
  parseUuid,
  toIso,
} from "../../src/lib/academy/domain/ids.ts";
import {
  APPROVAL_GATE_MACHINE,
  CERTIFICATE_MACHINE,
  CONTENT_VERSION_MACHINE,
  ENROLLMENT_MACHINE,
  MUTABLE_CONTENT_STATES,
  RECORDING_MACHINE,
  SESSION_MACHINE,
  TEACHER_APPLICATION_MACHINE,
  assertTransition,
  canTransition,
  defineMachine,
  isTerminal,
  parseState,
} from "../../src/lib/academy/domain/states.ts";

const UUID = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function expectDomainError(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => {
    assert.ok(error instanceof DomainError, "expected DomainError");
    assert.equal(error.code, code);
    return true;
  });
}

describe("domain errors", () => {
  test("DomainError is an HttpError so withApi returns its status and safe message", () => {
    const error = new DomainError("IMMUTABLE", "Published content cannot be changed.");
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 409);
    const response = toErrorResponse(error);
    assert.equal(response.status, 409);
    assert.deepEqual(response.body, { error: "Published content cannot be changed." });
  });

  test("status mapping is stable", () => {
    assert.equal(statusForDomainCode("VALIDATION"), 400);
    assert.equal(statusForDomainCode("NOT_FOUND"), 404);
    assert.equal(statusForDomainCode("CONFLICT"), 409);
    assert.equal(statusForDomainCode("POLICY_UNCONFIGURED"), 503);
    assert.equal(statusForDomainCode("FEATURE_UNAVAILABLE"), 503);
  });

  test("requireReason demands non-blank bounded text", () => {
    assert.equal(requireReason("  board decision  "), "board decision");
    for (const bad of [undefined, null, "", "   ", 42, {}]) {
      expectDomainError(() => requireReason(bad), "VALIDATION");
    }
    expectDomainError(() => requireReason("x".repeat(2001)), "VALIDATION");
  });

  test("optionalReason normalises blank to null", () => {
    assert.equal(optionalReason(undefined), null);
    assert.equal(optionalReason("   "), null);
    assert.equal(optionalReason(" ok "), "ok");
    expectDomainError(() => optionalReason(7), "VALIDATION");
  });
});

describe("governed identifiers", () => {
  test("UUIDs are validated and lower-cased", () => {
    assert.ok(isUuid(UUID));
    assert.equal(parseUuid(UUID.toUpperCase(), "id"), UUID);
    for (const bad of ["", "abc", "3f2b8c1e-4d5a-0b6c-8d7e-9f0a1b2c3d4e", 123, null, `${UUID} OR 1=1`]) {
      expectDomainError(() => parseUuid(bad, "id"), "VALIDATION");
    }
    assert.equal(parseOptionalUuid("", "id"), null);
    assert.equal(parseOptionalUuid(undefined, "id"), null);
  });

  test("Firebase uids reject whitespace and control characters", () => {
    assert.ok(isUid("abcDEF123_-"));
    assert.equal(isUid(""), false);
    assert.equal(isUid("has space"), false);
    assert.equal(isUid("x".repeat(129)), false);
    assert.equal(isUid("bad\u0000uid"), false);
  });

  test("entity references key profiles by uid and everything else by UUID", () => {
    assert.deepEqual({ ...entityRef("profile", "firebase-uid-1") }, { kind: "profile", id: "firebase-uid-1" });
    assert.deepEqual({ ...entityRef("course", UUID) }, { kind: "course", id: UUID });
    expectDomainError(() => entityRef("course", "firebase-uid-1"), "VALIDATION");
    expectDomainError(() => entityRef("class_group_policy", UUID), "VALIDATION");
    assert.ok(Object.isFrozen(entityRef("course", UUID)));
  });

  test("the entity vocabulary contains the locked product model", () => {
    for (const kind of [
      "program", "course", "curriculum", "curriculum_version", "unit", "lesson", "lesson_script",
      "lesson_script_version", "lesson_script_annotation", "class_group", "session", "enrollment",
      "submission", "assessment", "certificate", "recording",
    ]) {
      assert.ok((ENTITY_KINDS as readonly string[]).includes(kind), `missing ${kind}`);
    }
  });

  test("correlation ids are bounded and charset-limited", () => {
    assert.equal(parseCorrelationId(undefined), null);
    assert.equal(parseCorrelationId("req-2026-09-17-abc"), "req-2026-09-17-abc");
    expectDomainError(() => parseCorrelationId("short"), "VALIDATION");
    expectDomainError(() => parseCorrelationId("has spaces in it"), "VALIDATION");
  });

  test("invalid dates are rejected", () => {
    expectDomainError(() => toIso(new Date("not a date")), "VALIDATION");
  });
});

describe("state machines", () => {
  const MACHINES = [
    CONTENT_VERSION_MACHINE,
    SESSION_MACHINE,
    ENROLLMENT_MACHINE,
    RECORDING_MACHINE,
    TEACHER_APPLICATION_MACHINE,
    CERTIFICATE_MACHINE,
    APPROVAL_GATE_MACHINE,
  ];

  test("every machine is frozen and its initial state is declared", () => {
    for (const machine of MACHINES) {
      assert.ok(Object.isFrozen(machine));
      assert.ok((machine.states as readonly string[]).includes(machine.initial));
    }
  });

  test("defineMachine rejects undeclared targets and self-transitions", () => {
    assert.throws(() =>
      defineMachine({ name: "bad", states: ["a", "b"], initial: "a", transitions: { a: ["c" as "b"], b: [] } }),
    );
    assert.throws(() =>
      defineMachine({ name: "bad", states: ["a", "b"], initial: "a", transitions: { a: ["a"], b: [] } }),
    );
  });

  test("content cannot be published without review and approval", () => {
    assert.equal(canTransition(CONTENT_VERSION_MACHINE, "draft", "published"), false);
    assert.equal(canTransition(CONTENT_VERSION_MACHINE, "in_review", "published"), false);
    assert.equal(canTransition(CONTENT_VERSION_MACHINE, "approved", "published"), true);
    expectDomainError(() => assertTransition(CONTENT_VERSION_MACHINE, "draft", "published"), "INVALID_TRANSITION");
  });

  test("published content is never mutable and cannot return to draft", () => {
    assert.deepEqual([...MUTABLE_CONTENT_STATES].sort(), ["changes_requested", "draft"]);
    assert.equal(canTransition(CONTENT_VERSION_MACHINE, "published", "draft"), false);
    assert.equal(canTransition(CONTENT_VERSION_MACHINE, "published", "in_review"), false);
    assert.equal(canTransition(CONTENT_VERSION_MACHINE, "superseded", "published"), false);
  });

  test("terminal states have no exits", () => {
    assert.ok(isTerminal(CONTENT_VERSION_MACHINE, "archived"));
    assert.ok(isTerminal(CONTENT_VERSION_MACHINE, "rejected"));
    assert.ok(isTerminal(SESSION_MACHINE, "completed"));
    assert.ok(isTerminal(SESSION_MACHINE, "cancelled"));
    assert.ok(isTerminal(CERTIFICATE_MACHINE, "revoked"));
    assert.equal(canTransition(CERTIFICATE_MACHINE, "revoked", "issued"), false);
  });

  test("sessions cannot jump from scheduled to completed", () => {
    assert.equal(canTransition(SESSION_MACHINE, "scheduled", "completed"), false);
    assert.equal(canTransition(SESSION_MACHINE, "live", "completed"), true);
  });

  test("parseState rejects unknown status strings", () => {
    assert.equal(parseState(ENROLLMENT_MACHINE, "active"), "active");
    expectDomainError(() => parseState(ENROLLMENT_MACHINE, "paid"), "VALIDATION");
  });
});
