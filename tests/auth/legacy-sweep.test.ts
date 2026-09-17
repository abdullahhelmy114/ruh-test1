/**
 * Phase 2.3b — static checks for the mechanical legacy-auth sweep of admin and
 * teacher routes. Every listed handler must be wrapped in withApi, guarded by
 * the central helper (before any request input is read), and free of the
 * legacy patterns (local verifyAdmin/isAdmin helpers, firebaseAdmin, the
 * verifyIdToken shim, getServerSession, synchronous Next 16 params).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API = join(import.meta.dirname, "..", "..", "src", "app", "api");

type Spec = { file: string; guard: "requireAdmin" | "requireTeacher"; handlers: string[]; params?: boolean; publicHandlers?: string[] };

const SPECS: Spec[] = [
  // Group A — local verifyAdmin + firebaseAdmin
  { file: "admin/curriculum/start/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/curriculum/outline/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/curriculum/extract-text/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/curriculum/status/route.ts", guard: "requireAdmin", handlers: ["GET"] },
  { file: "admin/extract-pdf/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/generate-games/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/generate-questions/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/generated-content/route.ts", guard: "requireAdmin", handlers: ["GET"] },
  { file: "admin/generated-content/game/route.ts", guard: "requireAdmin", handlers: ["DELETE"] },
  { file: "admin/generated-content/question/route.ts", guard: "requireAdmin", handlers: ["DELETE"] },
  { file: "admin/gamification/badges/route.ts", guard: "requireAdmin", handlers: ["GET", "POST", "DELETE"] },
  { file: "admin/gamification/offers/route.ts", guard: "requireAdmin", handlers: ["GET", "POST", "PUT", "DELETE"] },
  { file: "admin/gamification/points-config/route.ts", guard: "requireAdmin", handlers: ["GET", "PUT"] },
  { file: "admin/gamification/stats/route.ts", guard: "requireAdmin", handlers: ["GET"] },
  // Group B — getServerSession
  { file: "admin/course/route.ts", guard: "requireAdmin", handlers: ["GET", "POST"] },
  { file: "admin/course/id/route.ts", guard: "requireAdmin", handlers: ["PUT", "DELETE"] },
  { file: "admin/curriculum/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/categories/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "categories/route.ts", guard: "requireAdmin", handlers: ["POST"], publicHandlers: ["GET"] },
  { file: "categories/[id]/route.ts", guard: "requireAdmin", handlers: ["PUT", "DELETE"], params: true },
  { file: "admin/library/books/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/library/books/bulk/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/library/books/convert/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  { file: "admin/library/books/[id]/route.ts", guard: "requireAdmin", handlers: ["DELETE", "PUT"], params: true },
  // Group C — verifyIdToken shim + sync params
  { file: "admin/model-course/[id]/route.ts", guard: "requireAdmin", handlers: ["DELETE"], params: true },
  { file: "admin/model-course/[id]/lessons/route.ts", guard: "requireAdmin", handlers: ["GET", "POST"], params: true },
  { file: "admin/model-course/[id]/lessons/[lessonId]/route.ts", guard: "requireAdmin", handlers: ["PUT", "DELETE"], params: true },
  { file: "admin/model-course/[id]/lessons/reorder/route.ts", guard: "requireAdmin", handlers: ["PUT"], params: true },
  // Group D
  { file: "admin/bundles/route.ts", guard: "requireAdmin", handlers: ["GET", "POST"] },
  { file: "admin/knowledge/upload-gemini/route.ts", guard: "requireAdmin", handlers: ["POST"] },
  // Group E — teacher
  { file: "teacher/apply/route.ts", guard: "requireTeacher", handlers: ["POST"] },
  { file: "teacher/lessons/route.ts", guard: "requireTeacher", handlers: ["POST"] },
  { file: "teacher/course/[courseId]/lessons/route.ts", guard: "requireTeacher", handlers: ["POST"], params: true },
  { file: "teacher/live-course/[courseId]/activate-lesson/route.ts", guard: "requireTeacher", handlers: ["POST"], params: true },
  // Launch closure — last synchronous-params teacher routes
  { file: "teacher/live-course/[courseId]/route.ts", guard: "requireTeacher", handlers: ["GET"], params: true },
  { file: "teacher/live-course/[courseId]/model-lessons/route.ts", guard: "requireTeacher", handlers: ["GET"], params: true },
];

describe("Phase 2.3b legacy-auth sweep", () => {
  for (const spec of SPECS) {
    const src = readFileSync(join(API, spec.file), "utf8");
    const code = src.replace(/\/\/[^\n]*/g, "");

    test(`${spec.file}: handlers wrapped and guarded by ${spec.guard}`, () => {
      for (const h of spec.handlers) assert.match(code, new RegExp(`export const ${h} = withApi`), `${h} not wrapped`);
      const legacy = [...code.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
      assert.deepEqual(legacy.sort(), (spec.publicHandlers ?? []).sort(), "unexpected unwrapped handlers");
      const guardCalls = [...code.matchAll(/await (requireAdmin|requireTeacher)\((?:req|request)\)/g)].map((m) => m[1]);
      assert.equal(guardCalls.length, spec.handlers.length, "one guard per migrated handler");
      assert.ok(guardCalls.every((g) => g === spec.guard), `unexpected guard in ${spec.file}`);
    });

    test(`${spec.file}: guard precedes request input; params awaited; no legacy auth`, () => {
      // each guarded handler: guard line index < first req.json/formData/ctx.params inside it
      const blocks = code.split(/^export const (?:GET|POST|PUT|PATCH|DELETE) = withApi/m).slice(1);
      for (const b of blocks) {
        const g = b.search(/await require(Admin|Teacher)\((?:req|request)\)/);
        const inp = b.search(/await (?:req|request)\.(json|formData)\(\)|await ctx\.params/);
        if (inp !== -1) assert.ok(g !== -1 && g < inp, "input read before guard");
      }
      if (spec.params) {
        assert.doesNotMatch(code, /\{\s*params\s*\}\s*:\s*\{\s*params\s*:\s*\{/, "sync params signature remains");
        assert.match(code, /const params = await ctx\.params/);
      }
      assert.doesNotMatch(code, /verifyAdmin|isAdmin\(|getCurrentUser|getServerSession\(|verifyIdToken\(|firebaseAdmin|from ['"]firebase-admin|@\/lib\/firebase\/server|@\/lib\/firebase-admin/);
      assert.doesNotMatch(code, /x-user-id|x-user-role|localStorage/i);
      assert.doesNotMatch(code, /runtime\s*=\s*['"]edge['"]/);
      assert.doesNotMatch(code, /as any|@ts-ignore|@ts-expect-error/);
    });
  }

  test("activate-lesson keeps its existing profiles.id ownership comparison (REVIEW_REQUIRED convention)", () => {
    const src = readFileSync(join(API, "teacher/live-course/[courseId]/activate-lesson/route.ts"), "utf8");
    assert.match(src, /teacher_uid = \(SELECT id FROM profiles WHERE firebase_uid = \$\{session\.uid\}\)/);
  });

  test("teacher ownership checks still bind to the session uid", () => {
    assert.match(readFileSync(join(API, "teacher/apply/route.ts"), "utf8"), /const teacherUid = session\.uid/);
    assert.match(readFileSync(join(API, "teacher/lessons/route.ts"), "utf8"), /\[live_course_id, user\.uid\]/);
    assert.match(readFileSync(join(API, "teacher/course/[courseId]/lessons/route.ts"), "utf8"), /teacher_uid = \$\{session\.uid\}/);
  });
});
