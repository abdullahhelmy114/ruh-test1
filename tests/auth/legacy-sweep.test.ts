/**
 * Phase 2.3b — static checks for the mechanical legacy-auth sweep of admin and
 * teacher routes. Every listed handler must be wrapped in withApi, guarded by
 * the central helper (before any request input is read), and free of the
 * legacy patterns (local verifyAdmin/isAdmin helpers, firebaseAdmin, the
 * verifyIdToken shim, getServerSession, synchronous Next 16 params).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API = join(import.meta.dirname, "..", "..", "src", "app", "api");

function listRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listRoutes(path) : entry === "route.ts" ? [path] : [];
  });
}

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
  // Engineering reinforcement — found open by the anonymous sweep of a running build
  { file: "teacher/earnings/route.ts", guard: "requireTeacher", handlers: ["GET"] },
  // Teacher lifecycle — verified the token itself and admitted any role = 'teacher' profile, approved or not
  { file: "teacher/dashboard/route.ts", guard: "requireTeacher", handlers: ["GET"] },
  // Teacher assignment coherence — the last teacher routes with the verifyIdToken shim or getServerSession and a local role check
  { file: "teacher/applications/route.ts", guard: "requireTeacher", handlers: ["GET"] },
  { file: "teacher/available-course/route.ts", guard: "requireTeacher", handlers: ["GET"] },
  { file: "teacher/course/route.ts", guard: "requireTeacher", handlers: ["GET"] },
  { file: "teacher/live-course/route.ts", guard: "requireTeacher", handlers: ["GET"] },
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

  test("live_course ownership compares the Firebase uid the approval route writes, never profiles.id", () => {
    // Resolved REVIEW_REQUIRED: the only writer of live_course stores profiles.firebase_uid (and the schema
    // declares teacher_uid REFERENCES profiles(firebase_uid)), so the profiles.id comparison never matched.
    const writer = readFileSync(join(API, "admin/applications/approve/route.ts"), "utf8");
    assert.match(writer, /INSERT INTO live_course \(model_course_id, teacher_uid,[\s\S]*?\$\{teacher\.firebase_uid\}/);
    for (const file of [
      "teacher/live-course/[courseId]/activate-lesson/route.ts",
      "teacher/live-course/[courseId]/model-lessons/route.ts",
    ]) {
      const src = readFileSync(join(API, file), "utf8");
      assert.match(src, /WHERE id = \$\{params\.courseId\}\s+AND teacher_uid = \$\{session\.uid\}/, file);
    }
    assert.match(readFileSync(join(API, "teacher/available-course/route.ts"), "utf8"), /AND lc\.teacher_uid = \$\{teacherUid\}/);
    assert.match(readFileSync(join(API, "teacher/live-course/[courseId]/route.ts"), "utf8"), /WHERE lc\.id = \$1 AND lc\.teacher_uid = \$2`,\s*\[courseId, user\.uid\]/);
    for (const file of ["teacher", "admin"].flatMap((dir) => listRoutes(join(API, dir)))) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /SELECT id FROM profiles WHERE firebase_uid/, `${file} compares a Firebase uid column with profiles.id`);
    }
  });

  test("teacher ownership checks still bind to the session uid", () => {
    assert.match(readFileSync(join(API, "teacher/apply/route.ts"), "utf8"), /const teacherUid = session\.uid/);
    assert.match(readFileSync(join(API, "teacher/lessons/route.ts"), "utf8"), /\[live_course_id, user\.uid\]/);
    assert.match(readFileSync(join(API, "teacher/course/[courseId]/lessons/route.ts"), "utf8"), /teacher_uid = \$\{session\.uid\}/);
  });
});
