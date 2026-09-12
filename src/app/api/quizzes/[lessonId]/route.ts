import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled, HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { stripAnswerKeys } from '@/lib/exam/grading';

// Phase 2.4a: lesson quizzes were served unauthenticated with the answer key.
// GET now requires an enrolled student (via the lesson's course) and omits
// `correct`. POST checks a single answer server-side and reveals the correct
// option only after a selection is committed, which is the existing
// QuizPlayer behaviour (feedback after each answer, no persisted score).
// Edge runtime removed for firebase-admin compatibility.

async function resolveLessonCourse(lessonId: string): Promise<string> {
  const [lesson] = await sql`SELECT course_id FROM lessons WHERE id = ${lessonId} LIMIT 1`;
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (!lesson.course_id) throw new HttpError(403, 'Lesson is not part of an enrollable course');
  return lesson.course_id as string;
}

export const GET = withApi<{ lessonId: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { lessonId } = await ctx.params;
  await requireEnrolled(user, await resolveLessonCourse(lessonId));

  const quizzes = await sql`SELECT * FROM quizzes WHERE lesson_id = ${lessonId}`;
  // Admins author quizzes (the admin dashboard shows the correct option);
  // students never receive the answer key.
  return NextResponse.json({ quizzes: user.role === 'admin' ? quizzes : stripAnswerKeys(quizzes) });
});

export const POST = withApi<{ lessonId: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { lessonId } = await ctx.params;
  await requireEnrolled(user, await resolveLessonCourse(lessonId));

  const { questionId, selected } = await req.json();
  if (typeof questionId !== 'string' || !questionId || !Number.isInteger(selected)) {
    throw new HttpError(400, 'questionId and selected (integer) are required');
  }

  // The quiz row must belong to this lesson (no cross-lesson answer oracle).
  const [quiz] = await sql`
    SELECT correct FROM quizzes WHERE id = ${questionId} AND lesson_id = ${lessonId} LIMIT 1
  `;
  if (!quiz) throw new HttpError(404, 'Question not found');

  const correctIndex = Number(quiz.correct);
  return NextResponse.json({ correct: selected === correctIndex, correctIndex });
});
