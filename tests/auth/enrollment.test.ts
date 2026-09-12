/**
 * Phase 2.4a — behavioural tests for the central enrollment guard.
 *
 * `createEnrollmentGuard` receives its `isEnrolled` lookup by injection, so
 * these tests run without a database. The production binding in
 * src/lib/auth/index.ts queries `enrollments(user_uid, course_id)`.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  AuthError,
  HttpError,
  createEnrollmentGuard,
  toErrorResponse,
  type AuthUser,
} from "../../src/lib/auth/core.ts";

const student: AuthUser = { uid: "uid-student", profileId: "p1", role: "student", email: "s@example.com" };
const admin: AuthUser = { uid: "uid-admin", profileId: "p9", role: "admin", email: "a@example.com" };
const teacher: AuthUser = { uid: "uid-teacher", profileId: "p5", role: "teacher", email: "t@example.com" };

function makeGuard(enrollments: Array<[string, string]>) {
  const calls: Array<[string, string]> = [];
  const guard = createEnrollmentGuard({
    async isEnrolled(uid, courseId) {
      calls.push([uid, courseId]);
      return enrollments.some(([u, c]) => u === uid && c === courseId);
    },
  });
  return { guard, calls };
}

describe("requireEnrolled (createEnrollmentGuard)", () => {
  test("enrolled student passes and the lookup is keyed by uid + courseId", async () => {
    const { guard, calls } = makeGuard([["uid-student", "course-1"]]);
    await guard(student, "course-1");
    assert.deepEqual(calls, [["uid-student", "course-1"]]);
  });

  test("unenrolled student is rejected with 403 FORBIDDEN", async () => {
    const { guard } = makeGuard([]);
    await assert.rejects(guard(student, "course-1"), (err: unknown) => {
      assert.ok(err instanceof AuthError);
      assert.equal(err.status, 403);
      assert.equal(err.code, "FORBIDDEN");
      return true;
    });
  });

  test("enrollment in a different course does not grant access (wrong course)", async () => {
    const { guard } = makeGuard([["uid-student", "course-1"]]);
    await assert.rejects(guard(student, "course-2"), (err: unknown) => err instanceof AuthError && err.status === 403);
  });

  test("another user's enrollment does not grant access", async () => {
    const { guard } = makeGuard([["uid-other", "course-1"]]);
    await assert.rejects(guard(student, "course-1"), (err: unknown) => err instanceof AuthError && err.status === 403);
  });

  test("teachers are not exempt: they need an enrollment like anyone else", async () => {
    const { guard } = makeGuard([]);
    await assert.rejects(guard(teacher, "course-1"), (err: unknown) => err instanceof AuthError && err.status === 403);
  });

  test("admin bypasses the check without touching the lookup", async () => {
    const { guard, calls } = makeGuard([]);
    await guard(admin, "course-1");
    assert.deepEqual(calls, []);
  });

  test("invalid course target is a 400 and the lookup is never called", async () => {
    const { guard, calls } = makeGuard([["uid-student", "course-1"]]);
    for (const bad of ["", "   ", undefined, null, 42, {}, []]) {
      await assert.rejects(guard(student, bad), (err: unknown) => {
        assert.ok(err instanceof HttpError, `expected HttpError for ${JSON.stringify(bad)}`);
        assert.equal(err.status, 400);
        return true;
      });
    }
    assert.deepEqual(calls, []);
  });

  test("invalid course target is rejected even for admins (no silent bypass of validation)", async () => {
    const { guard } = makeGuard([]);
    await assert.rejects(guard(admin, ""), (err: unknown) => err instanceof HttpError && err.status === 400);
  });

  test("a failing lookup propagates (fail closed, never treated as enrolled)", async () => {
    const guard = createEnrollmentGuard({
      async isEnrolled() {
        throw new Error("db down");
      },
    });
    await assert.rejects(guard(student, "course-1"), /db down/);
  });
});

describe("HttpError -> withApi response mapping", () => {
  test("HttpError maps to its status and message only", () => {
    const res = toErrorResponse(new HttpError(404, "Lesson not found"));
    assert.deepEqual(res, { status: 404, body: { error: "Lesson not found" } });
  });

  test("AuthError FORBIDDEN from the guard maps to 403", () => {
    const res = toErrorResponse(new AuthError("FORBIDDEN", "Not enrolled"));
    assert.equal(res.status, 403);
    assert.equal(res.body.error, "Not enrolled");
  });

  test("unknown errors stay a generic 500 (no message leak)", () => {
    const res = toErrorResponse(new Error("SELECT failed: relation missing"));
    assert.deepEqual(res, { status: 500, body: { error: "Internal server error" } });
  });
});
