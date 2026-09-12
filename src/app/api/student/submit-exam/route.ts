// src/app/api/student/submit-exam/route.ts
// تقديم الامتحان الكامل وتصحيحه وإصدار النقاط

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireStudent } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { addPoints } from "@/lib/gamification/points";
import { checkAndAwardBadges } from "@/lib/gamification/badges";
import { gradeAttempt, safeJsonParse, type GradableQuestion } from "@/lib/exam/grading";

// Phase 2.4a integrity fixes (grading formula itself unchanged: % correct, pass >= 50):
//  - caller identity from the central auth layer; attempt must belong to the caller
//  - valid question set = the attempt's course (cross-course ids are ignored)
//  - denominator = questions served at start-exam (attempt.total_questions),
//    never the size of the client-submitted subset; duplicates never count twice
//  - exam-pass points are awarded at most once per (student, course) using the
//    existing exam_attempts.points_awarded column, so retakes cannot farm points
// REVIEW (Phase 4): served question ids are not persisted; retake/attempt
// policy and a proper ledger idempotency key need schema decisions.
export const POST = withApi(async (request) => {
  const user = await requireStudent(request);
  const userId = user.profileId;

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { examId, answers } = body;

    if (!examId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "examId and answers array are required" },
        { status: 400 }
      );
    }

    // جلب بيانات المحاولة
    const attemptRes = await sql`
      SELECT id, user_id, course_id, passed, score, total_questions
      FROM exam_attempts
      WHERE id = ${examId}
      LIMIT 1
    `;
    if (attemptRes.length === 0) {
      return NextResponse.json({ error: "Exam attempt not found" }, { status: 404 });
    }
    const attempt = attemptRes[0];
    if (attempt.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (attempt.passed) {
      return NextResponse.json({ error: "Exam already submitted" }, { status: 400 });
    }

    // جلب جميع أسئلة الكورس (مجموعة الأسئلة الصالحة يحددها الخادم)
    const questionsRes = await sql`
      SELECT id, question_type, correct_answer, options
      FROM generated_questions
      WHERE course_id = ${attempt.course_id}
    `;

    const questionMap = new Map<string, GradableQuestion>();
    for (const q of questionsRes) {
      questionMap.set(String(q.id), {
        question_type: q.question_type,
        correct_answer: safeJsonParse(q.correct_answer),
        options: safeJsonParse(q.options),
      });
    }

    const graded = gradeAttempt(questionMap, answers, Number(attempt.total_questions));
    const { correctCount, totalQuestions, score, passed } = graded;

    // تحديث المحاولة
    await sql`
      UPDATE exam_attempts
      SET score = ${score},
          total_questions = ${totalQuestions},
          passed = ${passed},
          points_awarded = 0
      WHERE id = ${examId}
    `;

    let pointsAwarded = 0;

    if (passed) {
      // منح نقاط النجاح مرة واحدة فقط لكل (طالب، كورس)
      const alreadyAwarded = await sql`
        SELECT 1 FROM exam_attempts
        WHERE user_id = ${userId} AND course_id = ${attempt.course_id}
          AND points_awarded > 0 AND id <> ${examId}
        LIMIT 1
      `;

      if (alreadyAwarded.length === 0) {
        const configRes = await sql`
          SELECT value FROM gamification_config WHERE key_name = 'exam_pass_points'
        `;
        const examPassPoints = configRes.length > 0 ? parseInt(configRes[0].value, 10) || 100 : 100;

        await addPoints(userId, examPassPoints, "exam_pass", {
          examId,
          score,
          totalQuestions,
        });
        pointsAwarded = examPassPoints;

        await sql`
          UPDATE exam_attempts SET points_awarded = ${examPassPoints} WHERE id = ${examId}
        `;
      }

      try {
        await checkAndAwardBadges(userId);
      } catch (badgeError) {
        console.error("Error checking badges:", badgeError);
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        score,
        passed,
        points_awarded: pointsAwarded,
        totalQuestions,
        correctCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AuthError" || error.name === "HttpError")) throw error;
    console.error("Error submitting exam:", error);
    return NextResponse.json({ error: "Failed to submit exam" }, { status: 500 });
  }
});
