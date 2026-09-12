/**
 * Phase 2.4a — static guard checks for the paid-content / student-integrity
 * routes. These assert the shape of each handler file (central guards,
 * enrollment/library checks, no answer-key leaks, no legacy auth helpers,
 * no `error.message` leaks, no edge runtime). Behavioural guarantees are
 * covered by tests/auth/enrollment.test.ts, tests/exam/grading.test.ts and
 * tests/gamification/streak-rules.test.ts against the same implementation.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const API = join(ROOT, "src", "app", "api");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readApi = (rel: string) => readFileSync(join(API, rel), "utf8");

type Spec = {
  file: string;
  handlers: string[];
  /** Guard identifiers that must be imported from "@/lib/auth". */
  guards: string[];
  /** Exact needles that must be present in the file. */
  mustContain?: string[];
  /** Exact needles that must be absent from the file. */
  mustNotContain?: string[];
};

const LEGACY = [
  "runtime = 'edge'",
  'runtime = "edge"',
  "error.message",
  "error: any",
  "@/lib/firebase-admin",
  "firebaseAdmin",
  "verifyIdToken",
  "getServerSession",
  "getUserIdFromRequest",
  "cookies()",
  "getAuth(",
];

const SPECS: Spec[] = [
  // ----- Group 3: answer-key protection -----
  {
    file: "exam/[courseId]/questions/route.ts",
    handlers: ["GET"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["stripAnswerKeys(questions)", "await requireEnrolled(user, courseId)"],
  },
  {
    file: "quizzes/[lessonId]/route.ts",
    handlers: ["GET", "POST"],
    guards: ["requireStudent", "requireEnrolled", "HttpError"],
    mustContain: [
      "user.role === 'admin' ? quizzes : stripAnswerKeys(quizzes)",
      "SELECT correct FROM quizzes WHERE id = ${questionId} AND lesson_id = ${lessonId}",
      "correct: selected === correctIndex",
    ],
  },
  {
    file: "quizzes/course/[courseId]/route.ts",
    handlers: ["GET"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["stripAnswerKeys(quizzes)"],
  },
  {
    file: "lessons/[id]/quiz/route.ts",
    handlers: ["GET"],
    guards: ["requireStudent", "requireEnrolled", "HttpError"],
    mustContain: ["SELECT id, question, options"],
    mustNotContain: ["options, correct"],
  },
  {
    file: "exam/[courseId]/submit/route.ts",
    handlers: ["POST"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["Math.min(EXAM_SERVED_LIMIT, answerKey.size)", "seen.has(id)"],
    mustNotContain: ["const total = answers.length"],
  },
  // ----- Group 4: exam integrity -----
  {
    file: "student/start-exam/route.ts",
    handlers: ["POST"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["const userId = user.profileId", "await requireEnrolled(user, courseId)", "${questionsRes.length}"],
    mustNotContain: ["correct_answer"],
  },
  {
    file: "student/submit-exam/route.ts",
    handlers: ["POST"],
    guards: ["requireStudent"],
    mustContain: [
      "const userId = user.profileId",
      "gradeAttempt(questionMap, answers, Number(attempt.total_questions))",
      "AND points_awarded > 0 AND id <> ${examId}",
      "WHERE course_id = ${attempt.course_id}",
    ],
    mustNotContain: ["validCount", "const totalQuestions = answers"],
  },
  {
    file: "student/submit-answer/route.ts",
    handlers: ["POST"],
    guards: ["requireStudent", "requireEnrolled", "HttpError"],
    mustContain: ["await requireEnrolled(user, courseId)", "JOIN lessons l ON l.id = q.lesson_id", "{ success: true, isCorrect }"],
    mustNotContain: ["correctAnswer: actualCorrectAnswer", "if (finalize", "updateStreak(", "addPoints("],
  },
  // ----- Group 5: games -----
  {
    file: "student/games/route.ts",
    handlers: ["GET"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["await requireEnrolled(user, courseId)"],
  },
  {
    file: "student/games/session/route.ts",
    handlers: ["POST", "GET"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["await requireEnrolled(user, courseId)", "requestedCount <= 50"],
  },
  // ----- Group 6: library -----
  {
    file: "library/access/route.ts",
    handlers: ["GET"],
    guards: ["getSession", "getLibraryAccess"],
    mustContain: ['reason: "login"', 'reason: "no_subscription"'],
  },
  {
    file: "library/books/route.ts",
    handlers: ["GET"],
    guards: ["requireAuth", "requireLibraryAccess"],
    mustContain: ["await requireLibraryAccess(user)"],
  },
  {
    file: "library/books/id/route.ts",
    handlers: ["GET"],
    guards: ["requireAuth", "requireLibraryAccess"],
    mustContain: ["await requireLibraryAccess(user)", "await ctx.params"],
  },
  {
    file: "library/page-overlay/route.ts",
    handlers: ["GET", "POST"],
    guards: ["requireAuth", "requireAdmin", "requireLibraryAccess"],
    mustContain: ["await requireLibraryAccess(user)", "await requireAdmin(req)"],
  },
  {
    file: "library/annotations/route.ts",
    handlers: ["POST", "GET"],
    guards: ["requireAuth", "requireLibraryAccess"],
    mustContain: ["VALUES (${user.uid}", "WHERE user_uid = ${user.uid}"],
    mustNotContain: ["session.uid"],
  },
  // ----- Group 7: completion -----
  {
    file: "lessons/complete/route.ts",
    handlers: ["POST"],
    guards: ["requireStudent", "requireEnrolled", "HttpError"],
    mustContain: ["HttpError(404, 'Lesson not found')", "await requireEnrolled(user, lesson.course_id as string)"],
  },
  {
    file: "course/complete/route.ts",
    handlers: ["POST"],
    guards: ["requireStudent", "requireEnrolled"],
    mustContain: ["await requireEnrolled(user, courseId)", "profile?.gender === 'male' || profile?.gender === 'female'"],
    mustNotContain: ["req.headers.get('x-"],
  },
  // ----- Group 8: self-auth cleanup -----
  { file: "student/streak/route.ts", handlers: ["GET", "POST"], guards: ["requireAuth"], mustContain: ["getStreak(user.profileId)", "updateStreak(user.profileId)"] },
  { file: "student/points/route.ts", handlers: ["GET"], guards: ["requireAuth"], mustContain: ["getPointsBalance(user.profileId)"] },
  { file: "student/badges/route.ts", handlers: ["GET"], guards: ["requireAuth"], mustContain: ["getUserBadges(user.profileId)"] },
  { file: "student/redeem-points/route.ts", handlers: ["GET", "POST"], guards: ["requireAuth"], mustContain: ["redeemPointsForCoupon(user.profileId, offerId)"] },
  { file: "student/dashboard/route.ts", handlers: ["GET"], guards: ["requireAuth"], mustContain: ["const userId = user.profileId", "const firebaseUid = user.uid"] },
  { file: "subscriptions/route.ts", handlers: ["GET"], guards: ["requireAuth"], mustContain: ["p.firebase_uid = ${user.uid}"] },
  // ----- secondary: live sessions -----
  {
    file: "lessons/[id]/zoom/route.ts",
    handlers: ["GET"],
    guards: ["requireAuth", "requireEnrolled", "HttpError"],
    mustContain: ["lesson.teacher_uid === user.uid", "user.role !== 'admin' && !isOwnerTeacher"],
  },
  {
    file: "student/sessions/route.ts",
    handlers: ["GET"],
    guards: ["requireStudent"],
    mustContain: ["JOIN enrollments e ON e.course_id = c.id AND e.user_uid = ${user.uid}"],
  },
];

describe("Phase 2.4a paid-content and student-integrity routes", () => {
  for (const spec of SPECS) {
    test(`${spec.file}: guards, needles, no legacy auth or leaks`, () => {
      const src = readApi(spec.file);

      assert.ok(src.includes('from "@/lib/api/handler"') || src.includes("from '@/lib/api/handler'"), "imports withApi");
      const authImport = src.match(/import \{([^}]*)\} from ['"]@\/lib\/auth['"]/);
      assert.ok(authImport, "imports from @/lib/auth");
      for (const g of spec.guards) {
        assert.ok(authImport![1].includes(g), `imports ${g} from @/lib/auth`);
      }
      for (const h of spec.handlers) {
        assert.ok(new RegExp(`export const ${h} = withApi`).test(src) || new RegExp(`export async function ${h}\\(`).test(src), `${h} is exported`);
      }
      for (const needle of spec.mustContain ?? []) {
        assert.ok(src.includes(needle), `must contain: ${needle}`);
      }
      for (const needle of spec.mustNotContain ?? []) {
        assert.ok(!src.includes(needle), `must not contain: ${needle}`);
      }
      for (const needle of LEGACY) {
        assert.ok(!src.includes(needle), `legacy/leak pattern present: ${needle}`);
      }
    });
  }

  test("payment/capture is a 410 stub with no database or enrollment logic", () => {
    const src = readApi("payment/capture/route.ts");
    assert.ok(src.includes("status: 410"));
    assert.ok(/export async function POST\(\)/.test(src));
    for (const forbidden of ["sql", "neon(", "enrollments", "purchases", "referral", "INSERT"]) {
      assert.ok(!src.includes(forbidden), `capture stub must not contain ${forbidden}`);
    }
    assert.equal((src.match(/export /g) ?? []).length, 1, "only the POST handler is exported");
  });

  test("library catalog list query excludes pdf_url; detail requires library access", () => {
    const src = readApi("library/books/route.ts");
    const listQuery = src.match(/SELECT id, title, author, description, cover_url, created_at\s+FROM library_books\s+ORDER BY created_at DESC/);
    assert.ok(listQuery, "catalog list selects explicit columns without pdf_url");
    const detailStart = src.indexOf("if (bookId) {");
    const listStart = src.indexOf("ORDER BY created_at DESC");
    const detail = src.slice(detailStart, listStart);
    assert.ok(detail.includes("await requireLibraryAccess(user)"), "detail branch is gated");
    assert.ok(src.slice(listStart).indexOf("pdf_url") === -1, "no pdf_url after the list query");
  });
});

describe("Phase 2.4a central helpers and frontend callers", () => {
  test("auth core exposes HttpError and the injectable enrollment guard", () => {
    const core = read("src/lib/auth/core.ts");
    assert.ok(core.includes("export class HttpError"));
    assert.ok(core.includes("export function createEnrollmentGuard"));
    assert.ok(core.includes('if (user.role === "admin") return;'), "admin bypass mirrors existing semantics");
  });

  test("auth index binds requireEnrolled to enrollments(user_uid, course_id) and exposes library access", () => {
    const index = read("src/lib/auth/index.ts");
    assert.ok(index.includes("export const requireEnrolled = createEnrollmentGuard("));
    assert.ok(index.includes("WHERE user_uid = ${uid} AND course_id = ${courseId}"));
    assert.ok(index.includes("export async function getLibraryAccess"));
    assert.ok(index.includes("export async function requireLibraryAccess"));
    assert.ok(index.includes("AND (expires_at IS NULL OR expires_at > now())"));
  });

  test("updateStreak is built on the pure rules and skips writes/points when nothing changed", () => {
    const streaks = read("src/lib/gamification/streaks.ts");
    assert.ok(streaks.includes('from "./streak-rules"'));
    assert.ok(streaks.includes("if (!update.changed) {"));
    const skip = streaks.indexOf("if (!update.changed) {");
    const award = streaks.indexOf("addPoints(userId, update.pointsEarned");
    assert.ok(skip !== -1 && award !== -1 && skip < award, "same-day early return precedes the points award");
    assert.ok(!streaks.includes("diffDays"), "no inline day-diff logic remains");
  });

  test("QuizPlayer no longer grades from a client-side answer key", () => {
    const qp = read("src/components/QuizPlayer.tsx");
    assert.ok(!qp.includes("q.correct"), "no q.correct in QuizPlayer");
    assert.ok(qp.includes("authFetch(`/api/quizzes/${lessonId}`"), "checks answers via the lesson quiz POST");
    assert.ok(qp.includes("lessonId: string"), "QuizPlayer requires lessonId");
  });

  test("student pages call the protected endpoints with credentials", () => {
    const course = read("src/app/dashboard/student/course/[courseId]/page.tsx");
    assert.ok(course.includes("authFetch(`/api/exam/${courseId}/questions`)"));
    assert.ok(course.includes("authFetch(`/api/quizzes/${lessonId}`)"));
    assert.ok(course.includes("<QuizPlayer quizzes={quizzes} lessonId={lessonId} />"));

    const exam = read("src/app/dashboard/student/course/exam/courseId/page.tsx");
    assert.ok(exam.includes("authFetch(`/api/exam/${courseId}/questions`)"));
    assert.ok(exam.includes("authFetch(`/api/exam/${courseId}/submit`"));

    const live = read("src/app/live/[lessonId]/page.tsx");
    assert.ok(live.includes("authFetch(`/api/lessons/${params.lessonId}/zoom`)"));
    assert.ok(!live.includes("fetch(`/api/lessons/${params.lessonId}/zoom`)"));
  });
});
