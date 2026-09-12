import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled, HttpError } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';

// Phase 2.4a: previously unauthenticated and returned `correct`. Now requires
// an enrolled student (via the lesson's course) and returns only the fields
// needed to take the quiz. Edge runtime removed for firebase-admin
// compatibility.
export const GET = withApi<{ id: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { id: lessonId } = await ctx.params;

  const [lesson] = await sql`SELECT course_id FROM lessons WHERE id = ${lessonId} LIMIT 1`;
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  if (!lesson.course_id) throw new HttpError(403, 'Lesson is not part of an enrollable course');
  await requireEnrolled(user, lesson.course_id as string);

  const questions = await sql`
    SELECT id, question, options
    FROM quizzes
    WHERE lesson_id = ${lessonId}
    ORDER BY created_at ASC
  `;
  return NextResponse.json({ questions });
});
