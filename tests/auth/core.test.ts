/**
 * Phase 1 authentication/authorization tests.
 *
 * Runs on Node's built-in test runner (no extra dependencies):
 *   node --test tests/auth/core.test.ts     (or the glob used in CI)
 *
 * Firebase and the database are replaced by in-memory fakes through the
 * `AuthDeps` injection point, so no credentials are required.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  AuthError,
  createAuthService,
  extractCredential,
  toErrorResponse,
  type AuthDeps,
  type ProfileRecord,
} from "../../src/lib/auth/core.ts";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

const PROFILES: Record<string, ProfileRecord> = {
  "uid-admin": { id: "p-admin", firebase_uid: "uid-admin", role: "admin", email: "admin@example.com", status: "active" },
  "uid-teacher": { id: "p-teacher", firebase_uid: "uid-teacher", role: "teacher", email: "t@example.com", status: "active" },
  "uid-student": { id: "p-student", firebase_uid: "uid-student", role: "student", email: "s@example.com", status: "active" },
  // Teacher accounts whose application is not approved, or that were deactivated.
  "uid-t-pending": { id: "p-t1", firebase_uid: "uid-t-pending", role: "teacher", email: null, status: "pending" },
  "uid-t-changes": { id: "p-t2", firebase_uid: "uid-t-changes", role: "teacher", email: null, status: "changes_requested" },
  "uid-t-rejected": { id: "p-t3", firebase_uid: "uid-t-rejected", role: "teacher", email: null, status: "rejected" },
  "uid-t-withdrawn": { id: "p-t4", firebase_uid: "uid-t-withdrawn", role: "teacher", email: null, status: "withdrawn" },
  "uid-t-inactive": { id: "p-t5", firebase_uid: "uid-t-inactive", role: "teacher", email: null, status: "inactive" },
  "uid-t-nostatus": { id: "p-t6", firebase_uid: "uid-t-nostatus", role: "teacher", email: null, status: null },
  "uid-t-shouting": { id: "p-t7", firebase_uid: "uid-t-shouting", role: "teacher", email: null, status: "ACTIVE" },
  "uid-s-unverified": { id: "p-s2", firebase_uid: "uid-s-unverified", role: "student", email: null, status: "pending" },
  "uid-a-odd": { id: "p-a2", firebase_uid: "uid-a-odd", role: "admin", email: null, status: "pending" },
  "uid-nullrole": { id: "p-null", firebase_uid: "uid-nullrole", role: null, email: null },
  "uid-weird": { id: "p-weird", firebase_uid: "uid-weird", role: "superuser", email: null },
};

/** Tokens are "tok:<uid>", cookies are "ck:<uid>"; anything else is invalid. */
function makeDeps(overrides: Partial<AuthDeps> = {}): AuthDeps {
  return {
    async verifyIdToken(token) {
      if (!token.startsWith("tok:")) throw new Error("invalid token");
      return { uid: token.slice(4) };
    },
    async verifySessionCookie(cookie) {
      if (!cookie.startsWith("ck:")) throw new Error("invalid cookie");
      return { uid: cookie.slice(3) };
    },
    async findProfileByFirebaseUid(uid) {
      return PROFILES[uid] ?? null;
    },
    ...overrides,
  };
}

function req(init: { bearer?: string; cookie?: string; headers?: Record<string, string> } = {}): Request {
  const headers = new Headers(init.headers ?? {});
  if (init.bearer !== undefined) headers.set("authorization", `Bearer ${init.bearer}`);
  if (init.cookie !== undefined) headers.set("cookie", init.cookie);
  return new Request("http://localhost/api/test", { headers });
}

async function expectAuthError(p: Promise<unknown>, status: 401 | 403) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof AuthError, "expected AuthError");
    assert.equal(err.status, status);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Credential extraction
// ---------------------------------------------------------------------------

describe("extractCredential", () => {
  test("returns null when nothing is present", () => {
    assert.equal(extractCredential(req()), null);
  });

  test("reads a Bearer token", () => {
    assert.deepEqual(extractCredential(req({ bearer: "tok:x" })), { kind: "token", value: "tok:x" });
  });

  test("reads the __session cookie among other cookies", () => {
    const r = req({ cookie: "theme=dark; __session=ck:x; other=1" });
    assert.deepEqual(extractCredential(r), { kind: "cookie", value: "ck:x" });
  });

  test("ignores a cookie named 'session' (legacy, never issued by the app)", () => {
    assert.equal(extractCredential(req({ cookie: "session=ck:x" })), null);
  });

  test("Bearer takes precedence over cookie", () => {
    const r = req({ bearer: "tok:a", cookie: "__session=ck:b" });
    assert.equal(extractCredential(r)?.value, "tok:a");
  });

  test("empty Bearer value is treated as absent", () => {
    assert.equal(extractCredential(req({ bearer: "   " })), null);
  });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("getSession / requireAuth", () => {
  const auth = createAuthService(makeDeps());

  test("missing credential → null / 401", async () => {
    assert.equal(await auth.getSession(req()), null);
    await expectAuthError(auth.requireAuth(req()), 401);
  });

  test("invalid token → null / 401", async () => {
    assert.equal(await auth.getSession(req({ bearer: "garbage" })), null);
    await expectAuthError(auth.requireAuth(req({ bearer: "garbage" })), 401);
  });

  test("invalid session cookie → 401", async () => {
    await expectAuthError(auth.requireAuth(req({ cookie: "__session=garbage" })), 401);
  });

  test("valid token but no profile row → 401 (identity must exist in profiles)", async () => {
    await expectAuthError(auth.requireAuth(req({ bearer: "tok:uid-unknown" })), 401);
  });

  test("valid token resolves the profile-backed user", async () => {
    const user = await auth.requireAuth(req({ bearer: "tok:uid-teacher" }));
    assert.deepEqual(user, {
      uid: "uid-teacher",
      profileId: "p-teacher",
      role: "teacher",
      email: "t@example.com",
      accountRole: "teacher",
      accountStatus: "active",
    });
  });

  test("valid session cookie resolves the same user", async () => {
    const user = await auth.requireAuth(req({ cookie: "__session=ck:uid-student" }));
    assert.equal(user.uid, "uid-student");
    assert.equal(user.role, "student");
  });

  test("session cookie is verified with the cookie verifier, not the token verifier", async () => {
    let cookieCalls = 0;
    let tokenCalls = 0;
    const auth2 = createAuthService(
      makeDeps({
        async verifySessionCookie(c) { cookieCalls++; return { uid: c.slice(3) }; },
        async verifyIdToken(t) { tokenCalls++; return { uid: t.slice(4) }; },
      })
    );
    await auth2.requireAuth(req({ cookie: "__session=ck:uid-student" }));
    assert.equal(cookieCalls, 1);
    assert.equal(tokenCalls, 0);
  });

  test("a verifier that throws is treated as unauthenticated, not a 500", async () => {
    const auth2 = createAuthService(
      makeDeps({ async verifyIdToken() { throw new Error("firebase down"); } })
    );
    assert.equal(await auth2.getSession(req({ bearer: "tok:uid-admin" })), null);
  });

  test("null or unknown role in the database normalizes to student", async () => {
    const a = await auth.requireAuth(req({ bearer: "tok:uid-nullrole" }));
    assert.equal(a.role, "student");
    const b = await auth.requireAuth(req({ bearer: "tok:uid-weird" }));
    assert.equal(b.role, "student");
  });

  test("returned context exposes only uid, profileId, role, email and the stored account role and status", async () => {
    const user = await auth.requireAuth(req({ bearer: "tok:uid-admin" }));
    assert.deepEqual(Object.keys(user).sort(), ["accountRole", "accountStatus", "email", "profileId", "role", "uid"]);
    assert.equal(user.accountRole, "admin");
    assert.equal(user.accountStatus, "active");
  });
});

// ---------------------------------------------------------------------------
// Client-controlled identity must be ignored
// ---------------------------------------------------------------------------

describe("client-controlled identity is rejected", () => {
  const auth = createAuthService(makeDeps());

  test("x-user-id / x-user-role headers alone do not authenticate", async () => {
    const r = req({ headers: { "x-user-id": "uid-admin", "x-user-role": "admin" } });
    assert.equal(await auth.getSession(r), null);
    await expectAuthError(auth.requireAdmin(r), 401);
  });

  test("x-user-role cannot elevate an authenticated student", async () => {
    const r = req({ bearer: "tok:uid-student", headers: { "x-user-role": "admin", "x-user-id": "uid-admin" } });
    const user = await auth.requireAuth(r);
    assert.equal(user.uid, "uid-student");
    assert.equal(user.role, "student");
    await expectAuthError(auth.requireAdmin(r), 403);
  });

  test("uid in query string or body is irrelevant to identity", async () => {
    const headers = new Headers({ authorization: "Bearer tok:uid-student", "content-type": "application/json" });
    const r = new Request("http://localhost/api/test?uid=uid-admin&role=admin", {
      method: "POST",
      headers,
      body: JSON.stringify({ uid: "uid-admin", userId: "uid-admin", teacherUid: "uid-teacher", role: "admin" }),
    });
    const user = await auth.requireAuth(r);
    assert.equal(user.uid, "uid-student");
    assert.equal(user.role, "student");
  });

  test("role is taken from the profile row, never from the credential", async () => {
    // Even if a verifier returned extra claims, they are not consulted.
    const auth2 = createAuthService(
      makeDeps({
        async verifyIdToken(t) {
          return { uid: t.slice(4), ...({ role: "admin" } as object) };
        },
      })
    );
    const user = await auth2.requireAuth(req({ bearer: "tok:uid-student" }));
    assert.equal(user.role, "student");
  });
});

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

describe("role authorization", () => {
  const auth = createAuthService(makeDeps());
  const admin = () => req({ bearer: "tok:uid-admin" });
  const teacher = () => req({ bearer: "tok:uid-teacher" });
  const student = () => req({ bearer: "tok:uid-student" });

  test("requireAdmin: admin ok; teacher/student 403; anonymous 401", async () => {
    assert.equal((await auth.requireAdmin(admin())).role, "admin");
    await expectAuthError(auth.requireAdmin(teacher()), 403);
    await expectAuthError(auth.requireAdmin(student()), 403);
    await expectAuthError(auth.requireAdmin(req()), 401);
  });

  test("requireTeacher: teacher and admin ok; student 403", async () => {
    assert.equal((await auth.requireTeacher(teacher())).role, "teacher");
    assert.equal((await auth.requireTeacher(admin())).role, "admin");
    await expectAuthError(auth.requireTeacher(student()), 403);
  });

  test("requireStudent: student and admin ok; teacher 403", async () => {
    assert.equal((await auth.requireStudent(student())).role, "student");
    assert.equal((await auth.requireStudent(admin())).role, "admin");
    await expectAuthError(auth.requireStudent(teacher()), 403);
  });

  test("a teacher account acts as a teacher only while its status is exactly 'active'", async () => {
    for (const uid of ["uid-t-pending", "uid-t-changes", "uid-t-rejected", "uid-t-withdrawn", "uid-t-inactive", "uid-t-nostatus", "uid-t-shouting"]) {
      const r = () => req({ bearer: `tok:${uid}` });
      const user = await auth.requireAuth(r());
      assert.equal(user.role, "applicant", uid);
      assert.equal(user.accountRole, "teacher", uid);
      await expectAuthError(auth.requireTeacher(r()), 403);
      await expectAuthError(auth.requireStudent(r()), 403);
      await expectAuthError(auth.requireAdmin(r()), 403);
      await expectAuthError(auth.requireRole(r(), ["admin", "teacher", "student"]), 403);
      await auth.requireSelfOrAdmin(r(), uid);
      await expectAuthError(auth.requireSelfOrAdmin(r(), "uid-student"), 403);
    }
  });

  test("an x-user-role header or a status claimed by the client cannot activate a teacher application", async () => {
    const r = req({ bearer: "tok:uid-t-pending", headers: { "x-user-role": "teacher", "x-user-status": "active" } });
    await expectAuthError(auth.requireTeacher(r), 403);
  });

  test("status gates only teacher accounts: unverified students stay students, administrators stay administrators", async () => {
    assert.equal((await auth.requireStudent(req({ bearer: "tok:uid-s-unverified" }))).role, "student");
    assert.equal((await auth.requireAdmin(req({ bearer: "tok:uid-a-odd" }))).role, "admin");
  });

  test("requireRole accepts a single role or a list", async () => {
    await auth.requireRole(teacher(), "teacher");
    await auth.requireRole(teacher(), ["admin", "teacher"]);
    await expectAuthError(auth.requireRole(teacher(), ["admin"]), 403);
    await expectAuthError(auth.requireRole(teacher(), "student"), 403);
  });

  test("requireSelfOrAdmin: owner ok, admin ok, other user 403, anonymous 401", async () => {
    await auth.requireSelfOrAdmin(student(), "uid-student");
    await auth.requireSelfOrAdmin(admin(), "uid-student");
    await expectAuthError(auth.requireSelfOrAdmin(teacher(), "uid-student"), 403);
    await expectAuthError(auth.requireSelfOrAdmin(req(), "uid-student"), 401);
  });
});

// ---------------------------------------------------------------------------
// Error mapping used by withApi
// ---------------------------------------------------------------------------

describe("toErrorResponse", () => {
  test("AuthError maps to its status and code", () => {
    assert.deepEqual(toErrorResponse(new AuthError("UNAUTHORIZED")), {
      status: 401,
      body: { error: "Unauthorized", code: "UNAUTHORIZED" },
    });
    assert.deepEqual(toErrorResponse(new AuthError("FORBIDDEN")), {
      status: 403,
      body: { error: "Forbidden", code: "FORBIDDEN" },
    });
  });

  test("any other error is a generic 500 that leaks nothing", () => {
    const res = toErrorResponse(new Error('relation "profiles" does not exist'));
    assert.equal(res.status, 500);
    assert.equal(res.body.error, "Internal server error");
    assert.equal(JSON.stringify(res.body).includes("profiles"), false);
  });
});
