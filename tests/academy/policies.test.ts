/**
 * Academy core: policy registry and ACADEMY -> PROGRAM -> COURSE resolution.
 *
 * Required invariants covered here: policy inheritance, no class-group layer,
 * fail-closed resolution, no invented default values, and security rules /
 * the Lesson Sheet release rule are never policies.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import {
  POLICY_DEFINITIONS,
  POLICY_KEYS,
  assertNotSecurityInvariant,
  getPolicyDefinition,
  isPolicyKey,
} from "../../src/lib/academy/policies/registry.ts";
import {
  normaliseTarget,
  parseExpectedRevision,
  parsePolicyLevel,
  planResetToInherited,
  planSetPolicyValue,
  requirePolicyValue,
  resolvePolicy,
  type PolicyChangeContext,
  type PolicyValueRecord,
} from "../../src/lib/academy/policies/resolver.ts";

const PROGRAM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURSE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_COURSE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function expectCode(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);
}

let counter = 0;
function row(scope: PolicyValueRecord["scope"], scopeId: string | null, value: unknown, key = "assessment.attempt_limit"): PolicyValueRecord {
  counter++;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    key,
    scope,
    scopeId,
    value,
    revision: 1,
    setBy: "admin-1",
    setAt: "2026-09-01T00:00:00.000Z",
    reason: "Academic board decision",
  };
}

const attempts = getPolicyDefinition("assessment.attempt_limit");

describe("policy registry", () => {
  test("contains no default values: every definition is only a key, scopes and a validator", () => {
    for (const key of POLICY_KEYS) {
      const definition = POLICY_DEFINITIONS[key] as unknown as Record<string, unknown>;
      assert.deepEqual(Object.keys(definition).sort(), ["allowedScopes", "key", "parse"], key);
      assert.equal(definition.key, key);
    }
  });

  test("no class-group layer exists", () => {
    for (const key of POLICY_KEYS) {
      for (const scope of POLICY_DEFINITIONS[key].allowedScopes) {
        assert.ok(["academy", "program", "course"].includes(scope), `${key} allows ${scope}`);
      }
    }
    expectCode(() => parsePolicyLevel("class_group", COURSE), "VALIDATION");
  });

  test("security invariants and the Lesson Sheet release rule are never policies", () => {
    for (const key of POLICY_KEYS) {
      assert.doesNotThrow(() => assertNotSecurityInvariant(key), key);
    }
    for (const forbidden of [
      "lesson_sheet.release_offset",
      "content.release_rule",
      "auth.session_length",
      "grading.answer_visibility",
      "annotations.private_visibility",
      "roles.teacher_can_publish",
      "access.entitlement_bypass",
      "notes.privacy",
    ]) {
      assert.throws(() => assertNotSecurityInvariant(forbidden), forbidden);
      assert.equal(isPolicyKey(forbidden), false);
    }
  });

  test("unknown keys are not found", () => {
    expectCode(() => getPolicyDefinition("pricing.discount"), "NOT_FOUND");
  });

  test("the institution time zone is academy-wide and must be a real IANA zone", () => {
    const tz = getPolicyDefinition("institution.timezone");
    assert.deepEqual([...tz.allowedScopes], ["academy"]);
    assert.equal(tz.parse("Europe/Istanbul"), "Europe/Istanbul");
    expectCode(() => tz.parse("Mars/Olympus_Mons"), "VALIDATION");
    expectCode(() => tz.parse(""), "VALIDATION");
    expectCode(() => tz.parse(3), "VALIDATION");
  });

  test("validators reject unknown and missing fields", () => {
    expectCode(() => attempts.parse({ maxAttempts: 3, bonus: true }), "VALIDATION");
    expectCode(() => attempts.parse({}), "VALIDATION");
    expectCode(() => attempts.parse([]), "VALIDATION");
    expectCode(() => attempts.parse({ maxAttempts: 0 }), "VALIDATION");
    expectCode(() => attempts.parse({ maxAttempts: 2.5 }), "VALIDATION");
    assert.deepEqual({ ...attempts.parse({ maxAttempts: null }) }, { maxAttempts: null });
  });

  test("dependent fields must be consistent", () => {
    const late = getPolicyDefinition("learning.late_work");
    expectCode(() => late.parse({ acceptLateSubmissions: false, latestHoursAfterDue: 24, markAsLate: true }), "VALIDATION");
    assert.doesNotThrow(() => late.parse({ acceptLateSubmissions: true, latestHoursAfterDue: 48, markAsLate: true }));

    const revision = getPolicyDefinition("learning.revision");
    expectCode(() => revision.parse({ revisionAllowed: false, maxRevisions: 2 }), "VALIDATION");

    const recordings = getPolicyDefinition("recordings.access");
    expectCode(() => recordings.parse({ learnerAccess: "none", availableForDays: 30, downloadAllowed: false }), "VALIDATION");
    expectCode(() => recordings.parse({ learnerAccess: "none", availableForDays: null, downloadAllowed: true }), "VALIDATION");
    expectCode(() => recordings.parse({ learnerAccess: "public", availableForDays: null, downloadAllowed: false }), "VALIDATION");
  });

  test("assessment modes are validated, de-duplicated and canonically ordered", () => {
    const requirements = getPolicyDefinition("assessment.requirements");
    assert.deepEqual([...requirements.parse({ requiredModes: ["final", "quiz"] }).requiredModes], ["quiz", "final"]);
    expectCode(() => requirements.parse({ requiredModes: ["quiz", "quiz"] }), "VALIDATION");
    expectCode(() => requirements.parse({ requiredModes: ["xp_challenge"] }), "VALIDATION");
  });

  test("attendance vocabulary needs trilingual labels and unique codes", () => {
    const vocabulary = getPolicyDefinition("attendance.vocabulary");
    const labels = { en: "Present", ar: "حاضر", tr: "Var" };
    const parsed = vocabulary.parse({ marks: [{ code: "present", countsAsAttended: true, labels }] });
    assert.equal(parsed.marks[0].labels.ar, "حاضر");
    expectCode(() => vocabulary.parse({ marks: [] }), "VALIDATION");
    expectCode(
      () => vocabulary.parse({ marks: [{ code: "present", countsAsAttended: true, labels: { en: "Present", ar: "حاضر" } }] }),
      "VALIDATION",
    );
    expectCode(
      () =>
        vocabulary.parse({
          marks: [
            { code: "present", countsAsAttended: true, labels },
            { code: "present", countsAsAttended: false, labels },
          ],
        }),
      "VALIDATION",
    );
    expectCode(() => vocabulary.parse({ marks: [{ code: "Present!", countsAsAttended: true, labels }] }), "VALIDATION");
  });
});

describe("policy resolution", () => {
  const target = { programId: PROGRAM, courseId: COURSE };

  test("unconfigured settings fail closed", () => {
    const resolution = resolvePolicy(attempts, [], target);
    assert.equal(resolution.status, "unconfigured");
    expectCode(() => requirePolicyValue(resolution), "POLICY_UNCONFIGURED");
  });

  test("academy default applies when nothing overrides it", () => {
    const academy = row("academy", null, { maxAttempts: 3 });
    const resolution = resolvePolicy(attempts, [academy], target);
    assert.equal(resolution.status, "resolved");
    if (resolution.status !== "resolved") return;
    assert.deepEqual({ ...resolution.effectiveValue }, { maxAttempts: 3 });
    assert.equal(resolution.source, "academy");
    assert.equal(resolution.isOverride, false);
    assert.equal(resolution.inheritedValue, null);
    assert.deepEqual(resolution.trail.map((t) => [t.scope, t.defined]), [["academy", true], ["program", false], ["course", false]]);
  });

  test("program overrides academy, course overrides program", () => {
    const academy = row("academy", null, { maxAttempts: 3 });
    const program = row("program", PROGRAM, { maxAttempts: 2 });
    const course = row("course", COURSE, { maxAttempts: 1 });

    const programLevel = resolvePolicy(attempts, [academy, program], target);
    assert.ok(programLevel.status === "resolved");
    assert.equal(programLevel.source, "program");
    assert.deepEqual({ ...programLevel.effectiveValue }, { maxAttempts: 2 });
    assert.deepEqual({ ...programLevel.inheritedValue }, { maxAttempts: 3 });
    assert.equal(programLevel.inheritedSource, "academy");
    assert.equal(programLevel.isOverride, true);

    const courseLevel = resolvePolicy(attempts, [academy, program, course], target);
    assert.ok(courseLevel.status === "resolved");
    assert.equal(courseLevel.source, "course");
    assert.deepEqual({ ...courseLevel.effectiveValue }, { maxAttempts: 1 });
    assert.deepEqual({ ...courseLevel.inheritedValue }, { maxAttempts: 2 });
    assert.equal(courseLevel.inheritedSource, "program");
  });

  test("a course override inherits past an undefined program level", () => {
    const academy = row("academy", null, { maxAttempts: 3 });
    const course = row("course", COURSE, { maxAttempts: 5 });
    const resolution = resolvePolicy(attempts, [academy, course], target);
    assert.ok(resolution.status === "resolved");
    assert.equal(resolution.source, "course");
    assert.equal(resolution.inheritedSource, "academy");
  });

  test("overrides for other courses or programs never leak in", () => {
    const academy = row("academy", null, { maxAttempts: 3 });
    const otherCourse = row("course", OTHER_COURSE, { maxAttempts: 9 });
    const resolution = resolvePolicy(attempts, [academy, otherCourse], target);
    assert.ok(resolution.status === "resolved");
    assert.equal(resolution.source, "academy");
  });

  test("a corrupt stored value fails closed instead of falling back", () => {
    const academy = row("academy", null, { maxAttempts: 3 });
    const broken = row("course", COURSE, { maxAttempts: "lots" });
    expectCode(() => resolvePolicy(attempts, [academy, broken], target), "POLICY_UNCONFIGURED");
  });

  test("duplicate rows at one level are reported as inconsistent", () => {
    const a = row("academy", null, { maxAttempts: 3 });
    const b = row("academy", null, { maxAttempts: 4 });
    expectCode(() => resolvePolicy(attempts, [a, b], target), "CONFLICT");
  });

  test("academy-only settings ignore program and course levels", () => {
    const tz = getPolicyDefinition("institution.timezone");
    const academy = row("academy", null, "Europe/Istanbul", "institution.timezone");
    const rogue = row("course", COURSE, "Asia/Tokyo", "institution.timezone");
    const resolution = resolvePolicy(tz, [academy, rogue], target);
    assert.ok(resolution.status === "resolved");
    assert.equal(resolution.effectiveValue, "Europe/Istanbul");
    assert.equal(resolution.trail.length, 1);
  });

  test("targets are validated", () => {
    assert.deepEqual(normaliseTarget({ programId: PROGRAM.toUpperCase(), courseId: undefined }), { programId: PROGRAM, courseId: null });
    expectCode(() => normaliseTarget({ courseId: "1 OR 1=1" }), "VALIDATION");
  });
});

describe("policy changes", () => {
  const ctx: PolicyChangeContext = {
    actor: { uid: "admin-1", role: "admin" },
    clock: () => new Date("2026-09-17T12:00:00.000Z"),
    newId: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  };

  test("levels and revisions are validated", () => {
    assert.deepEqual(parsePolicyLevel("academy", undefined), { scope: "academy", scopeId: null });
    assert.deepEqual(parsePolicyLevel("course", COURSE), { scope: "course", scopeId: COURSE });
    expectCode(() => parsePolicyLevel("academy", COURSE), "VALIDATION");
    expectCode(() => parsePolicyLevel("program", "nope"), "VALIDATION");
    assert.equal(parseExpectedRevision(null), null);
    assert.equal(parseExpectedRevision(4), 4);
    expectCode(() => parseExpectedRevision(0), "VALIDATION");
    expectCode(() => parseExpectedRevision("4"), "VALIDATION");
  });

  test("setting a first override creates revision 1 with a reasoned audit", () => {
    const change = planSetPolicyValue(
      attempts,
      { scope: "course", scopeId: COURSE, value: { maxAttempts: 2 }, reason: "Pilot cohort", expectedRevision: null, existing: [] },
      ctx,
    );
    assert.equal(change.record.revision, 1);
    assert.equal(change.record.id, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
    assert.equal(change.previous, null);
    assert.equal(change.audit.action, "policy.set_value");
    assert.equal((change.audit.metadata as Record<string, unknown>).newRevision, 1);
    assert.doesNotThrow(() => buildAuditEvent(change.audit));
  });

  test("updating keeps the row identity, bumps the revision and records the previous value", () => {
    const existing = { ...row("course", COURSE, { maxAttempts: 2 }), revision: 3 };
    const change = planSetPolicyValue(
      attempts,
      { scope: "course", scopeId: COURSE, value: { maxAttempts: 4 }, reason: "Board review", expectedRevision: 3, existing: [existing] },
      ctx,
    );
    assert.equal(change.record.id, existing.id);
    assert.equal(change.record.revision, 4);
    const metadata = change.audit.metadata as Record<string, unknown>;
    assert.deepEqual(metadata.previousValue, { maxAttempts: 2 });
    assert.deepEqual({ ...(metadata.newValue as object) }, { maxAttempts: 4 });
  });

  test("stale edits, missing reasons, invalid values and disallowed scopes are refused", () => {
    const existing = { ...row("course", COURSE, { maxAttempts: 2 }), revision: 3 };
    const base = { scope: "course", scopeId: COURSE, value: { maxAttempts: 4 }, reason: "Board review", expectedRevision: 3, existing: [existing] };
    expectCode(() => planSetPolicyValue(attempts, { ...base, expectedRevision: 2 }, ctx), "CONFLICT");
    expectCode(() => planSetPolicyValue(attempts, { ...base, expectedRevision: null }, ctx), "CONFLICT");
    expectCode(() => planSetPolicyValue(attempts, { ...base, reason: " " }, ctx), "VALIDATION");
    expectCode(() => planSetPolicyValue(attempts, { ...base, value: { maxAttempts: -1 } }, ctx), "VALIDATION");
    const tz = getPolicyDefinition("institution.timezone");
    expectCode(
      () => planSetPolicyValue(tz, { scope: "course", scopeId: COURSE, value: "Asia/Tokyo", reason: "x", expectedRevision: null, existing: [] }, ctx),
      "VALIDATION",
    );
  });

  test("reset to inherited removes an override; the academy default cannot be reset", () => {
    const existing = { ...row("program", PROGRAM, { maxAttempts: 2 }), revision: 2 };
    const reset = planResetToInherited(
      attempts,
      { scope: "program", scopeId: PROGRAM, reason: "Align with academy", expectedRevision: 2, existing: [existing] },
      ctx,
    );
    assert.equal(reset.removed.id, existing.id);
    assert.equal(reset.audit.action, "policy.reset_to_inherited");
    assert.doesNotThrow(() => buildAuditEvent(reset.audit));

    expectCode(
      () => planResetToInherited(attempts, { scope: "program", scopeId: PROGRAM, reason: "x", expectedRevision: 1, existing: [existing] }, ctx),
      "CONFLICT",
    );
    expectCode(
      () => planResetToInherited(attempts, { scope: "program", scopeId: PROGRAM, reason: "x", expectedRevision: 1, existing: [] }, ctx),
      "NOT_FOUND",
    );
    expectCode(
      () => planResetToInherited(attempts, { scope: "academy", scopeId: null, reason: "x", expectedRevision: 1, existing: [] }, ctx),
      "VALIDATION",
    );
  });
});
