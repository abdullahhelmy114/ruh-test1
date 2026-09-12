import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { stripAnswerKeys } from '@/lib/exam/grading';

// Phase 2.4a: previously unauthenticated `SELECT *` on course_quizzes. Now
// requires an enrolled student (admin bypass) and omits answer-key fields.
// Edge runtime removed for firebase-admin compatibility.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { courseId } = await ctx.params;
  await requireEnrolled(user, courseId);

  const quizzes = await sql`SELECT * FROM course_quizzes WHERE course_id = ${courseId} ORDER BY id`;
  return NextResponse.json({ quizzes: stripAnswerKeys(quizzes) });
});
