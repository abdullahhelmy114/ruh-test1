/**
 * Phase 2.1 — static guard checks for the admin routes migrated in this batch.
 *
 * These routes cannot be exercised end-to-end without Firebase and Neon, so
 * this test verifies statically that each file:
 *   - is wrapped in withApi and calls requireAdmin (central auth only)
 *   - does not declare the Edge runtime (firebase-admin needs Node)
 *   - does not use legacy/inline auth or client-supplied identity headers
 *   - does not leak error.message to clients
 *   - does not read params synchronously (Next 16 params is a Promise)
 *
 * Behavioral guarantees (401 / 403 / admin allowed / target uid never becomes
 * the caller) are covered by tests/auth/core.test.ts against the same
 * requireAdmin implementation these routes import.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const API = join(ROOT, "src", "app", "api", "admin");

const FILES = [
  "coupons/route.ts",
  "finance/route.ts",
  "marketing/route.ts",
  "pages/route.ts",
  "pending-course/route.ts",
  "send-message/route.ts",
  "send-notification/route.ts",
  "stats/route.ts",
  "teacher-applications/route.ts",
  "users/[uid]/route.ts",
  "users/[uid]/enrollments/route.ts",
];

describe("Phase 2.1 admin routes use the central auth layer", () => {
  for (const rel of FILES) {
    const src = readFileSync(join(API, rel), "utf8");
    const handlers = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withApi/g)];

    test(`${rel}: every exported handler is wrapped in withApi`, () => {
      assert.ok(handlers.length > 0, "no withApi handlers found");
      assert.equal(
        [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].length,
        0,
        "unwrapped handler export found"
      );
    });

    test(`${rel}: calls requireAdmin once per handler`, () => {
      const calls = [...src.matchAll(/await requireAdmin\(req\)/g)].length;
      assert.equal(calls, handlers.length);
      assert.match(src, /import \{ requireAdmin \} from ['"]@\/lib\/auth['"]/);
    });

    test(`${rel}: no Edge runtime, legacy auth, client identity headers, or error leaks`, () => {
      assert.doesNotMatch(src, /runtime\s*=\s*['"]edge['"]/);
      assert.doesNotMatch(src, /getServerSession\(|verifyIdToken\(/);
      assert.doesNotMatch(src, /from ['"](firebase-admin|@\/lib\/firebase\/server|@\/lib\/firebase-admin)['"/]/);
      assert.doesNotMatch(src, /x-user-id|x-user-role|localStorage/i);
      assert.doesNotMatch(src, /error\.message|err\.message|e\.message/);
      assert.doesNotMatch(src, /catch\s*\(\s*\w+\s*:\s*any\s*\)/);
    });

    if (rel.includes("[uid]")) {
      test(`${rel}: awaits Next 16 params and never treats the target uid as the caller`, () => {
        assert.match(src, /const \{ uid \} = await ctx\.params/);
        assert.doesNotMatch(src, /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{/);
        // requireAdmin must be evaluated before the target uid is used
        assert.ok(src.indexOf("await requireAdmin(req)") < src.indexOf("await ctx.params"));
      });
    }
  }
});
