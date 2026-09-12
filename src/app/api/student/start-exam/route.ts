// src/app/api/student/start-exam/route.ts
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { requireStudent, requireEnrolled } from "@/lib/auth";
import { withApi } from "@/lib/api/handler";
import { safeJsonParse } from "@/lib/exam/grading";

// Phase 2.4a: caller identity comes from the central auth layer (profileId is
// the same profiles.id the old inline helper resolved); the student must be
// enrolled in the course. The served question count is persisted on the
// attempt (total_questions) and is the authoritative grading denominator in
// submit-exam. Question set/limit and response shape are unchanged.
// REVIEW (Phase 4): the attempt does not persist the served question IDs and
// there is no attempt cap; both need schema/policy decisions.
export const POST = withApi(async (request) => {
  const user = await requireStudent(request);
  const userId = user.profileId;

  try {
    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 });
    }

    await requireEnrolled(user, courseId);

    const sql = neon(process.env.DATABASE_URL!);

    const courseRes = await sql`SELECT id FROM course WHERE id = ${courseId} LIMIT 1`;
    if (courseRes.length === 0) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const questionsRes = await sql`
      SELECT id, question_type, question_text, options, audio_url, audio_text, difficulty
      FROM generated_questions
      WHERE course_id = ${courseId}
      ORDER BY random()
      LIMIT 50
    `;

    if (questionsRes.length === 0) {
      return NextResponse.json(
        { error: "No exam questions available for this course" },
        { status: 404 }
      );
    }

    const attemptRes = await sql`
      INSERT INTO exam_attempts (user_id, course_id, score, total_questions, passed, points_awarded)
      VALUES (${userId}, ${courseId}, 0, ${questionsRes.length}, false, 0)
      RETURNING id
    `;
    const attemptId = attemptRes[0].id;

    const questions = questionsRes.map((q: any) => ({
      id: q.id,
      question_type: q.question_type,
      question_text: q.question_text,
      options: safeJsonParse(q.options),
      audio_url: q.audio_url,
      audio_text: q.audio_text,
      difficulty: q.difficulty,
    }));

    return NextResponse.json({
      success: true,
      exam: {
        examId: attemptId,
        questions,
        timeLimitSeconds: null,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AuthError" || error.name === "HttpError")) throw error;
    console.error("Error starting exam:", error);
    return NextResponse.json({ error: "Failed to start exam" }, { status: 500 });
  }
});
