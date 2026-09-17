/**
 * Static guarantees for the academy administration API routes.
 *
 * Behaviour lives in services (tested with fakes); routes must stay thin:
 * central auth first, Next 16 params awaited after authentication, services
 * from the server wiring only, no direct database access, no client identity
 * headers, and no error details leaked.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const API = join(ROOT, "src", "app", "api", "admin", "academy");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const routes = walk(API).filter((path) => path.endsWith("route.ts"));

describe("academy admin routes", () => {
  test("the expected route files exist", () => {
    const rels = routes.map((path) => relative(API, path).replace(/\\/g, "/")).sort();
    assert.deepEqual(rels, [
      "class-groups/[classGroupId]/enrollments/route.ts",
      "class-groups/[classGroupId]/route.ts",
      "class-groups/[classGroupId]/sessions/route.ts",
      "class-groups/route.ts",
      "courses/[courseId]/curriculum/route.ts",
      "courses/[courseId]/route.ts",
      "courses/route.ts",
      "curriculum-versions/[versionId]/route.ts",
      "enrollments/[enrollmentId]/route.ts",
      "lesson-script-versions/[versionId]/route.ts",
      "lessons/[lessonId]/script/route.ts",
      "programs/[programId]/route.ts",
      "programs/route.ts",
      "sessions/[sessionId]/preparations/route.ts",
      "sessions/[sessionId]/route.ts",
    ]);
  });

  for (const path of routes) {
    const rel = relative(API, path).replace(/\\/g, "/");
    const src = readFileSync(path, "utf8");
    const handlers = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withApi/g)];

    test(`${rel}: every handler is wrapped in withApi and authenticates as admin first`, () => {
      assert.ok(handlers.length > 0);
      assert.equal([...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].length, 0);
      assert.equal([...src.matchAll(/const user = await requireAdmin\(req\);/g)].length, handlers.length);
      assert.match(src, /import \{ requireAdmin \} from "@\/lib\/auth";/);
      for (const block of src.split(/export const (?:GET|POST|PUT|PATCH|DELETE) = /).slice(1)) {
        const authAt = block.indexOf("await requireAdmin(req)");
        assert.ok(authAt >= 0, "handler without requireAdmin");
        for (const later of ["await ctx.params", "await readJsonObject(req)", "Service."]) {
          const at = block.indexOf(later);
          if (at >= 0) assert.ok(authAt < at, `${later} happens before authentication`);
        }
      }
    });

    test(`${rel}: services only through the server wiring; no direct database or legacy auth`, () => {
      assert.match(src, /from "@\/lib\/academy\/server";/);
      assert.doesNotMatch(src, /@\/lib\/db\/client|@neondatabase|from "@\/lib\/academy\/(services|repo)\//);
      assert.doesNotMatch(src, /getServerSession\(|verifyIdToken\(|firebase-admin|@\/lib\/firebase\/server/);
      assert.doesNotMatch(src, /runtime\s*=\s*["']edge["']/);
    });

    test(`${rel}: no client identity headers, no error leaks, awaited params`, () => {
      assert.doesNotMatch(src, /x-user-id|x-user-role|x-forwarded-for|localStorage/i);
      assert.doesNotMatch(src, /error\.message|err\.message|e\.message|catch\s*\(/);
      assert.doesNotMatch(src, /body\.(uid|userId|actorUid|role)\b/, "identity must never come from the body");
      if (rel.includes("[")) {
        assert.match(src, /= await ctx\.params;/);
        assert.doesNotMatch(src, /ctx\.params\.\w+/);
      }
    });
  }
});
