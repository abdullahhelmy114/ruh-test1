/**
 * Shared fixtures for academy tests: users, deterministic ids and clocks,
 * database-shaped rows, and a scriptable fake SqlExecutor that records every
 * statement without touching a database.
 */
import assert from "node:assert/strict";
import { AuthError, type AuthUser } from "../../src/lib/auth/core.ts";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import type { SqlExecutor, SqlQuery, SqlRow } from "../../src/lib/academy/infra/sql.ts";

export const admin: AuthUser = { uid: "admin-1", profileId: "p-admin-1", role: "admin", email: "admin1@example.test" };
export const admin2: AuthUser = { uid: "admin-2", profileId: "p-admin-2", role: "admin", email: "admin2@example.test" };
export const teacher: AuthUser = { uid: "teacher-1", profileId: "p-teacher-1", role: "teacher", email: "teacher1@example.test" };
export const student: AuthUser = { uid: "student-1", profileId: "p-student-1", role: "student", email: "student1@example.test" };

export const IDS = {
  program: "a0000000-0000-4000-8000-000000000001",
  course: "c0000000-0000-4000-8000-000000000001",
  curriculum: "c1000000-0000-4000-8000-000000000001",
  version1: "c2000000-0000-4000-8000-000000000001",
  version2: "c2000000-0000-4000-8000-000000000002",
  unit1: "d0000000-0000-4000-8000-000000000001",
  lesson1: "e0000000-0000-4000-8000-000000000001",
  lesson2: "e0000000-0000-4000-8000-000000000002",
  classGroup: "f0000000-0000-4000-8000-000000000001",
  session: "f1000000-0000-4000-8000-000000000001",
  enrollment: "f2000000-0000-4000-8000-000000000001",
  assignment: "f3000000-0000-4000-8000-000000000001",
} as const;

export function sequentialIds(prefix = "99999999") {
  let n = 0;
  return () => `${prefix}-0000-4000-8000-${String(++n).padStart(12, "0")}`;
}

export const fixedClock = () => new Date("2026-09-17T12:00:00.000Z");

export function expectDomain(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof DomainError && error.code === code);
}

export function rejectsDomain(promise: Promise<unknown>, code: string): Promise<void> {
  return assert.rejects(promise, (error: unknown) => {
    if (!(error instanceof DomainError)) throw error;
    assert.equal(error.code, code, error.message);
    return true;
  });
}

export function rejectsForbidden(promise: Promise<unknown>): Promise<void> {
  return assert.rejects(promise, (error: unknown) => error instanceof AuthError && error.status === 403);
}

/** Largest $n placeholder in a statement. */
export function maxPlaceholder(text: string): number {
  let max = 0;
  for (const match of text.matchAll(/\$(\d+)/g)) max = Math.max(max, Number(match[1]));
  return max;
}

export function assertWellFormed(query: SqlQuery): void {
  assert.equal(maxPlaceholder(query.text), query.values.length, query.text.slice(0, 120));
  for (let i = 1; i <= query.values.length; i++) {
    assert.ok(new RegExp(`\\$${i}(?!\\d)`).test(query.text), `placeholder $${i} unused in ${query.text.slice(0, 80)}`);
  }
}

// ---------------------------------------------------------------------------
// Fake executor
// ---------------------------------------------------------------------------

export interface Rule {
  readonly match: RegExp;
  readonly rows: SqlRow[] | ((query: SqlQuery) => SqlRow[]);
}

export interface FakeExecutor extends SqlExecutor {
  readonly queries: SqlQuery[];
  readonly transactions: SqlQuery[][];
  failTransactionWith: unknown;
}

export function fakeExecutor(rules: Rule[] = []): FakeExecutor {
  const queries: SqlQuery[] = [];
  const transactions: SqlQuery[][] = [];
  const executor: FakeExecutor = {
    queries,
    transactions,
    failTransactionWith: null,
    async query<T extends SqlRow = SqlRow>(query: SqlQuery): Promise<T[]> {
      queries.push(query);
      const rule = rules.find((r) => r.match.test(query.text));
      if (!rule) return [];
      return (typeof rule.rows === "function" ? rule.rows(query) : rule.rows) as T[];
    },
    async transaction(statements: readonly SqlQuery[]) {
      transactions.push([...statements]);
      if (executor.failTransactionWith) throw executor.failTransactionWith;
      return statements.map(() => [{ ok: true }]);
    },
  };
  return executor;
}

// ---------------------------------------------------------------------------
// Database-shaped rows
// ---------------------------------------------------------------------------

const AT = "2026-09-01T08:00:00.000Z";

export function programRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: IDS.program, slug: "arabic-foundations", title: "Arabic Foundations", description: null, status: "active",
    revision: 1, created_by: "admin-1", created_at: new Date(AT), updated_by: "admin-1", updated_at: new Date(AT),
    deleted_at: null, deleted_by: null, deletion_reason: null, ...overrides,
  };
}

export function courseRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: IDS.course, program_id: IDS.program, catalog_course_id: null, slug: "nahw-1", title: "Nahw 1", description: null,
    status: "active", revision: 3, created_by: "admin-1", created_at: AT, updated_by: "admin-1", updated_at: AT,
    deleted_at: null, deleted_by: null, deletion_reason: null, ...overrides,
  };
}

export function curriculumRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return { id: IDS.curriculum, course_id: IDS.course, created_by: "admin-1", created_at: AT, ...overrides };
}

export function versionRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: IDS.version1, curriculum_id: IDS.curriculum, version_number: 1, based_on_version_id: null, state: "published",
    revision: 4, created_by: "admin-1", created_at: AT, updated_at: AT, submitted_at: AT, reviewed_by: "admin-2",
    reviewed_at: AT, published_by: "admin-2", published_at: AT, superseded_at: null, archived_at: null, ...overrides,
  };
}

export function classGroupRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: IDS.classGroup, course_id: IDS.course, curriculum_id: IDS.curriculum, curriculum_version_id: IDS.version1,
    name: "Autumn cohort", status: "active", status_reason: null, capacity: null, starts_on: "2026-10-01", ends_on: "2026-12-20",
    revision: 2, created_by: "admin-1", created_at: AT, updated_by: "admin-1", updated_at: AT,
    deleted_at: null, deleted_by: null, deletion_reason: null, ...overrides,
  };
}

export function sessionRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: IDS.session, class_group_id: IDS.classGroup, curriculum_version_id: IDS.version1, lesson_id: IDS.lesson1,
    starts_at: new Date("2026-10-05T16:00:00.000Z"), ends_at: new Date("2026-10-05T17:30:00.000Z"), state: "scheduled",
    state_reason: null, meeting_url: null, revision: 1, created_by: "admin-1", created_at: AT, updated_by: "admin-1",
    updated_at: AT, ...overrides,
  };
}

export function enrollmentRow(overrides: Partial<SqlRow> = {}): SqlRow {
  return {
    id: IDS.enrollment, class_group_id: IDS.classGroup, course_id: IDS.course, learner_uid: "student-1", state: "active",
    source: "admin", state_reason: null, revision: 1, created_by: "admin-1", created_at: AT, updated_by: "admin-1",
    updated_at: AT, activated_at: AT, ended_at: null, ...overrides,
  };
}
