import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/client';
import { requireStudent, requireEnrolled } from '@/lib/auth';
import { withApi } from '@/lib/api/handler';
import { stripAnswerKeys } from '@/lib/exam/grading';

// Phase 2.4a: previously unauthenticated `SELECT *` (including `correct`).
// Now requires an enrolled student (admin bypass) and never returns the
// answer key; grading happens server-side in exam/[courseId]/submit.
// Edge runtime removed for firebase-admin compatibility.
export const GET = withApi<{ courseId: string }>(async (req, ctx) => {
  const user = await requireStudent(req);
  const { courseId } = await ctx.params;
  await requireEnrolled(user, courseId);

  const questions = await sql`
    SELECT * FROM exam_questions
    WHERE course_id = ${courseId}
    ORDER BY RANDOM()
    LIMIT 25
  `;
  return NextResponse.json({ questions: stripAnswerKeys(questions) });
});
