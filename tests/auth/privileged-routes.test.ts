/**
 * Phase 2.3a — static guard checks for the privileged mutation routes
 * migrated in this batch. Behavioral guarantees (401/403, role checks) are
 * covered by tests/auth/core.test.ts against the same helpers.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API = join(import.meta.dirname, "..", "..", "src", "app", "api");

type Spec = {
  file: string;
  handlers: { method: string; guard: "requireAdmin" | "requireTeacher" | "requireAuth" }[];
  /** File still contains an outer try/catch by design (kept business logic). */
  keepsTryCatch?: boolean;
};

const SPECS: Spec[] = [
  { file: "approve-course/route.ts", handlers: [{ method: "PUT", guard: "requireAdmin" }] },
  { file: "lessons/route.ts", handlers: [{ method: "GET", guard: "requireTeacher" }, { method: "POST", guard: "requireTeacher" }, { method: "PUT", guard: "requireAdmin" }] },
  { file: "lessons/[id]/route.ts", handlers: [{ method: "PUT", guard: "requireAdmin" }], keepsTryCatch: true },
  { file: "messages/[id]/route.ts", handlers: [{ method: "PUT", guard: "requireAuth" }] },
  { file: "tts/generate/route.ts", handlers: [{ method: "POST", guard: "requireAdmin" }] },
  { file: "admin/applications/approve/route.ts", handlers: [{ method: "POST", guard: "requireAdmin" }], keepsTryCatch: true },
  { file: "admin/approve-teacher/route.ts", handlers: [{ method: "POST", guard: "requireAdmin" }], keepsTryCatch: true },
  { file: "admin/challenges/route.ts", handlers: [{ method: "POST", guard: "requireAdmin" }], keepsTryCatch: true },
];

describe("Phase 2.3a privileged routes use the central auth layer", () => {
  for (const spec of SPECS) {
    const src = readFileSync(join(API, spec.file), "utf8");
    const code = src.replace(/\/\/[^\n]*/g, "");

    test(`${spec.file}: every handler is wrapped and guarded`, () => {
      for (const h of spec.handlers) {
        assert.match(code, new RegExp(`export const ${h.method} = withApi`), `${h.method} not wrapped`);
      }
      assert.equal(
        [...code.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].length,
        0,
        "unwrapped handler export found"
      );
      const guardCalls = [...code.matchAll(/await (requireAdmin|requireTeacher|requireAuth)\(req\)/g)].map((m) => m[1]);
      assert.deepEqual(guardCalls.sort(), spec.handlers.map((h) => h.guard).sort());
      // the guard must run before any request body / params are consumed
      const firstGuard = code.search(/await require(Admin|Teacher|Auth)\(req\)/);
      const firstBodyRead = code.search(/await req\.json\(\)|await ctx\.params/);
      if (firstBodyRead !== -1) assert.ok(firstGuard < firstBodyRead, "guard runs after request input is read");
    });

    test(`${spec.file}: no legacy/inline auth, spoof headers, edge runtime, or error.message leaks`, () => {
      assert.doesNotMatch(code, /verifyIdToken\(|firebaseAdmin\.auth\(\)|from ['"]firebase-admin|getCurrentUser|cookies\(\)/);
      assert.doesNotMatch(code, /x-user-id|x-user-role|localStorage/i);
      assert.doesNotMatch(code, /runtime\s*=\s*['"]edge['"]/);
      assert.doesNotMatch(code, /error\.message|err\.message|e\.message|zoomError\.message/);
      assert.doesNotMatch(code, /catch\s*\(\s*\w+\s*:\s*any\s*\)|as any|@ts-ignore|@ts-expect-error/);
    });
  }

  test("lessons GET: teachers are scoped to their own uid; admins may filter", () => {
    const src = readFileSync(join(API, "lessons/route.ts"), "utf8");
    assert.match(src, /const teacherUid = user\.role === 'admin' \? requestedTeacher : user\.uid/);
  });

  test("messages/[id] PUT: update scoped to the receiver", () => {
    const src = readFileSync(join(API, "messages/[id]/route.ts"), "utf8");
    assert.match(src, /WHERE id = \$\{id\} AND receiver_uid = \$\{user\.uid\}/);
  });

  test("admin/approve-teacher: DB write intentionally unchanged (REVIEW_REQUIRED)", () => {
    const src = readFileSync(join(API, "admin/approve-teacher/route.ts"), "utf8");
    assert.match(src, /UPDATE users/);
    assert.match(src, /REVIEW_REQUIRED/);
  });

  test("upload-youtube is an internal-only route (Phase 3 batch 1), never a user/admin route", () => {
    // Phase 2.3a deferred this route; Phase 3 batch 1 gave it a server-to-
    // server boundary (x-internal-secret) instead of a user guard.
    const src = readFileSync(join(API, "lessons/[id]/upload-youtube/route.ts"), "utf8");
    assert.match(src, /checkInternalSecret\(/);
    assert.doesNotMatch(src, /requireAdmin|requireTeacher|requireStudent|requireAuth\(/);
  });
});
