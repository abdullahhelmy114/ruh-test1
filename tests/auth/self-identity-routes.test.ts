/**
 * Phase 2.2 — static guard checks for the self-identity routes migrated in
 * this batch (client-supplied uid/userId/teacherUid must never decide the
 * caller; identity comes from the verified session via the Phase 1 helpers).
 *
 * Behavioral guarantees (401/403, role checks, requireSelfOrAdmin semantics)
 * are covered by tests/auth/core.test.ts against the same implementation.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const API = join(import.meta.dirname, "..", "..", "src", "app", "api");

type Spec = {
  file: string;
  guard: "requireAuth" | "requireStudent" | "requireTeacher" | "requireSelfOrAdmin";
  handlers: string[];
  /** Client identity fields that must no longer be read anywhere in the file. */
  forbiddenIdentity: string[];
  /** Target identifiers that must still be read (legitimate resource ids). */
  keptTargets?: string[];
  edgeAllowed?: boolean;
  /** File still contains handlers outside this batch (leak checks limited). */
  partialFile?: boolean;
};

const SPECS: Spec[] = [
  { file: "analytics/route.ts", guard: "requireTeacher", handlers: ["GET"], forbiddenIdentity: [] },
  { file: "cart/route.ts", guard: "requireAuth", handlers: ["GET", "POST", "DELETE"], forbiddenIdentity: ["{ uid", "searchParams.get('uid')"], keptTargets: ["courseId"] },
  { file: "chat/send/route.ts", guard: "requireAuth", handlers: ["POST"], forbiddenIdentity: ["body.user"], keptTargets: ["room"] },
  { file: "coupons/validate/route.ts", guard: "requireAuth", handlers: ["POST"], forbiddenIdentity: ["userId"] },
  { file: "enroll/route.ts", guard: "requireStudent", handlers: ["POST"], forbiddenIdentity: ["userId"], keptTargets: ["courseId"] },
  { file: "exam/[courseId]/submit/route.ts", guard: "requireStudent", handlers: ["POST"], forbiddenIdentity: ["userId"], keptTargets: ["courseId"] },
  { file: "lessons/complete/route.ts", guard: "requireStudent", handlers: ["POST"], forbiddenIdentity: ["{ lessonId, uid", "body.uid"], keptTargets: ["lessonId"] },
  // lessons GET/PUT and reviews GET are NOT in this batch; only the migrated
  // POST handlers are checked for error leaks (partialFile).
  { file: "lessons/route.ts", guard: "requireTeacher", handlers: ["POST"], forbiddenIdentity: ["scheduledAt, teacherUid", "body.teacherUid"], keptTargets: ["courseId"], partialFile: true },
  { file: "messages/route.ts", guard: "requireAuth", handlers: ["POST", "GET"], forbiddenIdentity: ["senderUid"], keptTargets: ["receiverUid"] },
  { file: "messages/unread-count/route.ts", guard: "requireAuth", handlers: ["GET"], forbiddenIdentity: ["searchParams.get('uid')"] },
  { file: "notifications/register/route.ts", guard: "requireAuth", handlers: ["POST"], forbiddenIdentity: ["uid,", "{ uid"], keptTargets: ["token"] },
  { file: "notifications/route.ts", guard: "requireAuth", handlers: ["GET"], forbiddenIdentity: ["searchParams.get('uid')"] },
  { file: "reviews/route.ts", guard: "requireAuth", handlers: ["POST"], forbiddenIdentity: ["userUid"], keptTargets: ["courseId"], partialFile: true },
  { file: "student/course/route.ts", guard: "requireSelfOrAdmin", handlers: ["GET"], forbiddenIdentity: [] },
  { file: "student/route.ts", guard: "requireSelfOrAdmin", handlers: ["GET"], forbiddenIdentity: [] },
  { file: "teacher/marketing/route.ts", guard: "requireTeacher", handlers: ["GET"], forbiddenIdentity: ["searchParams.get('teacherUid')"] },
  { file: "teacher/sessions/route.ts", guard: "requireTeacher", handlers: ["GET"], forbiddenIdentity: ["searchParams.get('teacherUid')"] },
  { file: "teacher/students/[uid]/route.ts", guard: "requireTeacher", handlers: ["GET"], forbiddenIdentity: ["searchParams.get('teacherUid')"], keptTargets: ["ctx.params"] },
  { file: "teacher/students/route.ts", guard: "requireTeacher", handlers: ["GET"], forbiddenIdentity: ["searchParams.get('teacherUid')"] },
  { file: "tutor/route.ts", guard: "requireAuth", handlers: ["POST"], forbiddenIdentity: ["userId,"], edgeAllowed: true },
  { file: "user/complete-onboarding/route.ts", guard: "requireAuth", handlers: ["POST"], forbiddenIdentity: ["uid,", "{ uid"] },
  { file: "user/route.ts", guard: "requireSelfOrAdmin", handlers: ["GET"], forbiddenIdentity: [] },
  { file: "wishlist/route.ts", guard: "requireAuth", handlers: ["GET", "POST", "DELETE"], forbiddenIdentity: ["{ uid", "searchParams.get('uid')"], keptTargets: ["courseId"] },
];

describe("Phase 2.2 self-identity routes bind identity to the session", () => {
  for (const spec of SPECS) {
    const src = readFileSync(join(API, spec.file), "utf8");

    test(`${spec.file}: migrated handlers are wrapped in withApi and use ${spec.guard}`, () => {
      for (const h of spec.handlers) {
        assert.match(src, new RegExp(`export const ${h} = withApi`), `${h} not wrapped`);
      }
      assert.match(src, new RegExp(`\\b${spec.guard}\\(req`), `${spec.guard} not called`);
      assert.match(src, /import \{ [^}]*\} from ['"]@\/lib\/auth['"]/);
    });

    test(`${spec.file}: no client-supplied caller identity; targets preserved`, () => {
      for (const needle of spec.forbiddenIdentity) {
        // Only the code after the imports/header comment is checked so that
        // explanatory comments mentioning the old field do not trip the test.
        const code = src.replace(/\/\/[^\n]*/g, "");
        assert.equal(code.includes(needle), false, `still reads client identity: ${needle}`);
      }
      for (const target of spec.keptTargets ?? []) {
        assert.ok(src.includes(target), `target identifier removed: ${target}`);
      }
    });

    test(`${spec.file}: no edge runtime, legacy/inline auth, spoof headers, error leaks, or any-casts`, () => {
      if (!spec.edgeAllowed) assert.doesNotMatch(src, /runtime\s*=\s*['"]edge['"]/);
      assert.doesNotMatch(src, /verifyIdToken\(|firebaseAdmin\.auth\(\)|from ['"]firebase-admin/);
      assert.doesNotMatch(src, /x-user-id|x-user-role|localStorage/i);
      assert.doesNotMatch(src, /as any|@ts-ignore|@ts-expect-error/);
      if (!spec.partialFile) {
        assert.doesNotMatch(src, /error\.message|err\.message|e\.message/);
        assert.doesNotMatch(src, /catch\s*\(\s*\w+\s*:\s*any\s*\)/);
      }
    });
  }

  test("teacher marketing/students: never-enrolled and export are admin-gated", () => {
    const marketing = readFileSync(join(API, "teacher/marketing/route.ts"), "utf8");
    const students = readFileSync(join(API, "teacher/students/route.ts"), "utf8");
    assert.match(marketing, /filter === 'never-enrolled' && !isAdmin/);
    assert.match(marketing, /exportEmails && !isAdmin/);
    assert.match(students, /filter === 'never-enrolled' && user\.role !== 'admin'/);
  });

  test("tutor: only the sales context is unauthenticated", () => {
    const tutor = readFileSync(join(API, "tutor/route.ts"), "utf8");
    assert.match(tutor, /context === 'sales' \? null : await requireAuth\(req\)/);
    assert.match(tutor, /const userId = user\?\.uid \?\? null/);
  });
});
