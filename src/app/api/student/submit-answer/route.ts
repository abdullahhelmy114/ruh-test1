// app/api/student/submit-answer/route.ts
// تقييم إجابة سؤال واحد فورياً وتسجيل النشاط

import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireStudent, requireEnrolled, HttpError } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { isAnswerCorrect, safeJsonParse } from "@/lib/exam/grading";

// Phase 2.4a integrity fixes:
//  - caller identity from the central auth layer
//  - the client can no longer supply `correctAnswer`; correctness is resolved
//    from the question row only, and the question must belong to a course the
//    student is enrolled in (no cross-course / cross-user answer oracle)
//  - the response no longer echoes the correct answer
//  - the client-supplied `activitySummary`/`finalize` block, which awarded
//    points and streak from client-reported totals, is removed. There is no
//    server-side activity session to derive those totals from; this needs a
//    persisted session/attempt model (Phase 4). No frontend currently calls
//    this route.
export const POST = withApi(async (request) => {
  const user = await requireStudent(request);
  const userId = user.profileId;

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const body = await request.json();
    const { questionId, questionType, userAnswer } = body;

    if (typeof questionId !== "string" || !questionId || !questionType || userAnswer === undefined) {
      return NextResponse.json(
        { error: "questionId, questionType and userAnswer are required" },
        { status: 400 }
      );
    }

    // حل السؤال ومقرره من قاعدة البيانات فقط
    let actualCorrectAnswer: unknown = null;
    let courseId: string | null = null;

    const questionRes = await sql`
      SELECT correct_answer, options, course_id FROM generated_questions
      WHERE id = ${questionId}
      LIMIT 1
    `;
    if (questionRes.length > 0) {
      actualCorrectAnswer = safeJsonParse(questionRes[0].correct_answer);
      courseId = questionRes[0].course_id;
    } else {
      const quizRes = await sql`
        SELECT q.correct, q.options, l.course_id
        FROM quizzes q
        JOIN lessons l ON l.id = q.lesson_id
        WHERE q.id = ${questionId}
        LIMIT 1
      `;
      if (quizRes.length > 0) {
        const quiz = quizRes[0];
        const options = safeJsonParse(quiz.options);
        actualCorrectAnswer = Array.isArray(options) ? options[quiz.correct] ?? null : null;
        courseId = quiz.course_id;
      }
    }

    if (actualCorrectAnswer === undefined || actualCorrectAnswer === null || !courseId) {
      throw new HttpError(404, "Question not found");
    }

    await requireEnrolled(user, courseId);

    const isCorrect = isAnswerCorrect(questionType, userAnswer, actualCorrectAnswer);

    await sql`
      INSERT INTO activity_log (user_id, activity_type, points_earned, metadata)
      VALUES (${userId}, 'question_answered', 0, ${JSON.stringify({
        questionId,
        questionType,
        isCorrect,
        timestamp: new Date().toISOString(),
      })})
    `;

    return NextResponse.json({ success: true, isCorrect });
  } catch (error) {
    if (error instanceof Error && (error.name === "AuthError" || error.name === "HttpError")) throw error;
    console.error("Error processing answer:", error);
    return NextResponse.json({ error: "Failed to process answer" }, { status: 500 });
  }
});
