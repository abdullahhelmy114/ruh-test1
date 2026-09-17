/**
 * Academy core: SQL helpers, repositories and the policy service (fake executor).
 *
 * Required invariants covered here: governed mutations are written together
 * with their audit event in one statement, only administrators change policy,
 * stale edits are refused, and the capability flag never grants access.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { AuthError, type AuthUser } from "../../src/lib/auth/core.ts";
import { buildAuditEvent } from "../../src/lib/academy/audit/audit.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import { assertAcademyCoreAvailable, readAcademyFlags } from "../../src/lib/academy/infra/flags.ts";
import {
  isUniqueViolation,
  joinQueries,
  jsonParam,
  shiftPlaceholders,
  sqlQuery,
  type SqlExecutor,
  type SqlQuery,
  type SqlRow,
} from "../../src/lib/academy/infra/sql.ts";
import { insertAuditEventQuery, listAuditEventsQuery, mapAuditRow, withAudit } from "../../src/lib/academy/repo/audit-repo.ts";
import { mapPolicyValueRow, selectPolicyValuesForTargetQuery } from "../../src/lib/academy/repo/policy-repo.ts";
import { createPolicyService } from "../../src/lib/academy/services/policy-service.ts";

const PROGRAM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURSE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const admin: AuthUser = { uid: "admin-1", profileId: "p-admin", role: "admin", email: "admin@example.test" };
const teacher: AuthUser = { uid: "teacher-1", profileId: "p-teacher", role: "teacher", email: "teacher@example.test" };
const student: AuthUser = { uid: "student-1", profileId: "p-student", role: "student", email: "student@example.test" };

function expectCode(promiseOrFn: Promise<unknown>, code: string) {
  return assert.rejects(promiseOrFn, (error: unknown) => error instanceof DomainError && error.code === code);
}

/** Largest $n placeholder used in a query. */
function maxPlaceholder(text: string): number {
  let max = 0;
  for (const match of text.matchAll(/\$(\d+)/g)) max = Math.max(max, Number(match[1]));
  return max;
}

function sampleEvent() {
  return buildAuditEvent(
    {
      actor: { uid: "admin-1", role: "admin" },
      action: "policy.set_value",
      object: { kind: "policy_value", id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" },
      reason: "Board decision",
      rollback: { capable: true, strategy: "Reset to inherited." },
      metadata: { key: "assessment.attempt_limit" },
    },
    { clock: () => new Date("2026-09-17T12:00:00.000Z"), newId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff" },
  );
}

describe("sql helpers", () => {
  test("sqlQuery never interpolates values into the text", () => {
    const hostile = "x'; DROP TABLE profiles; --";
    const query = sqlQuery`SELECT 1 FROM t WHERE a = ${hostile} AND b = ${2}`;
    assert.equal(query.text, "SELECT 1 FROM t WHERE a = $1 AND b = $2");
    assert.deepEqual([...query.values], [hostile, 2]);
    assert.equal(query.text.includes("DROP"), false);
  });

  test("joinQueries renumbers placeholders across fragments", () => {
    const joined = joinQueries([sqlQuery`a = ${1}`, sqlQuery`b = ${2} AND c = ${3}`, sqlQuery`d = ${4}`], " AND ");
    assert.equal(joined.text, "a = $1 AND b = $2 AND c = $3 AND d = $4");
    assert.deepEqual([...joined.values], [1, 2, 3, 4]);
    assert.equal(shiftPlaceholders("$1, $12", 3), "$4, $15");
  });

  test("json parameters and unique violations", () => {
    assert.equal(jsonParam(undefined), "null");
    assert.equal(jsonParam({ a: 1 }), '{"a":1}');
    assert.equal(isUniqueViolation({ code: "23505" }), true);
    assert.equal(isUniqueViolation(new Error("23505")), false);
  });
});

describe("feature flag", () => {
  test("only the exact string true enables the academy core", () => {
    assert.equal(readAcademyFlags({ ACADEMY_CORE_SCHEMA_READY: "true" }).coreSchemaReady, true);
    for (const value of [undefined, "", "1", "TRUE", "yes"]) {
      assert.equal(readAcademyFlags({ ACADEMY_CORE_SCHEMA_READY: value }).coreSchemaReady, false);
    }
    assert.throws(
      () => assertAcademyCoreAvailable({ coreSchemaReady: false }),
      (error: unknown) => error instanceof DomainError && error.code === "FEATURE_UNAVAILABLE" && error.status === 503,
    );
  });
});

describe("audit repository", () => {
  test("stand-alone insert has one placeholder per value and casts every audit column", () => {
    const query = insertAuditEventQuery(sampleEvent());
    assert.match(query.text, /^INSERT INTO academy_audit_events \(/);
    assert.equal(maxPlaceholder(query.text), query.values.length);
    assert.equal(query.values.length, 18);
    for (const cast of ["::uuid", "::timestamptz", "::boolean", "::jsonb", "::text"]) {
      assert.ok(query.text.includes(cast), cast);
    }
  });

  test("withAudit couples the mutation and the audit insert in one statement", () => {
    const mutation = sqlQuery`UPDATE academy_policy_values SET revision = ${2} WHERE id = ${"x"}::uuid AND revision = ${1} RETURNING id`;
    const query = withAudit(mutation, sampleEvent());
    assert.match(query.text, /^WITH mutated AS \(UPDATE academy_policy_values/);
    assert.match(query.text, /\) INSERT INTO academy_audit_events \([\s\S]*\) SELECT /);
    assert.match(query.text, / FROM mutated RETURNING id$/);
    assert.equal(maxPlaceholder(query.text), query.values.length);
    assert.equal(query.values.length, 3 + 18);
    assert.deepEqual(query.values.slice(0, 3), [2, "x", 1]);
  });

  test("withAudit refuses a mutation without RETURNING (it could not detect a no-op)", () => {
    assert.throws(() => withAudit(sqlQuery`DELETE FROM academy_policy_values WHERE id = ${"x"}`, sampleEvent()));
  });

  test("the audit trail is paged newest-first with validated filters", () => {
    const query = listAuditEventsQuery({ objectKind: "course", actorUid: "admin-1", before: "2026-09-17T00:00:00Z", limit: 5000 });
    assert.match(query.text, / WHERE object_kind = \$1 AND actor_uid = \$2 AND occurred_at < \$3::timestamptz ORDER BY occurred_at DESC, id DESC LIMIT \$4$/);
    assert.equal(query.values[3], 200);
    assert.throws(() => listAuditEventsQuery({ objectKind: "users" }), DomainError);
    assert.throws(() => listAuditEventsQuery({ action: "x; DROP" }), DomainError);
    assert.throws(() => listAuditEventsQuery({ before: "yesterday" }), DomainError);
    assert.equal(listAuditEventsQuery({ limit: 0 }).values[0], 1);
  });

  test("audit rows map to the read model", () => {
    const item = mapAuditRow({
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      occurred_at: new Date("2026-09-17T12:00:00.000Z"),
      actor_uid: "admin-1",
      actor_role: "admin",
      action: "policy.set_value",
      impact: "high",
      object_kind: "policy_value",
      object_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      reason: "Board decision",
      correlation_id: null,
    });
    assert.equal(item.occurredAt, "2026-09-17T12:00:00.000Z");
    assert.equal(item.actorRole, "admin");
  });
});

describe("policy repository", () => {
  test("target query only reaches the academy row and this target's overrides", () => {
    const query = selectPolicyValuesForTargetQuery("assessment.attempt_limit", { programId: PROGRAM, courseId: COURSE });
    assert.deepEqual([...query.values], ["assessment.attempt_limit", PROGRAM, COURSE]);
    assert.equal(maxPlaceholder(query.text), 3);
    assert.ok(query.text.includes("scope = 'academy'"));
    assert.ok(query.text.includes("program_id = $2::uuid"));
    assert.ok(query.text.includes("course_id = $3::uuid"));
  });

  test("rows map to records with parsed JSON and numeric revisions", () => {
    const record = mapPolicyValueRow({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      policy_key: "assessment.attempt_limit",
      scope: "course",
      program_id: null,
      course_id: COURSE,
      value: '{"maxAttempts":2}',
      revision: "3",
      set_by: "admin-1",
      set_at: new Date("2026-09-17T12:00:00.000Z"),
      reason: "Board decision",
    });
    assert.equal(record.scopeId, COURSE);
    assert.deepEqual(record.value, { maxAttempts: 2 });
    assert.equal(record.revision, 3);
    assert.equal(record.setAt, "2026-09-17T12:00:00.000Z");
  });
});

interface FakeExecutor extends SqlExecutor {
  readonly calls: SqlQuery[];
}

function fakeExecutor(respond: (query: SqlQuery, index: number) => SqlRow[] | Error): FakeExecutor {
  const calls: SqlQuery[] = [];
  return {
    calls,
    async query<T extends SqlRow = SqlRow>(query: SqlQuery): Promise<T[]> {
      calls.push(query);
      const result = respond(query, calls.length - 1);
      if (result instanceof Error) throw result;
      return result as T[];
    },
    async transaction() {
      throw new Error("not used");
    },
  };
}

function ids() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

const READY = { coreSchemaReady: true };
const clock = () => new Date("2026-09-17T12:00:00.000Z");

function storedRow(revision: number, scope = "course") {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    policy_key: "assessment.attempt_limit",
    scope,
    program_id: scope === "program" ? PROGRAM : null,
    course_id: scope === "course" ? COURSE : null,
    value: { maxAttempts: 2 },
    revision,
    set_by: "admin-1",
    set_at: "2026-09-01T00:00:00.000Z",
    reason: "Earlier decision",
  };
}

describe("policy service", () => {
  const request = {
    key: "assessment.attempt_limit",
    scope: "course",
    scopeId: COURSE,
    value: { maxAttempts: 3 },
    reason: "Board decision",
    expectedRevision: null,
  };

  test("is unavailable (503) until the schema is ready, before touching the database", async () => {
    const executor = fakeExecutor(() => []);
    const service = createPolicyService({ executor, flags: { coreSchemaReady: false } });
    await expectCode(service.setValue(admin, request), "FEATURE_UNAVAILABLE");
    await expectCode(service.resolve("assessment.attempt_limit", {}), "FEATURE_UNAVAILABLE");
    assert.equal(executor.calls.length, 0);
  });

  test("only administrators can change policy; the database is never reached otherwise", async () => {
    for (const user of [teacher, student]) {
      const executor = fakeExecutor(() => []);
      const service = createPolicyService({ executor, flags: READY });
      await assert.rejects(service.setValue(user, request), (error: unknown) => error instanceof AuthError && error.status === 403);
      await assert.rejects(
        service.resetToInherited(user, { ...request, expectedRevision: 1 }),
        (error: unknown) => error instanceof AuthError && error.status === 403,
      );
      assert.equal(executor.calls.length, 0, `${user.role} reached the database`);
    }
  });

  test("a first value is inserted together with its audit event in one statement", async () => {
    const executor = fakeExecutor((_query, index) => (index === 0 ? [] : [{ id: "audit" }]));
    const service = createPolicyService({ executor, flags: READY, clock, newId: ids() });
    const record = await service.setValue(admin, request);
    assert.equal(record.revision, 1);
    assert.equal(executor.calls.length, 2);
    const write = executor.calls[1];
    assert.match(write.text, /^WITH mutated AS \(INSERT INTO academy_policy_values/);
    assert.ok(write.text.includes("INSERT INTO academy_audit_events"));
    assert.ok(write.values.includes("policy.set_value"));
    assert.ok(write.values.includes("Board decision"));
  });

  test("an existing value is updated against the revision the editor saw", async () => {
    const executor = fakeExecutor((_query, index) => (index === 0 ? [storedRow(4)] : [{ id: "audit" }]));
    const service = createPolicyService({ executor, flags: READY, clock, newId: ids() });
    const record = await service.setValue(admin, { ...request, expectedRevision: 4 });
    assert.equal(record.revision, 5);
    const write = executor.calls[1];
    assert.match(write.text, /^WITH mutated AS \(UPDATE academy_policy_values/);
    assert.ok(write.values.includes(4), "the WHERE clause checks the expected revision");
  });

  test("a stale editor is refused before writing", async () => {
    const executor = fakeExecutor(() => [storedRow(4)]);
    const service = createPolicyService({ executor, flags: READY, clock, newId: ids() });
    await expectCode(service.setValue(admin, { ...request, expectedRevision: 3 }), "CONFLICT");
    assert.equal(executor.calls.length, 1);
  });

  test("a concurrent change detected by the database (zero rows or unique violation) is a conflict", async () => {
    const zeroRows = fakeExecutor((_query, index) => (index === 0 ? [storedRow(4)] : []));
    await expectCode(
      createPolicyService({ executor: zeroRows, flags: READY, clock, newId: ids() }).setValue(admin, { ...request, expectedRevision: 4 }),
      "CONFLICT",
    );
    const duplicate = Object.assign(new Error("duplicate key"), { code: "23505" });
    const race = fakeExecutor((_query, index) => (index === 0 ? [] : duplicate));
    await expectCode(createPolicyService({ executor: race, flags: READY, clock, newId: ids() }).setValue(admin, request), "CONFLICT");
  });

  test("unexpected database errors are not disguised as conflicts", async () => {
    const executor = fakeExecutor((_query, index) => (index === 0 ? [] : new Error("connection reset")));
    await assert.rejects(
      createPolicyService({ executor, flags: READY, clock, newId: ids() }).setValue(admin, request),
      (error: unknown) => !(error instanceof DomainError) && (error as Error).message === "connection reset",
    );
  });

  test("invalid keys, levels, values and revisions are rejected before any write", async () => {
    const executor = fakeExecutor(() => []);
    const service = createPolicyService({ executor, flags: READY, clock, newId: ids() });
    await expectCode(service.setValue(admin, { ...request, key: "pricing.discount" }), "NOT_FOUND");
    await expectCode(service.setValue(admin, { ...request, scope: "class_group" }), "VALIDATION");
    await expectCode(service.setValue(admin, { ...request, expectedRevision: "1" }), "VALIDATION");
    await expectCode(service.setValue(admin, { ...request, value: { maxAttempts: 0 } }), "VALIDATION");
    assert.ok(executor.calls.every((call) => call.text.startsWith("SELECT")), "no write was attempted");
  });

  test("reset to inherited deletes the override with its audit event and requires a revision", async () => {
    const executor = fakeExecutor((_query, index) => (index === 0 ? [storedRow(2)] : [{ id: "audit" }]));
    const service = createPolicyService({ executor, flags: READY, clock, newId: ids() });
    await expectCode(service.resetToInherited(admin, { ...request, expectedRevision: null }), "VALIDATION");
    const removed = await service.resetToInherited(admin, { ...request, expectedRevision: 2 });
    assert.equal(removed.revision, 2);
    const write = executor.calls[executor.calls.length - 1];
    assert.match(write.text, /^WITH mutated AS \(DELETE FROM academy_policy_values/);
    assert.ok(write.text.includes("scope <> 'academy'"));
    assert.ok(write.values.includes("policy.reset_to_inherited"));
  });

  test("resolve reads the stored levels and applies inheritance", async () => {
    const academyRow = { ...storedRow(1, "academy"), id: "11111111-1111-4111-8111-111111111111", value: { maxAttempts: 3 } };
    const executor = fakeExecutor(() => [academyRow, storedRow(1)]);
    const service = createPolicyService({ executor, flags: READY });
    const resolution = await service.resolve("assessment.attempt_limit", { programId: PROGRAM, courseId: COURSE });
    assert.equal(resolution.status, "resolved");
    if (resolution.status === "resolved") {
      assert.equal(resolution.source, "course");
      assert.equal(resolution.inheritedSource, "academy");
    }
  });
});
