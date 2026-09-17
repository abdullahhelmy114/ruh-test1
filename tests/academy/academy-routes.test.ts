/**
 * Static guarantees for learner/teacher academy API routes (src/app/api/academy).
 *
 * These routes serve time-gated and private data. They must authenticate
 * through the central auth layer before anything else, leave every access
 * decision (relationships, release rule, ownership) to the services, take
 * identity only from the session, and forbid caching of responses.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const API = join(ROOT, "src", "app", "api", "academy");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const routes = walk(API).filter((path) => path.endsWith("route.ts"));

describe("academy participant routes", () => {
  test("the expected route files exist", () => {
    assert.deepEqual(routes.map((path) => relative(API, path).replace(/\\/g, "/")).sort(), [
      "assignments/[assignmentId]/attempts/route.ts",
      "assignments/[assignmentId]/route.ts",
      "attempts/[attemptId]/route.ts",
      "class-groups/[classGroupId]/assignments/route.ts",
      "class-groups/[classGroupId]/progress/route.ts",
      "class-groups/[classGroupId]/review-queue/route.ts",
      "annotations/[annotationId]/route.ts",
      "class-groups/[classGroupId]/lesson-sheets/[lessonId]/annotations/route.ts",
      "class-groups/[classGroupId]/lesson-sheets/[lessonId]/route.ts",
      "class-groups/[classGroupId]/lesson-sheets/route.ts",
      "class-groups/[classGroupId]/roster/route.ts",
      "class-groups/[classGroupId]/route.ts",
      "me/attendance/route.ts",
      "me/learning/route.ts",
      "me/teaching/route.ts",
      "sessions/[sessionId]/attendance/route.ts",
      "sessions/[sessionId]/preparation/route.ts",
      "sessions/[sessionId]/route.ts",
    ].sort());
  });

  for (const path of routes) {
    const rel = relative(API, path).replace(/\\/g, "/");
    const src = readFileSync(path, "utf8");
    const handlers = [...src.matchAll(/export const (GET|POST|PUT|PATCH|DELETE) = withApi/g)];

    test(`${rel}: authenticates through the central auth layer before anything else`, () => {
      assert.ok(handlers.length > 0);
      assert.equal([...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].length, 0);
      assert.match(src, /import \{ requireAuth \} from "@\/lib\/auth";/);
      assert.equal([...src.matchAll(/const user = await requireAuth\(req\);/g)].length, handlers.length);
      for (const block of src.split(/export const (?:GET|POST|PUT|PATCH|DELETE) = /).slice(1)) {
        const authAt = block.indexOf("await requireAuth(req)");
        assert.ok(authAt >= 0);
        for (const later of ["await ctx.params", "await readJsonObject(req)", "Service."]) {
          const at = block.indexOf(later);
          if (at >= 0) assert.ok(authAt < at, `${later} happens before authentication`);
        }
      }
    });

    test(`${rel}: access decisions stay in services; identity never comes from the request`, () => {
      assert.match(src, /from "@\/lib\/academy\/server";/);
      assert.doesNotMatch(src, /@\/lib\/db\/client|@neondatabase|from "@\/lib\/academy\/(services|repo|lessons|permissions)\//);
      assert.doesNotMatch(src, /x-user-id|x-user-role|x-forwarded-for|localStorage/i);
      assert.doesNotMatch(src, /body\.(uid|userId|ownerUid|teacherUid|learnerUid|role)\b/);
      assert.doesNotMatch(src, /user\.role\s*[!=]==|\breleaseAt\b|sheetAvailability|lessonSheetReleaseAt/, "routes must not make access or release decisions");
      assert.doesNotMatch(src, /error\.message|err\.message|e\.message|catch\s*\(/);
      assert.doesNotMatch(src, /runtime\s*=\s*["']edge["']/);
      if (rel.includes("[")) {
        assert.match(src, /= await ctx\.params;/);
        assert.doesNotMatch(src, /ctx\.params\.\w+/);
      }
      if (rel.startsWith("me/")) {
        assert.doesNotMatch(src, /readStringParam\(req, "(uid|learnerUid|teacherUid|userId)"\)/, "'me' routes act only on the caller");
      }
    });

    test(`${rel}: every response is marked private and not storable`, () => {
      const responses = [...src.matchAll(/NextResponse\.json\(/g)].length;
      assert.ok(responses > 0);
      assert.equal([...src.matchAll(/headers: PRIVATE_NO_STORE/g)].length, responses, "a response without no-store headers");
    });
  }
});
